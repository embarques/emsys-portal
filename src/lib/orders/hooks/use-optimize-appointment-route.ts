"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { buildApiAddressPayload } from "@/lib/api/payloads";
import { fetchBranchById } from "@/lib/branches/api/branches-api";
import {
  AppointmentRouteOptimizationError,
  buildAppointmentRouteStopOrder,
  type AppointmentRouteOptimizationPlan,
  type AppointmentRouteStopOrder,
} from "@/lib/orders/utils/appointment-route-optimization";
import { queryKeys } from "@/lib/query/query-keys";
import { optimizeSingleRoute } from "@/lib/route-optimizer/api/route-optimizer-api";

const BRANCH_DEPOT_STALE_TIME_MS = 5 * 60_000;

/**
 * Optimize stop order for appointments on one route, starting and ending at the
 * branch address. The result is not persisted — the API has no stop-order field.
 */
export function useOptimizeAppointmentRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      plan: AppointmentRouteOptimizationPlan,
    ): Promise<AppointmentRouteStopOrder> => {
      const branch = await queryClient.fetchQuery({
        queryKey: queryKeys.branches.detail(plan.branchId),
        queryFn: () => fetchBranchById(plan.branchId),
        staleTime: BRANCH_DEPOT_STALE_TIME_MS,
      });

      const depot = buildApiAddressPayload(branch.address);
      if (!depot?.address1) {
        throw new AppointmentRouteOptimizationError("branchAddressMissing");
      }

      const result = await optimizeSingleRoute({
        start: depot,
        end: depot,
        stops: plan.stops.map((stop) => stop.address),
        numRoutes: 1,
      });

      const stopOrder = buildAppointmentRouteStopOrder(plan, result);
      if (Object.keys(stopOrder.stopNumbers).length === 0) {
        throw new AppointmentRouteOptimizationError("emptyResult");
      }

      return stopOrder;
    },
  });
}
