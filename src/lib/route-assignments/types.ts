import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createMockObjectId } from "@/lib/vehicles/types";
import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";

export type RouteAssignmentVehicleRef = {
  id: string;
  name: string;
};

export type RouteAssignmentEmployeeGroupRef = {
  id: string;
  name: string;
};

export type RouteAssignment = {
  id: string;
  routeAssignmentId: string;
  name: string;
  date: string;
  vehicle: RouteAssignmentVehicleRef;
  employeeGroup: RouteAssignmentEmployeeGroupRef;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type RouteAssignmentFormValues = {
  id: string;
  routeAssignmentId: string;
  name: string;
  date: string;
  vehicle: RouteAssignmentVehicleRef;
  employeeGroup: RouteAssignmentEmployeeGroupRef;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RouteAssignmentFilterState = {
  query: string;
};

export type RouteAssignmentListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
};

export type RouteAssignmentSearchFilter = ApiListTextSearch;

export const DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "date:desc",
} as const satisfies RouteAssignmentListParams;

/** Fields the bar search fans out across with an OR group. */
export const ROUTE_ASSIGNMENT_BAR_OR_SEARCH_FIELDS = [
  "name",
  "routeAssignmentId",
  "vehicle.name",
  "employeeGroup.name",
] as const;

export function createEmptyVehicleRef(): RouteAssignmentVehicleRef {
  return { id: "", name: "" };
}

export function createEmptyEmployeeGroupRef(): RouteAssignmentEmployeeGroupRef {
  return { id: "", name: "" };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toRouteAssignmentDateIso(dateInput: string): string {
  const trimmed = dateInput.trim();
  if (!trimmed) return "";
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00Z`;
}

export function toRouteAssignmentDateInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function generateRouteAssignmentNumber(): string {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `ras-${Date.now().toString(36)}-${random}`;
}

export function createEmptyRouteAssignmentForm(createdBy = DEFAULT_CREATED_BY): RouteAssignmentFormValues {
  return {
    id: "",
    routeAssignmentId: generateRouteAssignmentNumber(),
    name: "",
    date: todayDateInputValue(),
    vehicle: createEmptyVehicleRef(),
    employeeGroup: createEmptyEmployeeGroupRef(),
    createdBy,
    createdAt: "",
    updatedAt: "",
  };
}

export function routeAssignmentToFormValues(assignment: RouteAssignment): RouteAssignmentFormValues {
  return {
    id: assignment.id,
    routeAssignmentId: assignment.routeAssignmentId,
    name: assignment.name,
    date: toRouteAssignmentDateInput(assignment.date),
    vehicle: { ...assignment.vehicle },
    employeeGroup: { ...assignment.employeeGroup },
    createdBy: assignment.createdBy,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

export function formValuesToRouteAssignment(
  values: RouteAssignmentFormValues,
  createdAt?: string,
  updatedAt?: string,
  id?: string,
): RouteAssignment {
  if (!values.employeeGroup.id.trim()) {
    throw new Error("An employee group is required.");
  }

  const now = new Date().toISOString();

  return {
    id: id ?? (values.id.trim() || createMockObjectId()),
    routeAssignmentId: values.routeAssignmentId.trim(),
    name: values.name.trim(),
    date: toRouteAssignmentDateIso(values.date),
    vehicle: {
      id: values.vehicle.id.trim(),
      name: values.vehicle.name.trim(),
    },
    employeeGroup: {
      id: values.employeeGroup.id.trim(),
      name: values.employeeGroup.name.trim(),
    },
    createdAt: createdAt ?? (values.createdAt || now),
    createdBy: values.createdBy.trim() || DEFAULT_CREATED_BY,
    updatedAt: updatedAt ?? (values.updatedAt || now),
  };
}

export function copyRouteAssignmentFormValues(
  source: RouteAssignment,
  createdBy = DEFAULT_CREATED_BY,
): RouteAssignmentFormValues {
  return {
    id: "",
    routeAssignmentId: generateRouteAssignmentNumber(),
    name: source.name,
    date: todayDateInputValue(),
    vehicle: { ...source.vehicle },
    employeeGroup: { ...source.employeeGroup },
    createdBy,
    createdAt: "",
    updatedAt: "",
  };
}
