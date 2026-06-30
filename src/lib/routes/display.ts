import type { Route, RouteEmployeeGroupRef, RouteVehicleRef } from "./types";
import { toRouteDateInput } from "./types";

export function formatRouteDate(date: string): string {
  const input = toRouteDateInput(date) || date;
  if (!input) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${input}T12:00:00`));
}

export function formatRouteTimestamp(iso: string): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function truncateRouteId(routeId: string): string {
  return routeId.length > 12 ? `${routeId.slice(0, 8)}…` : routeId;
}

export function truncateObjectId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** Display name for a route: `date - employee group - vehicle name`. */
export function formatRouteName(assignment: Route): string {
  const parts = [
    formatRouteDate(assignment.date),
    assignment.employeeGroup.name,
    assignment.vehicle.name,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part) && part !== "—");

  return parts.length > 0 ? parts.join(" - ") : assignment.name.trim() || "—";
}

/** Default route name on create: `date · employee names · vehicle`. */
export function buildDefaultRouteName(
  date: string,
  employeeNames: string,
  vehicleName: string,
): string {
  return [formatRouteDate(date), employeeNames, vehicleName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part) && part !== "—")
    .join(" · ");
}

export function getVehicleRefLabel(vehicle: RouteVehicleRef): string {
  if (!vehicle.id && !vehicle.name) return "—";
  return vehicle.name || vehicle.id || "—";
}

export function getEmployeeGroupRefLabel(group: RouteEmployeeGroupRef): string {
  if (!group.id && !group.name) return "—";
  return group.name || group.id || "—";
}

export function formatRouteCopyLabel(assignment: Route): string {
  return `${assignment.name} · ${formatRouteDate(assignment.date)} · ${getVehicleRefLabel(assignment.vehicle)}`;
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

export function routeMatchesSearch(
  assignment: Route,
  search: { field: string; operator: string; value: string },
): boolean {
  const query = search.value.trim();
  if (!query) return true;

  const fieldValue = (() => {
    switch (search.field) {
      case "id":
        return assignment.id;
      case "routeId":
        return assignment.routeId;
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

export function routeMatchesQuery(assignment: Route, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    assignment.id,
    assignment.routeId,
    assignment.name,
    assignment.date,
    assignment.createdBy,
    assignment.vehicle.id,
    assignment.vehicle.name,
    getVehicleRefLabel(assignment.vehicle),
    assignment.employeeGroup.id,
    assignment.employeeGroup.name,
    getEmployeeGroupRefLabel(assignment.employeeGroup),
    formatRouteDate(assignment.date),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeRouteKpis(assignments: Route[]) {
  const uniqueVehicles = new Set(assignments.map((assignment) => assignment.vehicle.id).filter(Boolean)).size;
  const uniqueGroups = new Set(assignments.map((assignment) => assignment.employeeGroup.id).filter(Boolean)).size;

  return {
    total: assignments.length,
    uniqueVehicles,
    uniqueGroups,
  };
}
