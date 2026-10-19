import type { ApiAddressPayload } from "@/lib/api/payloads";

/** POST /route-optimizer/single request body. */
export type OptimizeRouteRequest = {
  start: ApiAddressPayload;
  end: ApiAddressPayload;
  /** At least two stops are required by the API. */
  stops: ApiAddressPayload[];
  numRoutes?: number;
};

export type OptimizedRouteAddress = {
  /** Echoed address entry id from the request stop, when one was sent. */
  id: string;
  /** Position reported by the API; its base (0 or 1) is not guaranteed, so sort on it. */
  routeOrder: number;
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: [number, number] | null;
};

export type OptimizedRoute = {
  routeNumber: number;
  distanceMeters: number;
  addresses: OptimizedRouteAddress[];
};

export type OptimizeRouteResult = {
  numRoutes: number;
  totalDistanceMeters: number;
  routes: OptimizedRoute[];
};
