"use client";

import { Printer } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { fetchAllBarcodesByRoutes } from "@/lib/barcodes/api/barcodes-catalog-api";
import { useTranslation } from "@/lib/i18n";
import { resolveActiveRouteReportIds } from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { useGenerateDeliveryReport } from "@/lib/reports/hooks/use-reports";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type DeliveryRoutesSelectionActionsProps = {
  activeRoutes: ActiveRoute[];
  selectedIds: string[];
  printDisabled?: boolean;
};

/**
 * RD / delivery daily-route print.
 * Manifest is the barcodes assigned to the vehicle-route (`POST /reports/deliveries`
 * with the vehicle-route ObjectID; the API expands barcode route snapshots).
 */
export function DeliveryRoutesSelectionActions({
  activeRoutes,
  selectedIds,
  printDisabled = false,
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
      const barcodes = await fetchAllBarcodesByRoutes(routeIds);

      if (process.env.NODE_ENV !== "production") {
        console.info("[Reports Portal] Delivery route barcodes resolved", {
          routeIds,
          barcodeCount: barcodes.length,
        });
      }

      if (barcodes.length === 0) {
        notifyError(t("routes.deliveryRoutes.actions.noBarcodesOnRoute"));
        return;
      }

      // One vehicle-route ObjectID → PDF of assigned barcode snapshots.
      const report = await generateDeliveryReportMutation.mutateAsync({
        type: "delivery",
        collection: "deliveries",
        values: routeIds,
        lookupField: "id",
      });
      window.open(report.url, "_blank", "noopener,noreferrer");
      notifySuccess(
        barcodes.length === 1
          ? t("routes.deliveryRoutes.toasts.manifestReady", { count: barcodes.length })
          : t("routes.deliveryRoutes.toasts.manifestReady_plural", { count: barcodes.length }),
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
      onClick={() => void printSelectedDeliveryRoutes()}
      disabled={printDisabled || isPrinting}
    >
      <Printer className="h-4 w-4" />
      {isPrinting
        ? t("routes.deliveryRoutes.actions.preparing")
        : t("routes.deliveryRoutes.actions.print")}
    </Button>
  );
}
