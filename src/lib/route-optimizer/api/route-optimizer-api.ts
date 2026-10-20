import { isApiGeoLocation } from "@/lib/api/payloads";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import type {
  OptimizedRoute,
  OptimizedRouteAddress,
  OptimizeRouteRequest,
  OptimizeRouteResult,
} from "@/lib/route-optimizer/types";

type ApiOptimizedAddress = {
  id?: string;
  routeOrder?: number;
  location?: { coordinates?: unknown } | null;
};

type ApiOptimizedRoute = {
  routeNumber?: number;
  distanceMeters?: number;
  addresses?: ApiOptimizedAddress[] | null;
};

type ApiOptimizeResponse = {
  numRoutes?: number;
  totalDistanceMeters?: number;
  routes?: ApiOptimizedRoute[] | null;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCoordinates(location: ApiOptimizedAddress["location"]): [number, number] | null {
  const coordinates = location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

  const [lng, lat] = coordinates;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return [lng, lat];
}

function normalizeAddress(raw: ApiOptimizedAddress, index: number): OptimizedRouteAddress {
  return {
    id: typeof raw.id === "string" ? raw.id.trim() : "",
    routeOrder: toFiniteNumber(raw.routeOrder, index),
    coordinates: normalizeCoordinates(raw.location),
  };
}

function normalizeRoute(raw: ApiOptimizedRoute, index: number): OptimizedRoute {
  const addresses = Array.isArray(raw.addresses) ? raw.addresses : [];

  return {
    routeNumber: toFiniteNumber(raw.routeNumber, index),
    distanceMeters: toFiniteNumber(raw.distanceMeters),
    addresses: addresses
      .map(normalizeAddress)
      .sort((left, right) => left.routeOrder - right.routeOrder),
  };
}

/** POST /route-optimizer/single — order one route's stops between start and end. */
export async function optimizeSingleRoute(
  request: OptimizeRouteRequest,
): Promise<OptimizeRouteResult> {
  if (request.stops.length < 2) {
    throw new Error("At least two stops are required to optimize a route.");
  }

  for (const [label, address] of [
    ["start", request.start],
    ["end", request.end],
    ...request.stops.map((stop, index) => [`stops[${index}]`, stop] as const),
  ] as const) {
    if (!isApiGeoLocation(address.location)) {
      throw new Error(`Route optimizer ${label} requires a GeoJSON Point with valid [longitude, latitude] coordinates.`);
    }
  }

  const response = await apiClient.post<PaginatedApiEnvelope<ApiOptimizeResponse>>(
    API_ENDPOINTS.ROUTE_OPTIMIZER_SINGLE,
    request,
  );

  assertMutationSuccess(response, "Unable to optimize route.");

  const data = response.data ?? {};
  const routes = Array.isArray(data.routes) ? data.routes.map(normalizeRoute) : [];

  return {
    numRoutes: toFiniteNumber(data.numRoutes, routes.length),
    totalDistanceMeters: toFiniteNumber(
      data.totalDistanceMeters,
      routes.reduce((sum, route) => sum + route.distanceMeters, 0),
    ),
    routes,
  };
}
