"use client";

import { Printer } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { fetchDeliveryIdsByRoute } from "@/lib/labels/api/barcodes-api";
import { resolveActiveRouteReportIds } from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { useGenerateDeliveryReport } from "@/lib/reports/hooks/use-reports";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type DeliveryRoutesSelectionActionsProps = {
  activeRoutes: ActiveRoute[];
  selectedIds: string[];
};

export function DeliveryRoutesSelectionActions({
  activeRoutes,
  selectedIds,
}: DeliveryRoutesSelectionActionsProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const generateDeliveryReportMutation = useGenerateDeliveryReport();
  const isPrinting = generateDeliveryReportMutation.isPending;

  async function printSelectedDeliveryRoutes() {
    const routeIds = resolveActiveRouteReportIds(activeRoutes, selectedIds);
    if (routeIds.length === 0) {
      notifyError(t("routes.deliveryRoutes.actions.selectAtLeastOne"));
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[Reports Portal] Delivery route print selection", {
        selectedIds,
        resolvedRouteIds: routeIds,
        routes: activeRoutes
          .filter((route) => selectedIds.includes(route.id))
          .map((route) => ({
            id: route.id,
            routeType: route.routeType,
            branchCode: route.branch?.code,
            routeName: route.route?.name,
          })),
      });
    }

    try {
      const deliveryIds = (
        await Promise.all(routeIds.map((routeId) => fetchDeliveryIdsByRoute(routeId)))
      ).flat();

      if (process.env.NODE_ENV !== "production") {
        console.info("[Reports Portal] Delivery route records resolved", {
          routeIds,
          deliveryIds,
          deliveryCount: deliveryIds.length,
        });
      }

      if (deliveryIds.length === 0) {
        notifyError(t("routes.deliveryRoutes.actions.noDeliveriesOnRoute"));
        return;
      }

      const report = await generateDeliveryReportMutation.mutateAsync({
        type: "delivery",
        collection: "deliveries",
        values: deliveryIds.map(String),
        lookupField: "id",
      });
      window.open(report.url, "_blank", "noopener,noreferrer");
      notifySuccess(
        deliveryIds.length === 1
          ? t("routes.deliveryRoutes.toasts.reportReady", { count: deliveryIds.length })
          : t("routes.deliveryRoutes.toasts.reportReady_plural", { count: deliveryIds.length }),
      );
    } catch (mutationError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[Reports Portal] Delivery route print failed", mutationError);
      }
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
      onClick={printSelectedDeliveryRoutes}
      disabled={isPrinting}
    >
      <Printer className="h-4 w-4" />
      {isPrinting
        ? t("routes.deliveryRoutes.actions.preparing")
        : t("routes.deliveryRoutes.actions.print")}
    </Button>
  );
}
