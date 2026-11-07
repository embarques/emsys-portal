import type { Vehicle } from "@/lib/vehicles/types";

/** Warn when a compliance date is this many days away or fewer, including past dates. */
export const VEHICLE_COMPLIANCE_WARNING_DAYS = 7;

export type VehicleComplianceKind = "inspection" | "registration";

export const VEHICLE_COMPLIANCE_KINDS: readonly VehicleComplianceKind[] = ["inspection", "registration"];

export type VehicleComplianceDue = {
  vehicle: Vehicle;
  kind: VehicleComplianceKind;
  date: string;
  daysRemaining: number;
};

const DAY_MS = 86_400_000;

/** The operator's local business day as YYYY-MM-DD, not the UTC day. */
export function vehicleComplianceToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function calendarDayMs(value: string): number | null {
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return null;
  return ms;
}

/** Whole calendar days from `today` until `value`; negative when already past. */
export function daysUntilVehicleDate(value: string, today: string): number | null {
  const target = calendarDayMs(value);
  const base = calendarDayMs(today);
  if (target === null || base === null) return null;
  return Math.round((target - base) / DAY_MS);
}

export function getVehicleComplianceDate(vehicle: Vehicle, kind: VehicleComplianceKind): string {
  return kind === "inspection" ? vehicle.inspectionDate : vehicle.registrationDate;
}

/** Inactive (out-of-service) vehicles never raise compliance warnings. */
export function getVehicleComplianceDue(
  vehicle: Vehicle,
  kind: VehicleComplianceKind,
  today: string,
): VehicleComplianceDue | null {
  if (!vehicle.active) return null;
  const date = getVehicleComplianceDate(vehicle, kind);
  const daysRemaining = daysUntilVehicleDate(date, today);
  if (daysRemaining === null || daysRemaining > VEHICLE_COMPLIANCE_WARNING_DAYS) return null;
  return { vehicle, kind, date, daysRemaining };
}

/** Most urgent first (overdue before upcoming), then by vehicle name. */
export function collectVehicleComplianceDue(vehicles: readonly Vehicle[], today: string): VehicleComplianceDue[] {
  return vehicles
    .flatMap((vehicle) =>
      VEHICLE_COMPLIANCE_KINDS.map((kind) => getVehicleComplianceDue(vehicle, kind, today)).filter(
        (entry): entry is VehicleComplianceDue => entry !== null,
      ),
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining || a.vehicle.name.localeCompare(b.vehicle.name));
}

/** Translation key + params describing how far a due date is from today. */
export function describeVehicleComplianceTiming(daysRemaining: number): {
  key: string;
  params: Record<string, number>;
} {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return { key: `vehicles.compliance.timing.overdue_${days === 1 ? "one" : "other"}`, params: { count: days } };
  }
  if (daysRemaining === 0) return { key: "vehicles.compliance.timing.today", params: {} };
  return {
    key: `vehicles.compliance.timing.dueIn_${daysRemaining === 1 ? "one" : "other"}`,
    params: { count: daysRemaining },
  };
}
