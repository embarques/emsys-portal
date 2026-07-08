"use client";

import { useEffect, useMemo, useState } from "react";

import { OrdersMapView } from "@/components/orders/orders-map-view";
import { PageHeader } from "@/components/app-shell/page-header";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { formatOrderRouteName } from "@/lib/orders/display";
import {
  useAssignPickupsToRoute,
  useUnassignPickupsFromRoute,
} from "@/lib/orders/hooks/use-orders";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRouteLookup } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import {
  DEFAULT_ORDERS_MAP_CONTEXT,
  readOrdersMapContext,
} from "@/lib/orders/store/orders-map-context";
import type { Order, OrderFilterState, OrderListParams } from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";

export function OrdersMapWorkspace() {
  const { t } = useTranslation();
  const { notifySuccess } = useFeedback();
  const tabScope = useWorkspaceTabScope();
  const mapActive = tabScope?.isActive ?? true;

  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDERS_MAP_CONTEXT.filters);
  const [sort, setSort] = useState<OrderListParams["sort"]>(DEFAULT_ORDERS_MAP_CONTEXT.sort);
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_ORDERS_MAP_CONTEXT.selectedIds);

  useEffect(() => {
    if (!mapActive) return;

    const context = readOrdersMapContext() ?? DEFAULT_ORDERS_MAP_CONTEXT;
    setFilters(context.filters);
    setSort(context.sort);
    setSelectedIds(context.selectedIds);
  }, [mapActive, tabScope?.tabId]);

  const assignRouteMutation = useAssignPickupsToRoute();
  const unassignRouteMutation = useUnassignPickupsFromRoute();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500);
  const assignRouteOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(pickupRouteLookup.items, t),
    [pickupRouteLookup.items, t],
  );

  async function handleAssignRoute(routeId: string, pickupIds: number[]) {
    await assignRouteMutation.mutateAsync({ routeId, pickupIds });
    const selectedRoute = pickupRouteLookup.getByKey(routeId);
    const routeName = selectedRoute ? formatOrderRouteName({ routeId }, selectedRoute, t) : "";
    const routeSuffix = routeName ? t("orders.toasts.assignedToRouteNamed", { routeName }) : "";
    notifySuccess(
      pickupIds.length === 1
        ? t("orders.toasts.assignedToRoute", { count: pickupIds.length, routeSuffix })
        : t("orders.toasts.assignedToRoute_plural", { count: pickupIds.length, routeSuffix }),
    );
  }

  async function handleUnassignRoute(ordersToClear: Order[]) {
    const cleared = await unassignRouteMutation.mutateAsync(ordersToClear);
    notifySuccess(
      cleared === 1
        ? t("orders.toasts.routeCleared", { count: cleared })
        : t("orders.toasts.routeCleared_plural", { count: cleared }),
    );
  }

  return (
    <div className="flex min-h-[min(80vh,52rem)] flex-col">
      <PageHeader title={t("orders.map.title")} description={t("orders.map.description")} />
      <OrdersMapView
        active={mapActive}
        filters={filters}
        sort={sort}
        baseSelectedIds={selectedIds}
        assignRouteOptions={assignRouteOptions}
        assignRoutesLoading={pickupRouteLookup.isLoading}
        getRouteByKey={pickupRouteLookup.getByKey}
        onAssignRoute={handleAssignRoute}
        onUnassignRoute={handleUnassignRoute}
        isAssigning={assignRouteMutation.isPending}
        isUnassigning={unassignRouteMutation.isPending}
      />
    </div>
  );
}
