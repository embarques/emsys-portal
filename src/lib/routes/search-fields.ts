/** POST /pickups/route/search — OR bar search across route fields. */
export const ROUTE_BAR_OR_SEARCH_FIELDS = ["name"] as const;

export type RouteBarOrSearchField = (typeof ROUTE_BAR_OR_SEARCH_FIELDS)[number];
