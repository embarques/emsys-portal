import { getEmployeeGroupById } from "@/lib/employee-groups/mock-data";
import { getEmployeeGroupBranchLabel } from "@/lib/employee-groups/display";
import type { EmployeeGroup } from "@/lib/employee-groups/types";
import { getVehicleById, getVehicleByRecordId } from "@/lib/vehicles/mock-data";
import type { RouteAssignment, RouteAssignmentEmployeeGroupRef, RouteAssignmentVehicleRef } from "./types";
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

export function getVehicleRefLabel(vehicle: RouteAssignmentVehicleRef): string {
  if (!vehicle.id && !vehicle.name) return "—";

  const record = vehicle.id ? (getVehicleByRecordId(vehicle.id) ?? getVehicleById(vehicle.id)) : undefined;
  const name = vehicle.name || record?.name;
  const branch = record?.branch;

  if (name && branch) {
    return `${name} (${branch.toUpperCase()})`;
  }

  return name || vehicle.id || "—";
}

export function getEmployeeGroupRefLabel(group: RouteAssignmentEmployeeGroupRef): string {
  if (!group.id && !group.name) return "—";
  if (group.name) return group.name;

  const record = group.id ? getEmployeeGroupById(group.id) : undefined;
  if (!record) return group.id || "—";

  return formatEmployeeGroupRefName(record);
}

/** @deprecated Use getVehicleRefLabel */
export function getVehicleName(vehicleId: string): string {
  return getVehicleRefLabel({ id: vehicleId, name: "" });
}

/** @deprecated Use getEmployeeGroupRefLabel */
export function getEmployeeGroupLabel(employeeGroupId: string): string {
  return getEmployeeGroupRefLabel({ id: employeeGroupId, name: "" });
}

export function formatRouteAssignmentCopyLabel(assignment: RouteAssignment): string {
  return `${assignment.name} · ${formatRouteAssignmentDate(assignment.date)} · ${getVehicleRefLabel(assignment.vehicle)}`;
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
      case "vehicle.id":
        return assignment.vehicle.id;
      case "vehicle.name":
        return assignment.vehicle.name;
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
    assignment.vehicle.id,
    assignment.vehicle.name,
    getVehicleRefLabel(assignment.vehicle),
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
  const uniqueVehicles = new Set(assignments.map((assignment) => assignment.vehicle.id).filter(Boolean)).size;
  const uniqueGroups = new Set(assignments.map((assignment) => assignment.employeeGroup.id).filter(Boolean)).size;

  return {
    total: assignments.length,
    uniqueVehicles,
    uniqueGroups,
  };
}
