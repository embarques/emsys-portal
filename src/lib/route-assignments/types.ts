import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createMockObjectId } from "@/lib/vehicles/types";

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

export type RouteAssignmentSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type RouteAssignmentSearchField =
  | "id"
  | "routeAssignmentId"
  | "name"
  | "date"
  | "vehicle.id"
  | "vehicle.name"
  | "employeeGroup.id"
  | "employeeGroup.name"
  | "createdBy";

export type RouteAssignmentSearchFilter = {
  field: RouteAssignmentSearchField;
  operator: RouteAssignmentSearchOperator;
  value: string;
};

export const ROUTE_ASSIGNMENT_GET_SEARCH_CAPABILITIES: {
  field: RouteAssignmentSearchField;
  label: string;
  operators: RouteAssignmentSearchOperator[];
}[] = [
  { field: "routeAssignmentId", label: "routeAssignmentId", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "name", label: "name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "date", label: "date", operators: ["eq", "neq"] },
  { field: "vehicle.id", label: "vehicle.id", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "vehicle.name", label: "vehicle.name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "employeeGroup.id", label: "employeeGroup.id", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "employeeGroup.name", label: "employeeGroup.name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "createdBy", label: "createdBy", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "id", label: "Assignment ID", operators: ["eq", "neq"] },
];

export const ROUTE_ASSIGNMENT_SEARCH_FIELDS: { value: RouteAssignmentSearchField; label: string }[] =
  ROUTE_ASSIGNMENT_GET_SEARCH_CAPABILITIES.map(({ field, label }) => ({ value: field, label }));

export const ROUTE_ASSIGNMENT_SEARCH_OPERATORS: { value: RouteAssignmentSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export function getRouteAssignmentSearchOperatorsForField(
  field: RouteAssignmentSearchField,
): RouteAssignmentSearchOperator[] {
  return ROUTE_ASSIGNMENT_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === field)?.operators ?? ["eq"];
}

export function getDefaultRouteAssignmentSearchOperator(field: RouteAssignmentSearchField): RouteAssignmentSearchOperator {
  return getRouteAssignmentSearchOperatorsForField(field)[0];
}

export function createRouteAssignmentSearchFilter(value: string): RouteAssignmentSearchFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return { field: "name", operator: "contains", value: trimmed };
}

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

export function createEmptyRouteAssignmentForm(createdBy = DEFAULT_CREATED_BY): RouteAssignmentFormValues {
  return {
    id: "",
    routeAssignmentId: "",
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
    routeAssignmentId: "",
    name: source.name,
    date: todayDateInputValue(),
    vehicle: { ...source.vehicle },
    employeeGroup: { ...source.employeeGroup },
    createdBy,
    createdAt: "",
    updatedAt: "",
  };
}
