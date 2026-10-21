"use client";

import { useEffect, useState } from "react";
import { useFormViewport } from "@/hooks/use-form-viewport";

import { OrdersMapView } from "@/components/orders/orders-map-view";
import { PageHeader } from "@/components/app-shell/page-header";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useUnassignPickupsFromRoute } from "@/lib/orders/hooks/use-orders";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { useActiveRouteLookup } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { useUpdateWorkspaceTabLabel } from "@/lib/layout/hooks/use-workspace-tabs";
import {
  DEFAULT_ORDERS_MAP_CONTEXT,
  readOrdersMapContext,
  writeOrdersMapContext,
} from "@/lib/orders/store/orders-map-context";
import type { Order, OrderFilterState, OrderListParams } from "@/lib/orders/types";
import type { AppointmentRouteStopOrder } from "@/lib/orders/utils/appointment-route-optimization";
import { useTranslation } from "@/lib/i18n";

export function OrdersMapWorkspace() {
  const viewportRef = useFormViewport();
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const tabScope = useWorkspaceTabScope();
  const mapActive = tabScope?.isActive ?? true;

  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDERS_MAP_CONTEXT.filters);
  const [sort, setSort] = useState<OrderListParams["sort"]>(DEFAULT_ORDERS_MAP_CONTEXT.sort);
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_ORDERS_MAP_CONTEXT.selectedIds);
  const [stopOrder, setStopOrder] = useState<AppointmentRouteStopOrder | null>(null);
  const [dailyRouteId, setDailyRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!mapActive) return;

    const context = readOrdersMapContext() ?? DEFAULT_ORDERS_MAP_CONTEXT;
    setFilters(context.filters);
    setSort(context.sort);
    setSelectedIds(context.selectedIds);
    setStopOrder(context.stopOrder ?? null);
    setDailyRouteId(context.dailyRouteId ?? null);
  }, [mapActive, tabScope?.tabId]);

  const mapTitle = dailyRouteId ? t("orders.map.dailyRouteTitle") : t("orders.map.title");
  const mapDescription = dailyRouteId
    ? t("orders.map.dailyRouteDescription")
    : t("orders.map.description");
  const updateTabLabel = useUpdateWorkspaceTabLabel();
  const tabId = tabScope?.tabId;

  // The map tab is reused for both entry points; keep its label in sync with the header.
  useEffect(() => {
    if (tabId && mapActive) updateTabLabel(tabId, mapTitle);
  }, [mapActive, mapTitle, tabId, updateTabLabel]);

  const unassignRouteMutation = useUnassignPickupsFromRoute();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500);

  function handleStopOrderChange(nextStopOrder: AppointmentRouteStopOrder | null) {
    setStopOrder(nextStopOrder);
    writeOrdersMapContext({ filters, sort, selectedIds, stopOrder: nextStopOrder, dailyRouteId });
  }

  async function handleUnassignRoute(ordersToClear: Order[]) {
    const result = await unassignRouteMutation.mutateAsync(ordersToClear);

    reportBulkSettled({
      result,
      t,
      notifyError,
      onSucceeded: (count) => {
        notifySuccess(
          count === 1
            ? t("orders.toasts.routeCleared", { count })
            : t("orders.toasts.routeCleared_plural", { count }),
        );
      },
      onAllFailed: (message) => {
        notifyError(message);
      },
      onDone: () => {},
    });
  }

  return (
    <div ref={viewportRef} className="flex h-[calc(100dvh-var(--form-viewport-inset,8rem))] min-h-0 flex-col overflow-y-auto overscroll-contain scroll-pb-24 lg:overflow-hidden">
      <div className="shrink-0">
        <PageHeader title={mapTitle} description={mapDescription} />
      </div>
      <OrdersMapView
        active={mapActive}
        filters={filters}
        sort={sort}
        baseSelectedIds={selectedIds}
        initialStopOrder={stopOrder}
        dailyRouteId={dailyRouteId}
        onStopOrderChange={handleStopOrderChange}
        getRouteByKey={pickupRouteLookup.getByKey}
        onUnassignRoute={handleUnassignRoute}
        isUnassigning={unassignRouteMutation.isPending}
      />
    </div>
  );
}
