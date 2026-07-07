import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";

export type VehiclePortalBranch = "usa" | "dr";

/** Branch a vehicle belongs to (`id` + `code`), matching the employees API shape. */
export type VehicleBranch = {
  id: number;
  code: string;
};

export type Vehicle = {
  id: string;
  vehicleId: string;
  name: string;
  vin: string;
  licensePlate: string;
  year: number;
  fuelType: string;
  branch: VehicleBranch;
  active: boolean;
  inspectionDate: string;
  registrationDate: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type VehicleFormValues = {
  id: string;
  vehicleId: string;
  name: string;
  vin: string;
  licensePlate: string;
  year: string;
  fuelType: string;
  branch: VehicleBranch;
  active: boolean;
  inspectionDate: string;
  registrationDate: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type VehicleFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

/** Matches GET /vehicles filter operators from the API spec. */
export type VehicleSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type VehicleSearchField =
  | "id"
  | "vehicleId"
  | "name"
  | "vin"
  | "licensePlate"
  | "year"
  | "fuelType"
  | "branch.code"
  | "branch.id"
  | "active"
  | "createdBy.name";

export type VehicleSearchFilter = ApiListTextSearch;

export type VehicleListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: VehicleSearchFilter;
  filterRows?: TableFilterRowState[];
};

/** GET /vehicles?page=1&limit=50&offset=0&sort=name:asc */
export const DEFAULT_VEHICLE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "name:asc",
} as const satisfies Pick<VehicleListParams, "page" | "limit" | "sort">;

export const VEHICLE_GET_SEARCH_CAPABILITIES: {
  field: VehicleSearchField;
  label: string;
  operators: VehicleSearchOperator[];
}[] = [
  { field: "vehicleId", label: "Vehicle ID", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "name", label: "name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "vin", label: "vin", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "licensePlate", label: "licensePlate", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "fuelType", label: "fuelType", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "branch.code", label: "branch.code", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "branch.id", label: "branch.id", operators: ["eq", "neq"] },
  { field: "active", label: "active", operators: ["eq", "neq"] },
  { field: "createdBy.name", label: "createdBy", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "year", label: "year", operators: ["eq", "neq"] },
  { field: "id", label: "Record ID", operators: ["eq", "neq"] },
];

export const VEHICLE_SEARCH_FIELDS: { value: VehicleSearchField; label: string }[] =
  VEHICLE_GET_SEARCH_CAPABILITIES.map(({ field, label }) => ({ value: field, label }));

export const VEHICLE_SEARCH_OPERATORS: { value: VehicleSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export const VEHICLE_FUEL_TYPES: { value: string; label: string }[] = [
  { value: "gas", label: "Gas" },
  { value: "diesel", label: "Diesel" },
];

export const VEHICLE_ACTIVE_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Active" },
  { value: false, label: "Inactive" },
];

/** @deprecated Use VEHICLE_FUEL_TYPES */
export const FUEL_TYPES = VEHICLE_FUEL_TYPES;

export const VEHICLE_BRANCH_OPTIONS: { value: string; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
  { value: "NY", label: "NY" },
  { value: "DR", label: "DR (code)" },
];

/** @deprecated Use VEHICLE_BRANCH_OPTIONS */
export const VEHICLE_BRANCHES: { value: VehiclePortalBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

/** @deprecated Use VehiclePortalBranch */
export type FuelType = string;

export function getVehicleSearchOperatorsForField(field: VehicleSearchField): VehicleSearchOperator[] {
  return VEHICLE_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === field)?.operators ?? ["eq"];
}

export function getDefaultVehicleSearchOperator(field: VehicleSearchField): VehicleSearchOperator {
  return getVehicleSearchOperatorsForField(field)[0];
}

export function createVehicleSearchFilter(value: string): VehicleSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildVehicleListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): VehicleListParams {
  const params: VehicleListParams = {
    ...DEFAULT_VEHICLE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_VEHICLE_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_VEHICLE_LIST_PARAMS.sort,
  };

  const search = createVehicleSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function getVehiclePortalBranch(branch: string): VehiclePortalBranch {
  const normalized = (branch ?? "").trim().toLowerCase();
  if (
    normalized === "dr" ||
    normalized === "do" ||
    normalized === "rd" ||
    normalized === "dominican republic"
  ) {
    return "dr";
  }
  return "usa";
}

export function createMockObjectId(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function createEmptyVehicleForm(): VehicleFormValues {
  return {
    id: "",
    vehicleId: "",
    name: "",
    vin: "",
    licensePlate: "",
    year: String(new Date().getFullYear()),
    fuelType: "diesel",
    branch: { id: 0, code: "" },
    active: true,
    inspectionDate: "",
    registrationDate: "",
    createdAt: "",
    createdBy: "",
    updatedAt: "",
  };
}

export function vehicleToFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    id: vehicle.id,
    vehicleId: vehicle.vehicleId,
    name: vehicle.name,
    vin: vehicle.vin,
    licensePlate: vehicle.licensePlate,
    year: vehicle.year > 0 ? String(vehicle.year) : "",
    fuelType: vehicle.fuelType,
    branch: { ...vehicle.branch },
    active: vehicle.active,
    inspectionDate: vehicle.inspectionDate,
    registrationDate: vehicle.registrationDate,
    createdAt: vehicle.createdAt,
    createdBy: vehicle.createdBy,
    updatedAt: vehicle.updatedAt,
  };
}

export function validateVehicleFormValues(values: VehicleFormValues): void {
  if (!values.name.trim()) {
    throw new Error("Vehicle name is required.");
  }

  if (!(values.branch.id > 0)) {
    throw new Error("Branch is required.");
  }

  if (values.year.trim()) {
    const year = Number(values.year);
    if (!Number.isFinite(year) || year < 1900) {
      throw new Error("Year must be a valid number.");
    }
  }
}
