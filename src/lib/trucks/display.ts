import type { FuelType, Truck, TruckBranch } from "./types";
import { FUEL_TYPES, TRUCK_BRANCHES } from "./types";

export function getFuelTypeLabel(fuelType: FuelType): string {
  return FUEL_TYPES.find((entry) => entry.value === fuelType)?.label ?? fuelType;
}

export function getFuelTypeBadgeClass(fuelType: FuelType): string {
  return fuelType === "diesel"
    ? "border-transparent bg-primary/15 text-primary"
    : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function getBranchLabel(branch: TruckBranch): string {
  return TRUCK_BRANCHES.find((entry) => entry.value === branch)?.label ?? branch.toUpperCase();
}

export function getBranchBadgeClass(branch: TruckBranch): string {
  return branch === "usa"
    ? "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300"
    : "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export function formatTruckDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function truncateTruckId(truckId: string): string {
  return truckId.length > 12 ? `${truckId.slice(0, 8)}…` : truckId;
}

export function truckMatchesQuery(truck: Truck, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    truck.truckId,
    truck.name,
    truck.vin,
    String(truck.year),
    getFuelTypeLabel(truck.fuelType),
    getBranchLabel(truck.branch),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeTruckKpis(trucks: Truck[]) {
  return {
    total: trucks.length,
    gas: trucks.filter((truck) => truck.fuelType === "gas").length,
    diesel: trucks.filter((truck) => truck.fuelType === "diesel").length,
    usa: trucks.filter((truck) => truck.branch === "usa").length,
    dr: trucks.filter((truck) => truck.branch === "dr").length,
  };
}
