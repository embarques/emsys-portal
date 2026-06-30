import type { ApiListSortInput } from "@/lib/api/list-query";

/**
 * Geographic pickup route listed from GET /routes.
 * Pickups reference one of these via a `{ _id, name }` ref once assigned
 * through PUT /pickups/route/{routeId}.
 */
export type PickupRoute = {
  id: string;
  name: string;
};

export type PickupRouteListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
};

export const DEFAULT_PICKUP_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "name:asc",
} as const satisfies PickupRouteListParams;
