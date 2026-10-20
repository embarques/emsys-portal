"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { RouteEndpointLocations } from "@/lib/orders/schemas/route-endpoints.schema";
import { buildApiAddressPayload, isApiGeoLocation, type ApiAddressPayload } from "@/lib/api/payloads";
import { fetchBranchById } from "@/lib/branches/api/branches-api";
import {
  AppointmentRouteOptimizationError,
  buildAppointmentRouteStopOrder,
  type AppointmentRouteOptimizationPlan,
  type AppointmentRouteStopOrder,
} from "@/lib/orders/utils/appointment-route-optimization";
import { queryKeys } from "@/lib/query/query-keys";
import { optimizeSingleRoute } from "@/lib/route-optimizer/api/route-optimizer-api";

import type { Branch } from "@/lib/branches/types";

export class BranchDepotRequiredError extends AppointmentRouteOptimizationError {
  constructor(readonly branch: Branch) { super("branchCoordinatesMissing"); }
}

const BRANCH_DEPOT_STALE_TIME_MS = 5 * 60_000;

/**
 * Optimize stop order for appointments on one route, starting and ending at the
 * branch address. The result is not persisted — the API has no stop-order field.
 */
export function useOptimizeAppointmentRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      plan: AppointmentRouteOptimizationPlan & { endpoints?: RouteEndpointLocations },
    ): Promise<AppointmentRouteStopOrder> => {
      let start: ApiAddressPayload;
      let end: ApiAddressPayload;
      if (plan.endpoints) {
        start = { location: plan.endpoints.start };
        end = { location: plan.endpoints.end };
      } else {
        const branch = await queryClient.fetchQuery({
          queryKey: queryKeys.branches.detail(plan.branchId),
          queryFn: () => fetchBranchById(plan.branchId),
          staleTime: BRANCH_DEPOT_STALE_TIME_MS,
        });
        const depot = buildApiAddressPayload(branch.address);
        if (!depot || !isApiGeoLocation(depot.location)) {
          throw new BranchDepotRequiredError(branch);
        }
        start = depot;
        end = depot;
      }

      const result = await optimizeSingleRoute({
        start,
        end,
        stops: plan.stops.map((stop) => stop.address),
      });

      const stopOrder = buildAppointmentRouteStopOrder(plan, result);
      if (Object.keys(stopOrder.stopNumbers).length === 0) {
        throw new AppointmentRouteOptimizationError("emptyResult");
      }

      return stopOrder;
    },
  });
}
