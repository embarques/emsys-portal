import type { RouteCrewRole } from "@/lib/route-manager/types";

import type {
  ActiveRouteBranchRef,
  ActiveRouteContainerRef,
  ActiveRouteRouteRef,
  RouteType,
} from "./types";

/** Crew member on a vehicle route write payload. */
export type VehicleRouteEmployeeWriteRef = {
  id: number;
  name: string;
  role: RouteCrewRole;
};

/** Container reference for delivery vehicle routes. */
export type VehicleRouteContainerWriteRef = {
  id: number;
  number: string;
};

/**
 * `POST/PUT /v1/vehicle-routes` write body.
 *
 * - `date` XOR `dayOfWeek` — exactly one must be present.
 * - `container` is required for delivery, forbidden for pickup.
 * - `name` is optional for pickup (server-generated when empty) and omitted for
 *   delivery (always server-generated).
 * - Audit fields are server-set and never sent.
 */
export type VehicleRouteWritePayload = {
  name?: string;
  routeType: RouteType;
  active: boolean;
  branch: ActiveRouteBranchRef;
  route: { id: string; name: string };
  employees: VehicleRouteEmployeeWriteRef[];
  date?: string;
  dayOfWeek?: string[];
  container?: VehicleRouteContainerWriteRef;
};

/** `GET /v1/vehicle-routes` record (normalized shape lives in `types.ts`). */
export type VehicleRouteRecord = {
  id: string;
  name: string;
  routeType: RouteType;
  active: boolean;
  branch: ActiveRouteBranchRef | null;
  container: ActiveRouteContainerRef | null;
  date: string;
  dayOfWeek: string[];
  route: ActiveRouteRouteRef;
  employees: VehicleRouteEmployeeWriteRef[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/** Example `POST /v1/vehicle-routes` pickup body (date-based). */
export const PICKUP_VEHICLE_ROUTE_WRITE_EXAMPLE = {
  name: "",
  routeType: "pickup",
  active: true,
  branch: { id: 1, code: "NYC" },
  date: "2026-07-03T08:00:00Z",
  route: { id: "674a1b2c3d4e5f6789012345", name: "Jane Driver-Truck 1" },
  employees: [{ id: 5, name: "Jane Driver", role: "driver" }],
} as const satisfies VehicleRouteWritePayload;

/** Example `POST /v1/vehicle-routes` delivery body (recurring weekday). */
export const DELIVERY_VEHICLE_ROUTE_WRITE_EXAMPLE = {
  routeType: "delivery",
  active: true,
  branch: { id: 1, code: "NYC" },
  dayOfWeek: ["monday", "thursday"],
  route: { id: "674a1b2c3d4e5f6789012345", name: "Route 1" },
  employees: [{ id: 5, name: "Jane Driver", role: "driver" }],
  container: { id: 674, number: "95-25" },
} as const satisfies VehicleRouteWritePayload;
