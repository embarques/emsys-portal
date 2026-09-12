import type { Route, RouteEmployeeRef, RouteVehicleRef } from "./types";
import { formatRouteEmployeeNames, getRouteBranchCode, toRouteDateInput } from "./types";
import { formatAuditDateTime } from "@/lib/audit/display";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";
import { getVehiclePortalBranch } from "@/lib/vehicles/types";

export function formatRouteDate(date: string): string {
  const input = toRouteDateInput(date) || date;
  if (!input) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${input}T12:00:00`));
}

/** Route audit timestamps use date+time. */
export function formatRouteTimestamp(iso: string): string {
  return formatAuditDateTime(iso);
}

export function truncateRouteId(routeId: string): string {
  return routeId.length > 12 ? `${routeId.slice(0, 8)}…` : routeId;
}

export function truncateObjectId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** Display name for a route crew: server name, else crew members. */
export function formatRouteName(assignment: Route): string {
  const name = assignment.name.trim();
  if (name) return name;
  const crew = formatRouteEmployeeNames(assignment.employees);
  return crew || assignment.routeId.trim() || "—";
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

export function getRouteEmployeesLabel(employees: RouteEmployeeRef[]): string {
  const label = formatRouteEmployeeNames(employees);
  return label || "—";
}

export function formatRouteCopyLabel(assignment: Route): string {
  const parts = [
    assignment.name.trim(),
    getRouteEmployeesLabel(assignment.employees),
    getRouteBranchCode(assignment),
  ].filter((part): part is string => Boolean(part?.trim()) && part !== "—");

  if (parts.length > 0) return parts.join(" · ");

  return assignment.routeId.trim() || assignment.id || "—";
}

/** Primary label for route assignment pickers (name only). */
export function formatRouteAssignmentName(assignment: Route): string {
  const name = assignment.name.trim();
  if (name) return name;
  return assignment.routeId.trim() || assignment.id || "—";
}

/** Secondary lines for route-crew pickers (branch, crew). */
export function formatRouteAssignmentDescriptionLines(assignment: Route): string[] {
  const lines: string[] = [];
  const branch = getRouteBranchCode(assignment);
  if (branch) lines.push(branch);
  const crew = getRouteEmployeesLabel(assignment.employees);
  if (crew && crew !== "—") lines.push(crew);
  return lines;
}

/** Sort routes chronologically (earliest first), then by name. */
export function compareRoutesByDateAsc(a: Route, b: Route): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  return a.name.localeCompare(b.name);
}

/** Searchable route picker options for table filters and assignment dialogs. */
export function buildRouteFilterOptions(routes: Route[]): TableFilterFieldOption[] {
  return [...routes].sort(compareRoutesByDateAsc).map((route) => ({
    value: route.id,
    label: formatRouteCopyLabel(route),
  }));
}

/** A route crew belongs to the DR branch when its branch is DR. */
export function isDrRoute(assignment: Route): boolean {
  const branch = getRouteBranchCode(assignment);
  if (!branch) return false;
  return getVehiclePortalBranch(branch) === "dr";
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
      case "branch.code":
        return getRouteBranchCode(assignment);
      case "date":
        return assignment.date;
      case "vehicle.id":
        return assignment.vehicle.id;
      case "vehicle.name":
        return assignment.vehicle.name;
      case "employees.name":
        return formatRouteEmployeeNames(assignment.employees);
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
    getRouteBranchCode(assignment),
    assignment.vehicle.id,
    assignment.vehicle.name,
    formatRouteEmployeeNames(assignment.employees),
    formatRouteDate(assignment.date),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeRouteKpis(assignments: Route[]) {
  const uniqueVehicles = new Set(assignments.map((assignment) => assignment.vehicle.id).filter(Boolean)).size;
  const uniqueEmployees = new Set(
    assignments.flatMap((assignment) => assignment.employees.map((employee) => employee.id)),
  ).size;

  return {
    total: assignments.length,
    uniqueVehicles,
    uniqueEmployees,
  };
}
