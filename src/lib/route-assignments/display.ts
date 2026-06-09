import { getEmployeeGroupById } from "@/lib/employee-groups/mock-data";
import { getEmployeeGroupBranchLabel } from "@/lib/employee-groups/display";
import type { EmployeeGroup } from "@/lib/employee-groups/types";
import { getTruckById, getTruckByRecordId } from "@/lib/trucks/mock-data";
import type { RouteAssignment, RouteAssignmentEmployeeGroupRef, RouteAssignmentTruckRef } from "./types";
import { toRouteAssignmentDateInput } from "./types";

export function formatRouteAssignmentDate(date: string): string {
  const input = toRouteAssignmentDateInput(date) || date;
  if (!input) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${input}T12:00:00`));
}

export function formatRouteAssignmentTimestamp(iso: string): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function truncateRouteAssignmentId(routeAssignmentId: string): string {
  return routeAssignmentId.length > 12 ? `${routeAssignmentId.slice(0, 8)}…` : routeAssignmentId;
}

export function truncateObjectId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function formatEmployeeGroupRefName(group: EmployeeGroup): string {
  return `${group.employeeGroupId} · ${getEmployeeGroupBranchLabel(group.branch)} · ${group.employeeIds.length} employees`;
}

export function getTruckRefLabel(truck: RouteAssignmentTruckRef): string {
  if (!truck.id && !truck.name) return "—";

  const record = truck.id ? (getTruckByRecordId(truck.id) ?? getTruckById(truck.id)) : undefined;
  const name = truck.name || record?.name;
  const branch = record?.branch;

  if (name && branch) {
    return `${name} (${branch.toUpperCase()})`;
  }

  return name || truck.id || "—";
}

export function getEmployeeGroupRefLabel(group: RouteAssignmentEmployeeGroupRef): string {
  if (!group.id && !group.name) return "—";
  if (group.name) return group.name;

  const record = group.id ? getEmployeeGroupById(group.id) : undefined;
  if (!record) return group.id || "—";

  return formatEmployeeGroupRefName(record);
}

/** @deprecated Use getTruckRefLabel */
export function getTruckName(truckId: string): string {
  return getTruckRefLabel({ id: truckId, name: "" });
}

/** @deprecated Use getEmployeeGroupRefLabel */
export function getEmployeeGroupLabel(employeeGroupId: string): string {
  return getEmployeeGroupRefLabel({ id: employeeGroupId, name: "" });
}

export function formatRouteAssignmentCopyLabel(assignment: RouteAssignment): string {
  return `${assignment.name} · ${formatRouteAssignmentDate(assignment.date)} · ${getTruckRefLabel(assignment.truck)}`;
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

export function routeAssignmentMatchesSearch(
  assignment: RouteAssignment,
  search: { field: string; operator: string; value: string },
): boolean {
  const query = search.value.trim();
  if (!query) return true;

  const fieldValue = (() => {
    switch (search.field) {
      case "id":
        return assignment.id;
      case "routeAssignmentId":
        return assignment.routeAssignmentId;
      case "name":
        return assignment.name;
      case "date":
        return assignment.date;
      case "truck.id":
        return assignment.truck.id;
      case "truck.name":
        return assignment.truck.name;
      case "employeeGroup.id":
        return assignment.employeeGroup.id;
      case "employeeGroup.name":
        return assignment.employeeGroup.name;
      case "createdBy":
        return assignment.createdBy;
      default:
        return "";
    }
  })();

  return matchesSearchOperator(fieldValue, query, search.operator);
}

export function routeAssignmentMatchesQuery(assignment: RouteAssignment, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    assignment.id,
    assignment.routeAssignmentId,
    assignment.name,
    assignment.date,
    assignment.createdBy,
    assignment.truck.id,
    assignment.truck.name,
    getTruckRefLabel(assignment.truck),
    assignment.employeeGroup.id,
    assignment.employeeGroup.name,
    getEmployeeGroupRefLabel(assignment.employeeGroup),
    formatRouteAssignmentDate(assignment.date),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeRouteAssignmentKpis(assignments: RouteAssignment[]) {
  const uniqueTrucks = new Set(assignments.map((assignment) => assignment.truck.id).filter(Boolean)).size;
  const uniqueGroups = new Set(assignments.map((assignment) => assignment.employeeGroup.id).filter(Boolean)).size;

  return {
    total: assignments.length,
    uniqueTrucks,
    uniqueGroups,
  };
}
