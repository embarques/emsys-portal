"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  assignPickupsToRoute,
  fetchPickupRoutes,
} from "@/lib/pickup-routes/api/pickup-routes-api";
import { DEFAULT_PICKUP_ROUTE_LIST_PARAMS } from "@/lib/pickup-routes/types";
import { queryKeys } from "@/lib/query/query-keys";

export function usePickupRoutePicker(limit = DEFAULT_PICKUP_ROUTE_LIST_PARAMS.limit, options: { enabled?: boolean } = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.pickupRoutes.list({ ...DEFAULT_PICKUP_ROUTE_LIST_PARAMS, limit }),
    queryFn: () => fetchPickupRoutes({ ...DEFAULT_PICKUP_ROUTE_LIST_PARAMS, limit }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useAssignPickupsToRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, pickupIds }: { routeId: string; pickupIds: number[] }) =>
      assignPickupsToRoute(routeId, pickupIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}
