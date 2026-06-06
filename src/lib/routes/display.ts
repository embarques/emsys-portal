import type { RoutePlace, RoutePlaceKind, RouteRecord, RouteBranch } from "./types";
import { ROUTE_PLACE_KINDS } from "./types";
import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";

export function getRouteBranchLabel(branch: RouteBranch): string {
  return getBranchLabel(branch);
}

export function getRouteBranchBadgeClass(branch: RouteBranch): string {
  return getBranchBadgeClass(branch);
}

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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatPlaceLabel(place: RoutePlace): string {
  return `${getPlaceKindLabel(place.kind)}: ${place.value}`;
}

export function formatRoutePlacesSummary(route: RouteRecord, limit = 3): string {
  if (route.places.length === 0) return "—";
  const visible = route.places.slice(0, limit).map((place) => place.value);
  const suffix = route.places.length > limit ? ` (+${route.places.length - limit})` : "";
  return `${visible.join(", ")}${suffix}`;
}

export function truncateRouteId(routeId: string): string {
  return routeId.length > 12 ? `${routeId.slice(0, 8)}…` : routeId;
}

export function routeMatchesQuery(route: RouteRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const placeText = route.places
    .map((place) => `${getPlaceKindLabel(place.kind)} ${place.value}`)
    .join(" ");

  return [route.routeId, route.name, getRouteBranchLabel(route.branch), placeText, formatRouteDate(route.createdAt)]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeRouteKpis(routes: RouteRecord[]) {
  return {
    total: routes.length,
    usa: routes.filter((route) => route.branch === "usa").length,
    dr: routes.filter((route) => route.branch === "dr").length,
  };
}
