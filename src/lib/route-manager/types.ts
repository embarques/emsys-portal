import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createMockObjectId } from "@/lib/vehicles/types";
import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";

export type RouteVehicleRef = {
  id: string;
  name: string;
  branch?: string;
};

/** Crew member role on a route. Defaults to `driver` when unset. */
export type RouteCrewRole = "driver" | "appraiser" | "helper";

export const ROUTE_CREW_ROLES: RouteCrewRole[] = ["driver", "appraiser", "helper"];

export const DEFAULT_ROUTE_CREW_ROLE: RouteCrewRole = "helper";

export type RouteEmployeeRef = {
  id: number;
  name: string;
  role?: RouteCrewRole;
};

export function resolveCrewRole(role?: RouteCrewRole): RouteCrewRole {
  return role ?? DEFAULT_ROUTE_CREW_ROLE;
}

/** Roles that only one crew member can hold at a time. */
export const SINGLETON_CREW_ROLES: RouteCrewRole[] = ["driver", "appraiser"];

/**
 * Assign `role` to the crew member with `employeeId`. Driver and appraiser are
 * singleton roles (only one each), so promoting a member to one of them demotes
 * any other member currently holding that role back to helper. Helper is
 * unlimited.
 */
export function setCrewMemberRole(
  employees: RouteEmployeeRef[],
  employeeId: number,
  role: RouteCrewRole,
): RouteEmployeeRef[] {
  const isSingleton = SINGLETON_CREW_ROLES.includes(role);
  return employees.map((employee) => {
    if (employee.id === employeeId) {
      return { ...employee, role };
    }
    if (isSingleton && resolveCrewRole(employee.role) === role) {
      return { ...employee, role: "helper" as RouteCrewRole };
    }
    return employee;
  });
}

export type Route = {
  id: string;
  routeId: string;
  name: string;
  date: string;
  tripNumber: number;
  vehicle: RouteVehicleRef;
  employees: RouteEmployeeRef[];
  active: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type RouteFormValues = {
  id: string;
  routeId: string;
  name: string;
  vehicle: RouteVehicleRef;
  employees: RouteEmployeeRef[];
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type RouteFilterState = {
  query: string;
  branchCode: string;
};

export type RouteListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
  branchCode?: string;
};

export type RouteSearchFilter = ApiListTextSearch;

export const DEFAULT_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "date:desc",
} as const satisfies RouteListParams;

/** Fields the bar search fans out across with an OR group. */
export const ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "routeId",
  "vehicle.name",
  "employees.name",
] as const;

export function createEmptyVehicleRef(): RouteVehicleRef {
  return { id: "", name: "" };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toRouteDateIso(dateInput: string): string {
  const trimmed = dateInput.trim();
  if (!trimmed) return "";
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00Z`;
}

export function toRouteDateInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function generateRouteNumber(): string {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `ras-${Date.now().toString(36)}-${random}`;
}

export function formatRouteEmployeeNames(employees: RouteEmployeeRef[]): string {
  return employees
    .map((employee) => employee.name.trim())
    .filter(Boolean)
    .join(", ");
}

export function createEmptyRouteForm(createdBy = DEFAULT_CREATED_BY): RouteFormValues {
  return {
    id: "",
    routeId: "",
    name: "",
    vehicle: createEmptyVehicleRef(),
    employees: [],
    active: true,
    createdBy,
    createdAt: "",
    updatedAt: "",
    updatedBy: "",
  };
}

export function routeToFormValues(assignment: Route): RouteFormValues {
  return {
    id: assignment.id,
    routeId: assignment.routeId,
    name: assignment.name,
    vehicle: { ...assignment.vehicle },
    employees: assignment.employees.map((employee) => ({ ...employee })),
    active: assignment.active,
    createdBy: assignment.createdBy,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    updatedBy: assignment.updatedBy,
  };
}

export function formValuesToRoute(
  values: RouteFormValues,
  createdAt?: string,
  updatedAt?: string,
  id?: string,
  existing?: Pick<Route, "date" | "tripNumber" | "routeId" | "name">,
): Route {
  if (!values.vehicle.id.trim()) {
    throw new Error("A vehicle is required.");
  }

  if (values.employees.length === 0) {
    throw new Error("Select at least one employee.");
  }

  const now = new Date().toISOString();

  return {
    id: id ?? (values.id.trim() || createMockObjectId()),
    routeId: existing?.routeId ?? values.routeId.trim(),
    name: existing?.name ?? values.name.trim(),
    date: existing?.date ?? "",
    tripNumber: existing?.tripNumber ?? 0,
    vehicle: {
      id: values.vehicle.id.trim(),
      name: values.vehicle.name.trim(),
      ...(values.vehicle.branch?.trim() ? { branch: values.vehicle.branch.trim() } : {}),
    },
    employees: values.employees.map((employee) => ({
      id: employee.id,
      name: employee.name.trim(),
      role: resolveCrewRole(employee.role),
    })),
    active: values.active,
    createdAt: createdAt ?? (values.createdAt || now),
    createdBy: values.createdBy.trim() || DEFAULT_CREATED_BY,
    updatedAt: updatedAt ?? (values.updatedAt || now),
    updatedBy: values.updatedBy?.trim() || DEFAULT_CREATED_BY,
  };
}
