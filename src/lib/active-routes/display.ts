import type { ActiveRoute } from "@/lib/active-routes/types";
import { formatRouteDate } from "@/lib/routes/display";

export function formatActiveRouteTypeLabel(
  routeType: ActiveRoute["routeType"],
  t: (key: string) => string,
): string {
  return routeType === "delivery"
    ? t("routes.activeRoute.routeTypeDelivery")
    : t("routes.activeRoute.routeTypePickup");
}

export function formatActiveRouteContainerLabel(record: ActiveRoute | null | undefined): string {
  return record?.container?.name?.trim() || "—";
}

export function formatActiveRouteRowLabel(record: ActiveRoute | null | undefined): string {
  if (!record) return "—";

  const name = String(record.name ?? "").trim();
  const routeName = String(record.route?.name ?? "").trim();
  return name || routeName || record.id || "—";
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
      case "driver.name":
        return record.driver?.name ?? "";
      case "appraiser.name":
        return record.appraiser?.name ?? "";
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
    record.driver?.name ?? "",
    record.appraiser?.name ?? "",
    record.container?.name ?? "",
    record.createdBy,
    record.routeType,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}
