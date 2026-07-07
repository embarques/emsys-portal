"use client";

import { useState } from "react";
import { Printer, RouteOff, Sparkles } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { fetchAllPickupsByRoutes } from "@/lib/orders/api/orders-api";
import { getOrderRecordId } from "@/lib/orders/types";
import { resolveActiveRouteReportIds } from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { useGeneratePickupReport } from "@/lib/reports/hooks/use-reports";
import { useClearPickupRoute } from "@/lib/orders/hooks/use-orders";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type PickupRoutesSelectionActionsProps = {
  activeRoutes: ActiveRoute[];
  selectedIds: string[];
};

export function PickupRoutesSelectionActions({
  activeRoutes,
  selectedIds,
}: PickupRoutesSelectionActionsProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const generatePickupReportMutation = useGeneratePickupReport();
  const clearPickupRouteMutation = useClearPickupRoute();
  const [clearRouteOpen, setClearRouteOpen] = useState(false);
  const isPrinting = generatePickupReportMutation.isPending;
  const isClearing = clearPickupRouteMutation.isPending;
  const singleSelectedRouteId =
    selectedIds.length === 1 ? resolveActiveRouteReportIds(activeRoutes, selectedIds)[0] : "";

  async function printSelectedPickupRoutes() {
    const routeIds = resolveActiveRouteReportIds(activeRoutes, selectedIds);
    if (routeIds.length === 0) {
      notifyError(t("routes.pickupRoutes.actions.selectAtLeastOne"));
      return;
    }

    try {
      const pickups = await fetchAllPickupsByRoutes(routeIds);
      const pickupIds = pickups.map((order) => getOrderRecordId(order)).filter(Boolean);

      if (pickupIds.length === 0) {
        notifyError(t("routes.pickupRoutes.actions.noPickupsOnRoute"));
        return;
      }

      const report = await generatePickupReportMutation.mutateAsync({
        type: "pickup",
        collection: "pickups",
        values: pickupIds,
        lookupField: "id",
      });
      window.open(report.url, "_blank", "noopener,noreferrer");
      notifySuccess(
        pickupIds.length === 1
          ? t("routes.pickupRoutes.toasts.manifestReady", { count: pickupIds.length })
          : t("routes.pickupRoutes.toasts.manifestReady_plural", { count: pickupIds.length }),
      );
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  function optimizeSelectedPickupRoutes() {
    notifySuccess(
      t("routes.pickupRoutes.toasts.comingSoon", {
        label: t("routes.pickupRoutes.actions.optimize"),
      }),
    );
  }

  async function confirmClearRoute() {
    if (!singleSelectedRouteId) return;

    try {
      const cleared = await clearPickupRouteMutation.mutateAsync(singleSelectedRouteId);
      setClearRouteOpen(false);

      if (cleared === 0) {
        notifyError(t("routes.pickupRoutes.actions.noPickupsOnRoute"));
        return;
      }

      notifySuccess(
        cleared === 1
          ? t("routes.pickupRoutes.toasts.routeCleared", { count: cleared })
          : t("routes.pickupRoutes.toasts.routeCleared_plural", { count: cleared }),
      );
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
      setClearRouteOpen(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
        onClick={() => void printSelectedPickupRoutes()}
        disabled={isPrinting || isClearing}
      >
        <Printer className="h-4 w-4" />
        {isPrinting
          ? t("routes.pickupRoutes.actions.preparing")
          : t("routes.pickupRoutes.actions.print")}
      </Button>
      {singleSelectedRouteId ? (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "whitespace-nowrap",
            "border-amber-500/30 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300",
          )}
          onClick={() => setClearRouteOpen(true)}
          disabled={isPrinting || isClearing}
        >
          <RouteOff className="h-4 w-4" />
          {isClearing
            ? t("routes.pickupRoutes.actions.clearing")
            : t("routes.pickupRoutes.actions.clearRoute")}
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className={cn("whitespace-nowrap", tableSelectionActionStyles.optimize)}
        onClick={optimizeSelectedPickupRoutes}
        disabled={isPrinting || isClearing}
      >
        <Sparkles className="h-4 w-4" />
        {t("routes.pickupRoutes.actions.optimize")}
      </Button>

      <Dialog open={clearRouteOpen} onOpenChange={setClearRouteOpen}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>{t("routes.pickupRoutes.dialogs.clearRouteTitle")}</DialogTitle>
            <DialogDescription>
              {t("routes.pickupRoutes.dialogs.clearRouteDescription", {
                cannotBeUndone: t("common.dialogs.cannotBeUndone"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearRouteOpen(false)}
              disabled={isClearing}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmClearRoute()}
              disabled={isClearing}
            >
              <RouteOff className="h-4 w-4" />
              {t("routes.pickupRoutes.actions.clearRoute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
