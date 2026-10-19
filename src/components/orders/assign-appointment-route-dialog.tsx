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
import type { Order } from "@/lib/orders/types";
import { DAILY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { formatRouteDate } from "@/lib/route-manager/display";
import { todayDateInputValue } from "@/lib/route-manager/types";

export type AssignableAppointment = Pick<Order, "id" | "date" | "completed" | "branch">;

type AssignAppointmentRouteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: AssignableAppointment[];
};

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** The API only accepts active pickup daily routes on the appointment's date and branch. */
function isRouteAssignableTo(
  route: ActiveRoute,
  date: string,
  branch: AssignableAppointment["branch"],
): boolean {
  if (!route.active || route.routeType !== "pickup") return false;
  if (route.date.slice(0, 10) !== date) return false;

  const routeCode = route.branch?.code?.trim().toUpperCase() ?? "";
  const appointmentCode = branch.code.trim().toUpperCase();
  if (routeCode && appointmentCode) return routeCode === appointmentCode;
  return route.branch?.id === branch.id;
}

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
  appointments,
}: AssignAppointmentRouteDialogProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const { openFormTab } = useWorkspaceTabs();
  const [routeId, setRouteId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const incompleteAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.id > 0 && !appointment.completed),
    [appointments],
  );
  const pickupIds = useMemo(
    () => incompleteAppointments.map((appointment) => appointment.id),
    [incompleteAppointments],
  );
  const skippedCompletedCount = appointments.length - incompleteAppointments.length;
  const routeDate = todayDateInputValue();
  const hasFutureAppointment = incompleteAppointments.some(
    (appointment) => appointment.date.trim().slice(0, 10) > routeDate,
  );
  const appointmentBranchCodes = uniqueValues(
    incompleteAppointments.map((appointment) => appointment.branch.code.trim().toUpperCase()),
  );
  const routeBranch =
    appointmentBranchCodes.length === 1 ? incompleteAppointments[0]?.branch ?? null : null;
  const routeBranchCode = appointmentBranchCodes[0] ?? "";

  const scopeError =
    incompleteAppointments.length === 0
      ? t("orders.dialogs.assignRouteAllCompleted")
      : hasFutureAppointment
        ? t("orders.dialogs.assignRouteFutureAppointment")
        : !routeBranch
          ? t("orders.dialogs.assignRouteMixedBranch")
          : null;

  const dailyRoutesQuery = useDailyRoutePicker(200, {
    enabled: open && !scopeError,
    routeType: "pickup",
    branchCode: routeBranchCode,
    date: routeDate,
  });
  const assignPickupsMutation = useAssignPickupsToRoute();

  const dailyRoutes = useMemo(
    () =>
      routeBranch
        ? (dailyRoutesQuery.data?.items ?? []).filter((route) =>
            isRouteAssignableTo(route, routeDate, routeBranch),
          )
        : [],
    [dailyRoutesQuery.data, routeDate, routeBranch],
  );
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
  const canSubmit = !scopeError && pickupIds.length > 0 && Boolean(routeId) && !isSaving;

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
    appointments.length === 1
      ? t("orders.dialogs.assignRouteDescription", { count: appointments.length })
      : t("orders.dialogs.assignRouteDescription_plural", { count: appointments.length });
  const scopeHint =
    !scopeError && routeDate
      ? t("orders.dialogs.assignRouteScope", {
          date: formatRouteDate(routeDate),
          branch: routeBranchCode,
        })
      : null;
  const skippedCompletedNotice =
    !scopeError && skippedCompletedCount > 0
      ? skippedCompletedCount === 1
        ? t("orders.dialogs.assignRouteSkippedCompleted", { count: skippedCompletedCount })
        : t("orders.dialogs.assignRouteSkippedCompleted_plural", { count: skippedCompletedCount })
      : null;

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
                  : t("orders.dialogs.noAssignableRoutesFound")
              }
              options={routeOptions}
              disabled={Boolean(scopeError) || isSaving}
              contentClassName="z-[80]"
              mobileSheet
            />
            {scopeHint ? <p className="text-xs text-muted-foreground">{scopeHint}</p> : null}
          </div>

          {skippedCompletedNotice ? (
            <p className="text-sm text-muted-foreground">{skippedCompletedNotice}</p>
          ) : null}
          {scopeError ? <p className="text-sm text-destructive">{scopeError}</p> : null}
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
