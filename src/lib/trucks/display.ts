import type { Truck, TruckPortalBranch } from "./types";
import { TRUCK_BRANCHES, TRUCK_FUEL_TYPES, getTruckPortalBranch } from "./types";

export function getFuelTypeLabel(fuelType: string): string {
  return TRUCK_FUEL_TYPES.find((entry) => entry.value === fuelType)?.label ?? (fuelType || "—");
}

export function getFuelTypeBadgeClass(fuelType: string): string {
  const normalized = fuelType.trim().toLowerCase();
  return normalized === "diesel"
    ? "border-transparent bg-primary/15 text-primary"
    : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function getBranchLabel(branch: string): string {
  const portal = getTruckPortalBranch(branch);
  return TRUCK_BRANCHES.find((entry) => entry.value === portal)?.label ?? (branch || "—");
}

export function getBranchBadgeClass(branch: string): string {
  const portal = getTruckPortalBranch(branch);
  return portal === "usa"
    ? "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300"
    : "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export function formatTruckDate(iso: string): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function truncateTruckId(truckId: string): string {
  return truckId.length > 12 ? `${truckId.slice(0, 8)}…` : truckId;
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

export function truckMatchesSearch(truck: Truck, search: { field: string; operator: string; value: string }): boolean {
  const query = search.value.trim();
  if (!query) return true;

  const fieldValue = (() => {
    switch (search.field) {
      case "id":
        return truck.id;
      case "truckId":
        return truck.truckId;
      case "name":
        return truck.name;
      case "vin":
        return truck.vin;
      case "year":
        return String(truck.year);
      case "fuelType":
        return truck.fuelType;
      case "branch":
        return truck.branch;
      case "createdBy":
        return truck.createdBy;
      default:
        return "";
    }
  })();

  return matchesSearchOperator(fieldValue, query, search.operator);
}

export function truckMatchesQuery(truck: Truck, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    truck.id,
    truck.truckId,
    truck.name,
    truck.vin,
    String(truck.year),
    getFuelTypeLabel(truck.fuelType),
    truck.branch,
    getBranchLabel(truck.branch),
    truck.createdBy,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeTruckKpis(trucks: Truck[]) {
  return {
    total: trucks.length,
    gas: trucks.filter((truck) => truck.fuelType.trim().toLowerCase() === "gas").length,
    diesel: trucks.filter((truck) => truck.fuelType.trim().toLowerCase() === "diesel").length,
    usa: trucks.filter((truck) => getTruckPortalBranch(truck.branch) === "usa").length,
    dr: trucks.filter((truck) => getTruckPortalBranch(truck.branch) === "dr").length,
  };
}

/** @deprecated Use TruckPortalBranch */
export type { TruckPortalBranch };
