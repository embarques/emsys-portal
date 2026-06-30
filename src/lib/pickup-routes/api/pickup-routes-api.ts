import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery } from "@/lib/api/list-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  DEFAULT_PICKUP_ROUTE_LIST_PARAMS,
  type PickupRoute,
  type PickupRouteListParams,
} from "@/lib/pickup-routes/types";

type ApiPickupRoute = {
  id?: string | number;
  _id?: string | number;
  name?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

export function normalizeApiPickupRoute(raw: unknown): PickupRoute | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiPickupRoute;
  const id = String(item.id ?? item._id ?? "").trim();
  if (!id) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
  };
}

function normalizePaginatedPickupRoutes(
  payload: PaginatedApiEnvelope<unknown[]>,
): PaginatedResult<PickupRoute> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeApiPickupRoute)
        .filter((route): route is PickupRoute => route != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length),
  };
}

export async function fetchPickupRoutes(
  params: PickupRouteListParams = {},
): Promise<PaginatedResult<PickupRoute>> {
  const page = params.page ?? DEFAULT_PICKUP_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_PICKUP_ROUTE_LIST_PARAMS.limit;

  // The routes list lives at GET /routes. `/pickups/route` is a parameterized
  // route (`/pickups/route/{id}`) used only to assign pickups, and returns 400
  // when called without an id, so it cannot be used to list routes.
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.ROUTES}?${buildApiListQuery({
      page,
      limit,
      offset: params.offset,
      sort: params.sort ?? DEFAULT_PICKUP_ROUTE_LIST_PARAMS.sort,
    })}`,
  );

  return normalizePaginatedPickupRoutes(response);
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

/**
 * Assign pickups to a geographic route.
 * PUT /pickups/route/{routeId} with `{ pickupIds }`. Each pickup then stores a
 * `{ _id, name }` route reference. Pickups do not store a trip number or container.
 */
export async function assignPickupsToRoute(
  routeId: string,
  pickupIds: number[],
): Promise<void> {
  const id = routeId.trim();
  if (!id) {
    throw new Error("A valid route is required.");
  }

  if (pickupIds.length === 0) {
    throw new Error("Select at least one pickup to assign.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUP_ROUTES}/${id}`,
    { pickupIds },
  );

  assertMutationSuccess(response, "Unable to assign route.");
}
