import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { DAYS_OF_WEEK } from "@/lib/pickup-delivery-routes/types";
import {
  getActiveRouteAppraisers,
  getActiveRouteEmployeesByRole,
  getActiveRouteHelpers,
} from "@/lib/pickup-delivery-routes/types";
import type { Route } from "@/lib/route-manager/types";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";
import { formatRouteDate } from "@/lib/route-manager/display";

/** Names of every crew member acting as a driver. */
export function formatActiveRouteDriverNames(record: ActiveRoute): string {
  return formatEmployeeNames(getActiveRouteEmployeesByRole(record, "driver"));
}

function formatEmployeeNames(employees: { name: string }[]): string {
  return employees.map((employee) => employee.name).join(", ");
}

/** Names of every crew member acting as appraiser. */
export function formatActiveRouteAppraiserName(record: ActiveRoute): string {
  return formatEmployeeNames(getActiveRouteAppraisers(record));
}

/** Names of every crew member acting as helper. */
export function formatActiveRouteHelperNames(record: ActiveRoute): string {
  return formatEmployeeNames(getActiveRouteHelpers(record));
}

export function formatActiveRouteRateLabel(
  record: Pick<ActiveRoute, "rate">,
  emptyValue = "—",
): string {
  if (record.rate == null || !Number.isFinite(record.rate)) return emptyValue;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(record.rate);
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

export function formatActiveRouteVehicleLabel(
  record: ActiveRoute | null | undefined,
  emptyValue = "—",
): string {
  const name = record?.vehicle?.name?.trim();
  if (name) return name;
  return record?.vehicle?.id?.trim() || emptyValue;
}

export function formatPreviousDailyRouteLabel(
  record: ActiveRoute,
  emptyValue = "—",
): string {
  const date = record.date ? formatRouteDate(record.date) : emptyValue;
  const branch = record.branch?.code?.trim() || emptyValue;
  const crew = record.route.name.trim() || emptyValue;
  return `${date} · ${branch} · ${crew}`;
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
  t?: (key: string) => string,
): string {
  if (!record) return emptyValue;
  return formatActiveRouteReferenceLabel(record, t, emptyValue);
}

/** Schedule portion of a pickup/delivery route label (date or recurring weekdays). */
export function formatActiveRouteScheduleLabel(
  record: ActiveRoute,
  t?: (key: string) => string,
  emptyValue = "",
): string {
  if (record.date?.trim()) {
    return formatRouteDate(record.date);
  }

  if (record.dayOfWeek.length > 0) {
    const days = record.dayOfWeek;
    const isEveryDay =
      days.length === DAYS_OF_WEEK.length &&
      DAYS_OF_WEEK.every((day) => days.includes(day));

    if (isEveryDay) {
      return t?.("routes.activeRoute.days.everyDay") ?? "Every day";
    }

    if (t) {
      return days.map((day) => t(`routes.activeRoute.days.${day}`)).join(", ");
    }

    return days
      .map((day) => day.slice(0, 3).replace(/^./, (character) => character.toUpperCase()))
      .join(", ");
  }

  return emptyValue;
}

/**
 * Human-readable pickup/delivery route reference: schedule · route manager name · container.
 * Used in assignment pickers, order route columns, and feedback toasts.
 */
export function formatActiveRouteReferenceLabel(
  record: ActiveRoute,
  t?: (key: string) => string,
  emptyValue = "—",
): string {
  const schedule = formatActiveRouteScheduleLabel(record, t, "");
  const routeName = record.route?.name?.trim();
  const container = record.container?.name?.trim();
  const parts = [schedule, routeName, container].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  const name = String(record.name ?? "").trim();
  return name || record.id || emptyValue;
}

/** Report ids from vehicle-route directory rows (`GET /vehicle-routes`). */
export function resolveActiveRouteReportIds(
  records: readonly ActiveRoute[],
  selectedIds: readonly string[],
): string[] {
  const idByRecord = new Map(records.map((record) => [record.id, record.id.trim()]));

  return selectedIds
    .map((selectedId) => idByRecord.get(selectedId) ?? selectedId.trim())
    .filter(Boolean);
}

/** Label for pickup/delivery route assignment pickers. */
export function formatActiveRouteAssignmentLabel(
  record: ActiveRoute,
  t?: (key: string) => string,
): string {
  return formatActiveRouteReferenceLabel(record, t);
}

function compareActiveRoutesByDateDesc(left: ActiveRoute, right: ActiveRoute): number {
  const byDate = right.date.localeCompare(left.date);
  if (byDate !== 0) return byDate;
  return formatActiveRouteRowLabel(left).localeCompare(formatActiveRouteRowLabel(right));
}

/** Searchable options for assigning pickups or invoice barcodes to scheduled routes. */
export function buildActiveRouteAssignmentOptions(
  records: ActiveRoute[],
  t?: (key: string) => string,
): TableFilterFieldOption[] {
  return [...records].sort(compareActiveRoutesByDateDesc).map((record) => ({
    value: record.id,
    label: formatActiveRouteAssignmentLabel(record, t),
    keywords: [
      record.name,
      record.route?.name,
      record.route?.routeId,
      record.date,
      record.container?.name,
      record.vehicle?.name,
      record.vehicle?.id,
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
      case "helper.name":
      case "helpers.name":
        return formatActiveRouteHelperNames(record);
      case "container.name":
      case "container.number":
        return record.container?.name ?? "";
      case "vehicle.name":
        return record.vehicle?.name ?? "";
      case "vehicle.id":
        return record.vehicle?.id ?? "";
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
    record.vehicle?.name ?? "",
    record.vehicle?.id ?? "",
    record.createdBy,
    record.routeType,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}
