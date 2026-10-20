import { normalizeApiError } from "@/lib/api/axios";
import { buildApiAddressPayload, isApiGeoLocation, type ApiAddressPayload } from "@/lib/api/payloads";
import { getCustomerPrimaryCoreAddress } from "@/lib/customers/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { getOrderRecordId, type Order } from "@/lib/orders/types";
import { isOrderMappable } from "@/lib/orders/utils/pickup-map";
import { assignOptimizedStopNumbers } from "@/lib/route-optimizer/stop-numbers";
import type { OptimizeRouteResult } from "@/lib/route-optimizer/types";

const METERS_PER_MILE = 1609.344;

/** Reasons an appointment selection cannot be optimized; map to `orders.optimize.errors.*`. */
export type AppointmentRouteOptimizationIssue =
  | "notEnoughStops"
  | "routeRequired"
  | "multipleRoutes"
  | "multipleBranches"
  | "branchAddressMissing"
  | "branchCoordinatesMissing"
  | "stopCoordinatesMissing"
  | "emptyResult";

export class AppointmentRouteOptimizationError extends Error {
  readonly code: AppointmentRouteOptimizationIssue;

  constructor(code: AppointmentRouteOptimizationIssue) {
    super(code);
    this.name = "AppointmentRouteOptimizationError";
    this.code = code;
  }
}

export type AppointmentRouteOptimizationStop = {
  orderRecordId: string;
  address: ApiAddressPayload;
};

export type AppointmentRouteOptimizationPlan = {
  routeId: string;
  branchId: number;
  stops: AppointmentRouteOptimizationStop[];
};

/** Stop numbers (1-based) for one route, keyed by appointment record id. */
export type AppointmentRouteStopOrder = {
  routeId: string;
  stopNumbers: Record<string, number>;
  /** Optimizer distance; null once the order was set or edited by hand. */
  totalDistanceMeters: number | null;
};

export type AppointmentRouteOptimizationPlanResult =
  | { plan: AppointmentRouteOptimizationPlan; issue?: undefined }
  | { plan?: undefined; issue: AppointmentRouteOptimizationIssue };

/**
 * Build an optimizer request from selected appointments: verified stops only,
 * all on one assigned route and branch (the branch address is the depot).
 */
export function planAppointmentRouteOptimization(
  orders: Order[],
): AppointmentRouteOptimizationPlanResult {
  const mappable = orders.filter(isOrderMappable);
  if (mappable.length < 2) return { issue: "notEnoughStops" };

  const routeIds = new Set(mappable.map((order) => order.routeId?.trim() ?? ""));
  if (routeIds.has("")) return { issue: "routeRequired" };
  if (routeIds.size > 1) return { issue: "multipleRoutes" };

  const branchIds = new Set(mappable.map((order) => order.branch.id));
  if (branchIds.size > 1) return { issue: "multipleBranches" };

  const stops: AppointmentRouteOptimizationStop[] = [];
  for (const order of mappable) {
    const address = buildApiAddressPayload(getCustomerPrimaryCoreAddress(order.sender));
    if (!address || !isApiGeoLocation(address.location)) {
      return { issue: "stopCoordinatesMissing" };
    }
    stops.push({ orderRecordId: getOrderRecordId(order), address });
  }
  if (stops.length < 2) return { issue: "notEnoughStops" };

  return {
    plan: {
      routeId: [...routeIds][0],
      branchId: mappable[0].branch.id,
      stops,
    },
  };
}

export function buildAppointmentRouteStopOrder(
  plan: AppointmentRouteOptimizationPlan,
  result: OptimizeRouteResult,
): AppointmentRouteStopOrder {
  return {
    routeId: plan.routeId,
    stopNumbers: assignOptimizedStopNumbers(
      plan.stops.map((stop) => ({
        key: stop.orderRecordId,
        addressId: stop.address.id,
        coordinates: stop.address.location?.coordinates,
      })),
      result,
    ),
    totalDistanceMeters: result.totalDistanceMeters,
  };
}

export function resolveAppointmentRouteOptimizationErrorMessage(
  error: unknown,
  t: TranslateFn,
): string {
  if (error instanceof AppointmentRouteOptimizationError) {
    return t(`orders.optimize.errors.${error.code}`);
  }
  return normalizeApiError(error).message;
}

/** Narrow a persisted stop order (e.g. from sessionStorage) to a valid shape. */
export function parseAppointmentRouteStopOrder(value: unknown): AppointmentRouteStopOrder | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<AppointmentRouteStopOrder>;
  const routeId = typeof raw.routeId === "string" ? raw.routeId.trim() : "";
  if (!routeId || !raw.stopNumbers || typeof raw.stopNumbers !== "object") return null;

  const stopNumbers: Record<string, number> = {};
  for (const [orderRecordId, stopNumber] of Object.entries(raw.stopNumbers)) {
    if (typeof stopNumber === "number" && Number.isInteger(stopNumber) && stopNumber > 0) {
      stopNumbers[orderRecordId] = stopNumber;
    }
  }
  if (Object.keys(stopNumbers).length === 0) return null;

  return {
    routeId,
    stopNumbers,
    totalDistanceMeters:
      typeof raw.totalDistanceMeters === "number" && Number.isFinite(raw.totalDistanceMeters)
        ? raw.totalDistanceMeters
        : null,
  };
}

export function formatRouteDistance(meters: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "mile",
    maximumFractionDigits: 1,
  }).format(meters / METERS_PER_MILE);
}
