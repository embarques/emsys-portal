/** Blue is reserved for appointments without a route. */
export const UNASSIGNED_PICKUP_COLOR = "#2563eb";

const ROUTE_COLORS = [
  "#7c3aed", "#059669", "#db2777", "#0891b2",
  "#b45309", "#dc2626", "#4d7c0f", "#475569",
];

/** Allocate distinct colors within the plotted route set, independently of stop order or selection. */
export function buildPickupRouteColors(routeIds: readonly (string | undefined)[]): Map<string, string> {
  const ids = [...new Set(routeIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))].sort();
  return new Map(ids.map((id, index) => [
    id,
    ROUTE_COLORS[index] ?? `hsl(${((index - ROUTE_COLORS.length) * 137.508) % 360} 65% 38%)`,
  ]));
}

export function getPickupRouteColor(colors: ReadonlyMap<string, string>, routeId?: string): string {
  return colors.get(routeId?.trim() ?? "") ?? UNASSIGNED_PICKUP_COLOR;
}
