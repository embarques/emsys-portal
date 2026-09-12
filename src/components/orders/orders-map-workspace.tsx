"use client";

import { useEffect, useState } from "react";

import { OrdersMapView } from "@/components/orders/orders-map-view";
import { PageHeader } from "@/components/app-shell/page-header";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useUnassignPickupsFromRoute } from "@/lib/orders/hooks/use-orders";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
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
  const { notifySuccess, notifyError } = useFeedback();
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

  const unassignRouteMutation = useUnassignPickupsFromRoute();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500);

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
    <div className="flex min-h-[min(80vh,52rem)] flex-col">
      <PageHeader title={t("orders.map.title")} description={t("orders.map.description")} />
      <OrdersMapView
        active={mapActive}
        filters={filters}
        sort={sort}
        baseSelectedIds={selectedIds}
        getRouteByKey={pickupRouteLookup.getByKey}
        onUnassignRoute={handleUnassignRoute}
        isUnassigning={unassignRouteMutation.isPending}
      />
    </div>
  );
}
