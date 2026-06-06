import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type RouteAssignment = {
  routeAssignmentId: string;
  name: string;
  date: string;
  truckId: string;
  employeeGroupId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type RouteAssignmentFormValues = {
  routeAssignmentId: string;
  name: string;
  date: string;
  truckId: string;
  employeeGroupId: string;
  createdBy: string;
};

export type RouteAssignmentFilterState = {
  query: string;
};

export function createRouteAssignmentId(): string {
  return crypto.randomUUID();
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyRouteAssignmentForm(createdBy = DEFAULT_CREATED_BY): RouteAssignmentFormValues {
  return {
    routeAssignmentId: createRouteAssignmentId(),
    name: "",
    date: todayDateInputValue(),
    truckId: "",
    employeeGroupId: "",
    createdBy,
  };
}

export function routeAssignmentToFormValues(assignment: RouteAssignment): RouteAssignmentFormValues {
  return {
    routeAssignmentId: assignment.routeAssignmentId,
    name: assignment.name,
    date: assignment.date.slice(0, 10),
    truckId: assignment.truckId,
    employeeGroupId: assignment.employeeGroupId,
    createdBy: assignment.createdBy,
  };
}

export function formValuesToRouteAssignment(
  values: RouteAssignmentFormValues,
  createdAt?: string,
  updatedAt?: string
): RouteAssignment {
  if (!values.truckId) {
    throw new Error("A truck is required.");
  }

  if (!values.employeeGroupId) {
    throw new Error("An employee group is required.");
  }

  return {
    routeAssignmentId: values.routeAssignmentId,
    name: values.name.trim(),
    date: values.date,
    truckId: values.truckId,
    employeeGroupId: values.employeeGroupId,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: values.createdBy.trim() || DEFAULT_CREATED_BY,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function copyRouteAssignmentFormValues(
  source: RouteAssignment,
  createdBy = DEFAULT_CREATED_BY
): RouteAssignmentFormValues {
  return {
    routeAssignmentId: createRouteAssignmentId(),
    name: source.name,
    date: todayDateInputValue(),
    truckId: source.truckId,
    employeeGroupId: source.employeeGroupId,
    createdBy,
  };
}
