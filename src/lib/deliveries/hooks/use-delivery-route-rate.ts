"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fetchActiveRouteById } from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";
import type { DeliverTarget } from "./use-deliver-invoice";

/**
 * DOP-per-USD rate of the barcode's daily route. Prefers the rate embedded in the
 * Deliveries row; otherwise reads the route once per route id (shared across rows).
 */
export function useDeliveryRouteRate(target: Pick<DeliverTarget, "route" | "routeRate">): number | undefined {
  const { hasPermission } = useAuth();
  const companyId = useAppSelector((state) => state.auth.companyId);
  const routeId = target.route?.id?.trim() ?? "";
  const embedded = target.routeRate != null && target.routeRate > 0 ? target.routeRate : undefined;
  const route = useWorkspaceQuery({
    queryKey: queryKeys.deliveries.routeRate(companyId, routeId),
    queryFn: () => fetchActiveRouteById(routeId, "delivery"),
    enabled: embedded == null
      && Boolean(routeId && companyId)
      && hasPermission(PERMISSIONS.vehicleRoutesView.name, PERMISSIONS.vehicleRoutesView.resourceType),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const fetched = route.data?.rate;
  return embedded ?? (fetched != null && Number.isFinite(fetched) && fetched > 0 ? fetched : undefined);
}
