import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { getActiveRouteAppraiser } from "@/lib/pickup-delivery-routes/types";
import type { Route } from "@/lib/route-manager/types";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";
import { formatRouteDate } from "@/lib/route-manager/display";
import { resolveCrewRole } from "@/lib/route-manager/types";

/** Names of every crew member acting as a driver (or unassigned). */
export function formatActiveRouteDriverNames(record: ActiveRoute): string {
  return record.employees
    .filter((employee) => resolveCrewRole(employee.role) === "driver")
    .map((employee) => employee.name)
    .join(", ");
}

/** Name of the appraiser assigned to the route, if any. */
export function formatActiveRouteAppraiserName(record: ActiveRoute): string {
  return getActiveRouteAppraiser(record)?.name ?? "";
}

export function formatActiveRouteTypeLabel(
  routeType: ActiveRoute["routeType"],
  t: (key: string) => string,
): string {
  return routeType === "delivery"
    ? t("routes.activeRoute.routeTypeDelivery")
    : t("routes.activeRoute.routeTypePickup");
}

export function formatActiveRouteContainerLabel(
  record: ActiveRoute | null | undefined,
  emptyValue = "—",
): string {
  return record?.container?.name?.trim() || emptyValue;
}

/** Linked route manager assignment name for the Route table column. */
export function formatActiveRouteRouteName(
  record: ActiveRoute,
  getRouteByKey?: (key: string | undefined) => Pick<Route, "name" | "routeId"> | undefined,
  emptyValue = "—",
): string {
  const linked = record.route;
  if (!linked?.id) return emptyValue;

  const resolved =
    getRouteByKey?.(linked.id) ??
    (linked.routeId ? getRouteByKey?.(linked.routeId) : undefined);

  const resolvedName = resolved?.name.trim();
  if (resolvedName) return resolvedName;

  const embeddedName = String(linked.name ?? "").trim();
  if (embeddedName && embeddedName !== linked.id) return embeddedName;

  const routeId = String(linked.routeId ?? resolved?.routeId ?? "").trim();
  return routeId || embeddedName || linked.id || emptyValue;
}

export function formatActiveRouteRowLabel(
  record: ActiveRoute | null | undefined,
  emptyValue = "—",
): string {
  if (!record) return emptyValue;

  const name = String(record.name ?? "").trim();
  const routeName = String(record.route?.name ?? "").trim();
  return name || routeName || record.id || emptyValue;
}

/** Label for pickup/delivery route assignment pickers. */
export function formatActiveRouteAssignmentLabel(record: ActiveRoute): string {
  const name = formatActiveRouteRowLabel(record);
  const date = formatRouteDate(record.date);
  const container = record.container?.name?.trim();

  if (container) {
    return `${name} · ${date} · ${container}`;
  }

  return `${name} · ${date}`;
}

function compareActiveRoutesByDateDesc(left: ActiveRoute, right: ActiveRoute): number {
  const byDate = right.date.localeCompare(left.date);
  if (byDate !== 0) return byDate;
  return formatActiveRouteRowLabel(left).localeCompare(formatActiveRouteRowLabel(right));
}

/** Searchable options for assigning pickups or invoice barcodes to scheduled routes. */
export function buildActiveRouteAssignmentOptions(
  records: ActiveRoute[],
): TableFilterFieldOption[] {
  return [...records].sort(compareActiveRoutesByDateDesc).map((record) => ({
    value: record.id,
    label: formatActiveRouteAssignmentLabel(record),
    keywords: [
      record.name,
      record.route?.name,
      record.route?.routeId,
      record.date,
      record.container?.name,
      ...record.employees.map((employee) => employee.name),
    ].filter((value): value is string => Boolean(value?.trim())),
  }));
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

export function activeRouteMatchesSearch(
  record: ActiveRoute,
  search: { field: string; operator: string; value: string },
): boolean {
  const query = search.value.trim();
  if (!query) return true;

  const fieldValue = (() => {
    switch (search.field) {
      case "name":
        return String(record.name ?? "");
      case "date":
        return record.date;
      case "route.name":
        return String(record.route?.name ?? "");
      case "employees.name":
        return record.employees.map((employee) => employee.name).join(" ");
      case "driver.name":
      case "drivers.name":
        return formatActiveRouteDriverNames(record);
      case "appraiser.name":
        return formatActiveRouteAppraiserName(record);
      case "container.name":
        return record.container?.name ?? "";
      case "createdBy":
        return record.createdBy;
      default:
        return "";
    }
  })();

  return matchesSearchOperator(fieldValue, query, search.operator);
}

export function activeRouteMatchesQuery(record: ActiveRoute, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    record.id,
    String(record.name ?? ""),
    record.date,
    formatRouteDate(record.date),
    String(record.route?.name ?? ""),
    record.route?.routeId ?? "",
    record.employees.map((employee) => employee.name).join(" "),
    record.container?.name ?? "",
    record.createdBy,
    record.routeType,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}
