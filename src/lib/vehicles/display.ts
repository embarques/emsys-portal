import { formatBranchCodeLabel, getBranchCodeBadgeClass } from "@/lib/branches/display";
import type { Branch } from "@/lib/branches/types";
import type { Vehicle, VehiclePortalBranch } from "./types";
import {
  VEHICLE_ACTIVE_OPTIONS,
  VEHICLE_FUEL_TYPES,
  getVehiclePortalBranch,
} from "./types";

export function getFuelTypeLabel(fuelType: string): string {
  return VEHICLE_FUEL_TYPES.find((entry) => entry.value === fuelType)?.label ?? (fuelType || "—");
}

export function getFuelTypeBadgeClass(fuelType: string): string {
  const normalized = fuelType.trim().toLowerCase();
  return normalized === "diesel"
    ? "border-transparent bg-primary/15 text-primary"
    : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function getBranchLabel(branch: string, branches: Pick<Branch, "id" | "name" | "code">[] = []): string {
  return formatBranchCodeLabel(branch, branches);
}

export function getBranchBadgeClass(
  branch: string,
  branches: Pick<Branch, "id" | "name" | "code" | "type">[] = [],
): string {
  return getBranchCodeBadgeClass(branch, branches);
}

export function getVehicleActiveLabel(active: boolean): string {
  return VEHICLE_ACTIVE_OPTIONS.find((entry) => entry.value === active)?.label ?? (active ? "Active" : "Inactive");
}

export function getVehicleActiveBadgeClass(active: boolean): string {
  return active
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-muted text-muted-foreground";
}

export function formatVehicleDate(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return "—";

  // Parse date-only values (YYYY-MM-DD) as local time to avoid an off-by-one
  // day caused by UTC midnight parsing in negative timezones.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsed = dateOnly ? new Date(`${trimmed}T00:00:00`) : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function truncateVehicleId(vehicleId: string): string {
  return vehicleId.length > 12 ? `${vehicleId.slice(0, 8)}…` : vehicleId;
}

export function truncateObjectId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function matchesSearchOperator(value: string, query: string, operator: string): boolean {
  const haystack = value.toLowerCase();
  const needle = query.toLowerCase();

  switch (operator) {
    case "eq":
      return haystack === needle;
    case "neq":
      return haystack !== needle;
    case "contains":
      return haystack.includes(needle);
    default:
      return haystack.startsWith(needle);
  }
}

export function vehicleMatchesSearch(vehicle: Vehicle, search: { field: string; operator: string; value: string }): boolean {
  const query = search.value.trim();
  if (!query) return true;

  const fieldValue = (() => {
    switch (search.field) {
      case "id":
        return vehicle.id;
      case "vehicleId":
        return vehicle.vehicleId;
      case "name":
        return vehicle.name;
      case "vin":
        return vehicle.vin;
      case "licensePlate":
        return vehicle.licensePlate;
      case "year":
        return String(vehicle.year);
      case "fuelType":
        return vehicle.fuelType;
      case "branch.code":
        return vehicle.branch.code;
      case "branch.id":
        return String(vehicle.branch.id);
      case "active":
        return String(vehicle.active);
      case "createdBy.name":
        return vehicle.createdBy;
      default:
        return "";
    }
  })();

  return matchesSearchOperator(fieldValue, query, search.operator);
}

export function vehicleMatchesQuery(vehicle: Vehicle, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    vehicle.id,
    vehicle.vehicleId,
    vehicle.name,
    vehicle.vin,
    vehicle.licensePlate,
    String(vehicle.year),
    getFuelTypeLabel(vehicle.fuelType),
    vehicle.branch.code,
    getBranchLabel(vehicle.branch.code),
    getVehicleActiveLabel(vehicle.active),
    vehicle.createdBy,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeVehicleKpis(vehicles: Vehicle[]) {
  return {
    total: vehicles.length,
    gas: vehicles.filter((vehicle) => vehicle.fuelType.trim().toLowerCase() === "gas").length,
    diesel: vehicles.filter((vehicle) => vehicle.fuelType.trim().toLowerCase() === "diesel").length,
    usa: vehicles.filter((vehicle) => getVehiclePortalBranch(vehicle.branch.code) === "usa").length,
    dr: vehicles.filter((vehicle) => getVehiclePortalBranch(vehicle.branch.code) === "dr").length,
  };
}

/** @deprecated Use VehiclePortalBranch */
export type { VehiclePortalBranch };
