"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Route as RouteIcon } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useAssignBarcodesToRoute } from "@/lib/labels/hooks/use-barcodes";
import type { AssignBarcodeToRouteTarget } from "@/lib/labels/api/barcodes-api";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { DAILY_ROUTES_DIRECTORY_VARIANT, DELIVERY_BRANCH_CODE } from "@/lib/pickup-delivery-routes/directory-variant";
import {
  buildActiveRouteAssignmentOptions,
  formatActiveRouteReferenceLabel,
} from "@/lib/pickup-delivery-routes/display";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";

export type AssignBarcodeRouteResult = {
  success: boolean;
  routeName: string;
  message: string;
};

type AssignBarcodeRouteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barcodes: AssignBarcodeToRouteTarget[];
  onResult?: (result: AssignBarcodeRouteResult) => void;
};

export function AssignBarcodeRouteDialog({
  open,
  onOpenChange,
  barcodes = [],
  onResult,
}: AssignBarcodeRouteDialogProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const { openFormTab } = useWorkspaceTabs();
  const [routeId, setRouteId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const dailyRoutesQuery = useDailyRoutePicker(200, {
    enabled: open,
    branchCode: DELIVERY_BRANCH_CODE,
  });
  const assignBarcodesMutation = useAssignBarcodesToRoute();

  const dailyRoutes = dailyRoutesQuery.data?.items ?? [];
  const routeOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(dailyRoutes, t),
    [dailyRoutes, t],
  );
  const selectedRoute = dailyRoutes.find((route) => route.id === routeId) ?? null;

  useEffect(() => {
    if (!open) {
      setRouteId("");
      setFormError(null);
    }
  }, [open]);

  const isSaving = assignBarcodesMutation.isPending;
  const canSubmit = barcodes.length > 0 && Boolean(routeId) && !isSaving;

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) return;
    onOpenChange(nextOpen);
  }

  function openCreateDailyRoute() {
    if (isSaving) return;
    onOpenChange(false);
    openFormTab({
      feature: DAILY_ROUTES_DIRECTORY_VARIANT.formFeature,
      baseHref: DAILY_ROUTES_DIRECTORY_VARIANT.baseHref,
      mode: "add",
      label: t("routes.dailyRoutes.addTabLabel"),
    });
  }

  async function confirmAssign() {
    if (!canSubmit) return;

    const routeName = selectedRoute
      ? formatActiveRouteReferenceLabel(selectedRoute, t)
      : routeId;

    const needsUpdate = barcodes.filter(
      (barcode) => (barcode.currentRouteName ?? "").trim() !== routeName.trim(),
    );

    if (needsUpdate.length === 0) {
      const message = t("labels.staging.output.successRoute");
      notifySuccess(
        t("labels.staging.success.assignedToRoute", {
          count: barcodes.length,
          route: routeName,
          trip: 0,
        }),
      );
      onResult?.({ success: true, routeName, message });
      onOpenChange(false);
      return;
    }

    try {
      const result = await assignBarcodesMutation.mutateAsync({
        routeId,
        routeName,
        barcodes: needsUpdate,
      });
      const assignedRouteName = result.routeName || routeName;
      const message = t("labels.staging.output.successRoute");
      notifySuccess(
        t("labels.staging.success.assignedToRoute", {
          count: barcodes.length,
          route: assignedRouteName,
          trip: result.tripNumber,
        }),
      );
      onResult?.({ success: true, routeName: assignedRouteName, message });
      onOpenChange(false);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setFormError(message);
      notifyError(message);
      onResult?.({
        success: false,
        routeName,
        message,
      });
    }
  }

  const description =
    barcodes.length === 1
      ? t("labels.staging.routeDialog.description", { count: barcodes.length })
      : t("labels.staging.routeDialog.description_plural", { count: barcodes.length });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="z-[70] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:p-4"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("labels.staging.routeDialog.title")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="assign-barcode-daily-route">
                {t("labels.staging.routeDialog.dailyRoute")}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCreateDailyRoute}
                disabled={isSaving}
              >
                <Plus className="h-4 w-4" />
                {t("labels.staging.routeDialog.createDailyRoute")}
              </Button>
            </div>
            <SearchableSelect
              id="assign-barcode-daily-route"
              value={routeId}
              onValueChange={(value) => {
                setRouteId(value);
                setFormError(null);
              }}
              placeholder={t("labels.staging.routeDialog.selectRoute")}
              searchPlaceholder={t("labels.staging.routeDialog.searchRoutes")}
              loading={dailyRoutesQuery.isLoading}
              loadingMessage={t("labels.staging.routeDialog.loadingRoutes")}
              emptyMessage={
                dailyRoutesQuery.isLoading
                  ? t("labels.staging.routeDialog.loadingRoutes")
                  : t("labels.staging.routeDialog.noRoutes")
              }
              options={routeOptions}
              contentClassName="z-[80]"
              mobileSheet
            />
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>

        <DialogFooter className="max-md:grid max-md:grid-cols-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={() => void confirmAssign()} disabled={!canSubmit}>
            <RouteIcon className="h-4 w-4" />
            {t("labels.staging.routeDialog.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
