import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";

export type TruckPortalBranch = "usa" | "dr";

export type Truck = {
  id: string;
  truckId: string;
  name: string;
  vin: string;
  year: number;
  fuelType: string;
  branch: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type TruckFormValues = {
  id: string;
  truckId: string;
  name: string;
  vin: string;
  year: string;
  fuelType: string;
  branch: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type TruckFilterState = {
  query: string;
  fuelType: string | "all";
  branch: string | "all";
};

/** Matches GET /trucks filter operators from the API spec. */
export type TruckSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type TruckSearchField =
  | "id"
  | "truckId"
  | "name"
  | "vin"
  | "year"
  | "fuelType"
  | "branch"
  | "createdBy";

export type TruckSearchFilter = ApiListTextSearch;

export type TruckListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: TruckSearchFilter;
  fuelType?: string;
  branch?: string;
};

/** GET /trucks?page=1&limit=40&offset=0&sort=name:asc */
export const DEFAULT_TRUCK_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "name:asc",
} as const satisfies Pick<TruckListParams, "page" | "limit" | "sort">;

export const TRUCK_GET_SEARCH_CAPABILITIES: {
  field: TruckSearchField;
  label: string;
  operators: TruckSearchOperator[];
}[] = [
  { field: "truckId", label: "truckId", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "name", label: "name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "vin", label: "vin", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "fuelType", label: "fuelType", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "branch", label: "branch", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "createdBy", label: "createdBy", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "year", label: "year", operators: ["eq", "neq"] },
  { field: "id", label: "Truck ID", operators: ["eq", "neq"] },
];

export const TRUCK_SEARCH_FIELDS: { value: TruckSearchField; label: string }[] =
  TRUCK_GET_SEARCH_CAPABILITIES.map(({ field, label }) => ({ value: field, label }));

export const TRUCK_SEARCH_OPERATORS: { value: TruckSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export const TRUCK_FUEL_TYPES: { value: string; label: string }[] = [
  { value: "gas", label: "Gas" },
  { value: "diesel", label: "Diesel" },
];

/** @deprecated Use TRUCK_FUEL_TYPES */
export const FUEL_TYPES = TRUCK_FUEL_TYPES;

export const TRUCK_BRANCH_OPTIONS: { value: string; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
  { value: "NY", label: "NY" },
  { value: "DR", label: "DR (code)" },
];

/** @deprecated Use TRUCK_BRANCH_OPTIONS */
export const TRUCK_BRANCHES: { value: TruckPortalBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

/** @deprecated Use TruckPortalBranch */
export type TruckBranch = TruckPortalBranch;

/** @deprecated Use TruckPortalBranch */
export type FuelType = string;

export function getTruckSearchOperatorsForField(field: TruckSearchField): TruckSearchOperator[] {
  return TRUCK_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === field)?.operators ?? ["eq"];
}

export function getDefaultTruckSearchOperator(field: TruckSearchField): TruckSearchOperator {
  return getTruckSearchOperatorsForField(field)[0];
}

export function createTruckSearchFilter(value: string): TruckSearchFilter | undefined {
  return createListTextSearch(value);
}

export function getTruckPortalBranch(branch: string): TruckPortalBranch {
  const normalized = branch.trim().toLowerCase();
  if (normalized === "dr" || normalized === "do" || normalized === "dominican republic") {
    return "dr";
  }
  return "usa";
}

export function createMockObjectId(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function createEmptyTruckForm(): TruckFormValues {
  return {
    id: "",
    truckId: "",
    name: "",
    vin: "",
    year: String(new Date().getFullYear()),
    fuelType: "diesel",
    branch: "usa",
    createdAt: "",
    createdBy: "",
    updatedAt: "",
  };
}

export function truckToFormValues(truck: Truck): TruckFormValues {
  return {
    id: truck.id,
    truckId: truck.truckId,
    name: truck.name,
    vin: truck.vin,
    year: truck.year > 0 ? String(truck.year) : "",
    fuelType: truck.fuelType,
    branch: truck.branch,
    createdAt: truck.createdAt,
    createdBy: truck.createdBy,
    updatedAt: truck.updatedAt,
  };
}

export function validateTruckFormValues(values: TruckFormValues): void {
  if (!values.truckId.trim()) {
    throw new Error("Truck ID is required.");
  }

  if (!values.name.trim()) {
    throw new Error("Truck name is required.");
  }

  if (values.year.trim()) {
    const year = Number(values.year);
    if (!Number.isFinite(year) || year < 1900) {
      throw new Error("Year must be a valid number.");
    }
  }
}
