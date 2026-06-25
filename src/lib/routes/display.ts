import type { RoutePlaceKind, RouteRecord } from "./types";
import { ROUTE_PLACE_KINDS } from "./types";

export function getPlaceKindLabel(kind: RoutePlaceKind): string {
  return ROUTE_PLACE_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

export function getPlaceKindBadgeClass(kind: RoutePlaceKind): string {
  switch (kind) {
    case "city":
      return "border-transparent bg-primary/15 text-primary";
    case "state":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "zip":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "zip_range":
      return "border-transparent bg-secondary text-secondary-foreground";
    default:
      return "";
  }
}

export function formatRouteDate(iso: string): string {
  if (!iso?.trim()) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function truncateRouteId(routeId: string): string {
  return routeId.length > 12 ? `${routeId.slice(0, 8)}…` : routeId;
}

export function formatRouteCity(city: { cityName: string; stateCode: string }): string {
  return city.stateCode.trim() ? `${city.cityName}, ${city.stateCode}` : city.cityName;
}

export function formatRouteZipRange(range: { start: string; end: string }): string {
  return `${range.start}–${range.end}`;
}

/** Flattened, human-readable list of every place on a route. */
export function getRoutePlaceValues(route: RouteRecord): string[] {
  return [
    ...route.cities.map(formatRouteCity),
    ...route.states,
    ...route.zipCodes,
    ...route.zipRanges.map(formatRouteZipRange),
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

export function countRoutePlaces(route: RouteRecord): number {
  return route.cities.length + route.states.length + route.zipCodes.length + route.zipRanges.length;
}

/** The content kinds present on a route, in display order. */
export function getRouteKinds(route: RouteRecord): RoutePlaceKind[] {
  const kinds: RoutePlaceKind[] = [];
  if (route.cities.length > 0) kinds.push("city");
  if (route.states.length > 0) kinds.push("state");
  if (route.zipCodes.length > 0) kinds.push("zip");
  if (route.zipRanges.length > 0) kinds.push("zip_range");
  return kinds;
}

export function formatRoutePlacesSummary(route: RouteRecord, limit = 3): string {
  const values = getRoutePlaceValues(route);
  if (values.length === 0) return "—";
  const visible = values.slice(0, limit);
  const suffix = values.length > limit ? ` (+${values.length - limit})` : "";
  return `${visible.join(", ")}${suffix}`;
}

export function computeRouteKpis(routes: RouteRecord[]) {
  return {
    total: routes.length,
    cities: routes.reduce((sum, route) => sum + route.cities.length, 0),
    states: routes.reduce((sum, route) => sum + route.states.length, 0),
    zipRules: routes.reduce((sum, route) => sum + route.zipCodes.length + route.zipRanges.length, 0),
  };
}
