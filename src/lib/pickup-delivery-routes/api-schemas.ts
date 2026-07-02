import type { RouteEmployeeRef } from "@/lib/route-manager/types";

import type { ActiveRouteContainerRef, ActiveRouteRouteRef } from "./types";

/** `GET/POST/PUT /v1/pickup-routes` — no container, no routeType field. */
export type PickupRouteRecord = {
  id: string;
  name: string;
  date: string;
  route: ActiveRouteRouteRef;
  driver: RouteEmployeeRef | null;
  appraiser: RouteEmployeeRef | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/** `GET/POST/PUT /v1/delivery-routes` — container required, no routeType field. */
export type DeliveryRouteRecord = {
  id: string;
  name: string;
  container: ActiveRouteContainerRef;
  date: string;
  route: ActiveRouteRouteRef;
  driver: RouteEmployeeRef | null;
  appraiser: RouteEmployeeRef | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/** `POST /v1/pickup-routes` write body (`name` is server-generated). */
export type PickupRouteWritePayload = {
  date: string;
  route: { id: string };
  driver?: { id: number; name: string } | null;
  appraiser?: { id: number; name: string } | null;
};

/** `POST /v1/delivery-routes` write body (`name` is server-generated). */
export type DeliveryRouteWritePayload = {
  container: { id: number; name: string };
  date: string;
  route: { id: string };
  driver?: { id: number; name: string } | null;
  appraiser?: { id: number; name: string } | null;
};

/** Example pickup route record returned by the API. */
export const PICKUP_ROUTE_RECORD_EXAMPLE = {
  id: "674a1b2c3d4e5f6789012345",
  name: "2026-06-10-Jane Driver-Helper One-Vehicle 1",
  date: "2026-06-10",
  route: {
    id: "674a1b2c3d4e5f6789012346",
    name: "Jane Driver-Helper One-Vehicle 1",
    routeId: "R-1042",
  },
  driver: { id: 5, name: "Jane Driver" },
  appraiser: { id: 6, name: "Helper One" },
  createdAt: "2026-06-10T14:22:00Z",
  createdBy: "Admin User",
  updatedAt: "2026-06-10T14:22:00Z",
  updatedBy: "Admin User",
} as const satisfies PickupRouteRecord;

/** Example delivery route record returned by the API. */
export const DELIVERY_ROUTE_RECORD_EXAMPLE = {
  id: "674a1b2c3d4e5f6789012347",
  name: "01-CONT-25-2026",
  container: { id: 25, name: "CONT-25" },
  date: "2026-06-10",
  route: {
    id: "674a1b2c3d4e5f6789012348",
    name: "Driver A-Helper B-Truck 2",
    routeId: "R-2044",
  },
  driver: { id: 8, name: "Driver A" },
  appraiser: { id: 9, name: "Helper B" },
  createdAt: "2026-06-10T09:15:00Z",
  createdBy: "Admin User",
  updatedAt: "2026-06-10T09:15:00Z",
  updatedBy: "Admin User",
} as const satisfies DeliveryRouteRecord;

/** Example `POST /v1/pickup-routes` request body. */
export const PICKUP_ROUTE_WRITE_EXAMPLE = {
  date: "2026-06-10T00:00:00Z",
  route: { id: "674a1b2c3d4e5f6789012346" },
  driver: { id: 5, name: "Jane Driver" },
  appraiser: { id: 6, name: "Helper One" },
} as const satisfies PickupRouteWritePayload;

/** Example `POST /v1/delivery-routes` request body. */
export const DELIVERY_ROUTE_WRITE_EXAMPLE = {
  container: { id: 25, name: "CONT-25" },
  date: "2026-06-10T00:00:00Z",
  route: { id: "674a1b2c3d4e5f6789012348" },
  driver: { id: 8, name: "Driver A" },
  appraiser: { id: 9, name: "Helper B" },
} as const satisfies DeliveryRouteWritePayload;
