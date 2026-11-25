"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Route as RouteIcon } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
import { isAssignableRouteDate } from "@/lib/pickup-delivery-routes/assignment-policy";
import { useAssignmentBusinessDate } from "@/lib/pickup-delivery-routes/hooks/use-assignment-today";

export type AssignableAppointment = Pick<Order, "id" | "date" | "completed" | "branch">;

type AssignAppointmentRouteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: AssignableAppointment[];
};

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** Active pickup daily routes for the appointment branch, dated today or later. */
function isRouteAssignableTo(
  route: ActiveRoute,
  today: string,
  branch: AssignableAppointment["branch"],
): boolean {
  if (!route.active || route.routeType !== "pickup") return false;
  if (!today || !isAssignableRouteDate(route.date, today)) return false;

  const routeCode = route.branch?.code?.trim().toUpperCase() ?? "";
  const appointmentCode = branch.code.trim().toUpperCase();
  if (routeCode && appointmentCode) return routeCode === appointmentCode;
  return route.branch?.id === branch.id;
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
  /** Ignore the first outside pointer after open (DropdownMenu select race). */
  const ignoreOutsideCloseRef = useRef(false);

  const incompleteAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.id > 0 && !appointment.completed),
    [appointments],
  );
  const pickupIds = useMemo(
    () => incompleteAppointments.map((appointment) => appointment.id),
    [incompleteAppointments],
  );
  const skippedCompletedCount = appointments.length - incompleteAppointments.length;
  const appointmentBranchCodes = uniqueValues(
    incompleteAppointments.map((appointment) => appointment.branch.code.trim().toUpperCase()),
  );
  const routeBranch =
    appointmentBranchCodes.length === 1 ? incompleteAppointments[0]?.branch ?? null : null;
  const routeBranchCode = appointmentBranchCodes[0] ?? "";
  const businessDate = useAssignmentBusinessDate(open, routeBranch?.id);
  const today = businessDate.today;

  const scopeError =
    incompleteAppointments.length === 0
      ? t("orders.dialogs.assignRouteAllCompleted")
      : !routeBranch
        ? t("orders.dialogs.assignRouteMixedBranch")
        : null;

  const dailyRoutesQuery = useDailyRoutePicker(200, {
    enabled: open && !scopeError,
    routeType: "pickup",
    branchCode: routeBranchCode,
    branchId: routeBranch?.id,
    assignable: true,
  });
  const assignPickupsMutation = useAssignPickupsToRoute();

  const dailyRoutes = useMemo(
    () =>
      routeBranch
        ? (dailyRoutesQuery.data?.items ?? []).filter((route) =>
            isRouteAssignableTo(route, today, routeBranch),
          )
        : [],
    [dailyRoutesQuery.data, today, routeBranch],
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
      ignoreOutsideCloseRef.current = false;
      return;
    }

    ignoreOutsideCloseRef.current = true;
    const timer = window.setTimeout(() => {
      ignoreOutsideCloseRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const isSaving = assignPickupsMutation.isPending;
  const canSubmit = Boolean(today) && !scopeError && pickupIds.length > 0 && Boolean(selectedRoute) && !isSaving;

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
    if (!canSubmit || !selectedRoute) return;

    try {
      await assignPickupsMutation.mutateAsync({ routeId, pickupIds, routeDate: selectedRoute.date, branchId: selectedRoute.branch?.id });
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
    !scopeError && today
      ? t("orders.dialogs.assignRouteScope", {
          date: formatRouteDate(today),
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
      <CompactActionDialogContent
        onPointerDownOutside={(event) => {
          if (ignoreOutsideCloseRef.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (ignoreOutsideCloseRef.current) event.preventDefault();
        }}
      >
        <CompactActionDialogHeader
          icon={RouteIcon}
          title={t("orders.dialogs.assignRouteTitle")}
          description={description}
        />

        <CompactActionDialogBody>
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
              loading={businessDate.isFetching || dailyRoutesQuery.isLoading}
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
            {businessDate.isError ? <p role="alert" className="text-xs text-destructive">{t("routes.errors.businessDateUnavailable")}</p> : null}
            {scopeHint ? <p className="text-xs text-muted-foreground">{scopeHint}</p> : null}
          </div>

          {skippedCompletedNotice ? (
            <p className="text-sm text-muted-foreground">{skippedCompletedNotice}</p>
          ) : null}
          {scopeError ? <p className="text-sm text-destructive">{scopeError}</p> : null}
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </CompactActionDialogBody>

        <CompactActionDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={() => void confirmAssign()} disabled={!canSubmit}>
            <RouteIcon className="h-4 w-4" />
            {t("orders.actions.assignRoute")}
          </Button>
        </CompactActionDialogFooter>
      </CompactActionDialogContent>
    </Dialog>
  );
}
