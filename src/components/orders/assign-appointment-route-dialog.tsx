"use client";

import { useEffect, useMemo, useState } from "react";
import { Route as RouteIcon } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
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
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { formatOrderRouteName } from "@/lib/orders/display";
import { useAssignPickupsToRoute } from "@/lib/orders/hooks/use-orders";
import { DAILY_ROUTES_DIRECTORY_VARIANT, PICKUP_BRANCH_CODE } from "@/lib/pickup-delivery-routes/directory-variant";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { todayDateInputValue } from "@/lib/route-manager/types";

type AssignAppointmentRouteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickupIds: number[];
};

export function sharedAppointmentDate(dates: Array<string | undefined | null>): string {
  const unique = [
    ...new Set(
      dates
        .map((value) => value?.trim().slice(0, 10) ?? "")
        .filter(Boolean),
    ),
  ];
  return unique.length === 1 ? unique[0] : todayDateInputValue();
}

export function AssignAppointmentRouteDialog({
  open,
  onOpenChange,
  pickupIds,
}: AssignAppointmentRouteDialogProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const { openFormTab } = useWorkspaceTabs();
  const [routeId, setRouteId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const dailyRoutesQuery = useDailyRoutePicker(200, {
    enabled: open,
    branchCode: PICKUP_BRANCH_CODE,
  });
  const assignPickupsMutation = useAssignPickupsToRoute();

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

  const isSaving = assignPickupsMutation.isPending;
  const canSubmit = pickupIds.length > 0 && Boolean(routeId) && !isSaving;

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

    try {
      await assignPickupsMutation.mutateAsync({ routeId, pickupIds });
      const routeName = formatOrderRouteName({ routeId }, selectedRoute, t);
      const routeSuffix = routeName
        ? t("orders.toasts.assignedToRouteNamed", { routeName })
        : "";
      notifySuccess(
        pickupIds.length === 1
          ? t("orders.toasts.assignedToRoute", { count: pickupIds.length, routeSuffix })
          : t("orders.toasts.assignedToRoute_plural", {
              count: pickupIds.length,
              routeSuffix,
            }),
      );
      onOpenChange(false);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setFormError(message);
      notifyError(message);
    }
  }

  const description =
    pickupIds.length === 1
      ? t("orders.dialogs.assignRouteDescription", { count: pickupIds.length })
      : t("orders.dialogs.assignRouteDescription_plural", { count: pickupIds.length });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="z-[70] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:p-4"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("orders.dialogs.assignRouteTitle")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="assign-daily-route">{t("orders.dialogs.dailyRoute")}</Label>
              <FieldEntityActions
                onAdd={openCreateDailyRoute}
                addIcon={RouteIcon}
                disabled={isSaving}
              />
            </div>
            <SearchableSelect
              id="assign-daily-route"
              value={routeId}
              onValueChange={(value) => {
                setRouteId(value);
                setFormError(null);
              }}
              placeholder={t("orders.dialogs.selectRoute")}
              searchPlaceholder={t("orders.dialogs.searchRoutes")}
              loading={dailyRoutesQuery.isLoading}
              loadingMessage={t("orders.dialogs.loadingRoutes")}
              emptyMessage={
                dailyRoutesQuery.isLoading
                  ? t("orders.dialogs.loadingRoutes")
                  : t("orders.dialogs.noRoutesFound")
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
            {t("orders.actions.assignRoute")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
