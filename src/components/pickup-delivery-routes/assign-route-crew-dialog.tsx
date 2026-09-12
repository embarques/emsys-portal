"use client";

import { useEffect, useMemo, useState } from "react";
import { Route as RouteIcon } from "lucide-react";

import { CrewRolePicker } from "@/components/route-manager/crew-role-picker";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
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
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { findBranchByCodeOrId, resolveUserBranchRef } from "@/lib/branches/user-branch";
import { formatContainerLabel, formatContainerRouteNumber } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useTranslation } from "@/lib/i18n";
import { useAssignBarcodesToRoute } from "@/lib/labels/hooks/use-barcodes";
import { formatOrderRouteName } from "@/lib/orders/display";
import { useAssignPickupsToRoute } from "@/lib/orders/hooks/use-orders";
import { DELIVERY_BRANCH_CODE } from "@/lib/pickup-delivery-routes/directory-variant";
import {
  useScheduledRouteByCrewAndDate,
  useUpsertActiveRoute,
} from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import {
  buildScheduledRouteFormValues,
  type ActiveRouteBranchRef,
  type ActiveRouteContainerRef,
  type RouteType,
} from "@/lib/pickup-delivery-routes/types";
import {
  formatRouteAssignmentDescriptionLines,
  formatRouteAssignmentName,
} from "@/lib/route-manager/display";
import { useRoute, useRoutePicker } from "@/lib/route-manager/hooks/use-route-manager";
import {
  crewFromRouteGroup,
  getRouteBranchCode,
  setVehicleRouteCrewRole,
  todayDateInputValue,
  type Route,
  type RouteCrewRole,
  type RouteEmployeeRef,
} from "@/lib/route-manager/types";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

export type AssignRouteCrewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeType: RouteType;
  pickupIds?: number[];
  barcodeIds?: string[];
  defaultDate?: string;
  defaultContainer?: ActiveRouteContainerRef | null;
};

function resolveBranchFromRouteCrew(
  routeCrew: Route,
  branches: Array<{ id: number; code: string; name: string }>,
  fallbackCode?: string,
): ActiveRouteBranchRef | null {
  const code = getRouteBranchCode(routeCrew) || fallbackCode?.trim() || "";
  if (!code) return null;
  const match = findBranchByCodeOrId(branches, {
    id: 0,
    code,
  });
  if (!match || !(match.id > 0)) return null;
  return { id: match.id, code: match.code, name: match.name };
}

export function AssignRouteCrewDialog({
  open,
  onOpenChange,
  routeType,
  pickupIds = [],
  barcodeIds = [],
  defaultDate,
  defaultContainer = null,
}: AssignRouteCrewDialogProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const isDelivery = routeType === "delivery";
  const deliveryBarcodeIds = barcodeIds;
  const pickupItemIds = pickupIds;
  const itemCount = isDelivery ? deliveryBarcodeIds.length : pickupItemIds.length;
  const deliveryBranchCode = DELIVERY_BRANCH_CODE;

  const [date, setDate] = useState(todayDateInputValue());
  const [branchCode, setBranchCode] = useState("");
  const [routeCrewId, setRouteCrewId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [employees, setEmployees] = useState<RouteEmployeeRef[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const parsedContainerId = Number(containerId);
  const selectedContainerId =
    Number.isInteger(parsedContainerId) && parsedContainerId > 0 ? parsedContainerId : 0;
  const pickupBranchCode = branchCode.trim();

  const currentUserQuery = useCurrentUser();
  const routesQuery = useRoutePicker(200, {
    enabled: open && (isDelivery || Boolean(pickupBranchCode)),
    ...(isDelivery && deliveryBranchCode
      ? { branchCode: deliveryBranchCode }
      : pickupBranchCode
        ? { branchCode: pickupBranchCode }
        : {}),
  });
  const branchesQuery = useBranchPicker(200, { enabled: open });
  const containersQuery = useContainerPicker(200, { enabled: open && isDelivery });
  const selectedRouteQuery = useRoute(routeCrewId || null, open && Boolean(routeCrewId));
  const existingRouteQuery = useScheduledRouteByCrewAndDate({
    routeRecordId: open ? routeCrewId || null : null,
    date: open ? date : "",
    routeType,
    containerId: isDelivery ? selectedContainerId : undefined,
    enabled: open,
  });
  const upsertMutation = useUpsertActiveRoute();
  const assignPickupsMutation = useAssignPickupsToRoute();
  const assignBarcodesMutation = useAssignBarcodesToRoute();

  const routeCrews = useMemo(
    () => (routesQuery.data?.items ?? []).filter((route) => route.active),
    [routesQuery.data?.items],
  );
  const branches = branchesQuery.data?.items ?? [];
  const containers = containersQuery.data?.items ?? [];
  const selectedCrew =
    selectedRouteQuery.data ??
    routeCrews.find((route) => route.id === routeCrewId) ??
    null;

  const selectedCrewId = selectedCrew?.id ?? "";
  const existingRouteId = existingRouteQuery.data?.id ?? "";
  const crewEmployees = selectedCrew?.employees;
  const existingEmployees = existingRouteQuery.data?.employees;

  useEffect(() => {
    if (!open) {
      setRouteCrewId("");
      setEmployees([]);
      setContainerId("");
      setBranchCode("");
      setFormError(null);
      return;
    }
    setDate(defaultDate?.trim().slice(0, 10) || todayDateInputValue());
    setContainerId(
      defaultContainer && defaultContainer.id > 0 ? String(defaultContainer.id) : "",
    );
  }, [open, defaultDate, defaultContainer?.id]);

  useEffect(() => {
    if (!open || isDelivery) return;
    const resolved = resolveUserBranchRef(currentUserQuery.data?.branch, branches);
    if (!resolved) return;
    setBranchCode((current) => current.trim() || resolved.code);
  }, [open, isDelivery, branches, currentUserQuery.data?.branch]);

  useEffect(() => {
    if (!open) return;
    if (!selectedCrewId || !crewEmployees) {
      setEmployees([]);
      return;
    }
    if (existingRouteQuery.isLoading) return;
    setEmployees(crewFromRouteGroup(crewEmployees, existingEmployees));
  }, [
    open,
    selectedCrewId,
    existingRouteId,
    existingRouteQuery.isLoading,
    crewEmployees,
    existingEmployees,
  ]);

  const routeCrewOptions = useMemo(
    () =>
      [...routeCrews]
        .sort((left, right) =>
          formatRouteAssignmentName(left).localeCompare(formatRouteAssignmentName(right)),
        )
        .map((route) => ({
          value: route.id,
          label: formatRouteAssignmentName(route),
          descriptionLines: formatRouteAssignmentDescriptionLines(route),
          keywords: [
            route.name,
            route.routeId,
            getRouteBranchCode(route),
            ...route.employees.map((employee) => employee.name),
          ],
        })),
    [routeCrews],
  );

  const containerOptions = useMemo(() => {
    const options = containers.map((container) => ({
      value: String(container.id),
      label: formatContainerLabel(container),
      keywords: [container.name, container.containerNumber],
    }));

    if (
      defaultContainer &&
      defaultContainer.id > 0 &&
      !options.some((option) => option.value === String(defaultContainer.id))
    ) {
      options.unshift({
        value: String(defaultContainer.id),
        label: defaultContainer.name.trim() || String(defaultContainer.id),
        keywords: [defaultContainer.name],
      });
    }

    return options;
  }, [containers, defaultContainer]);

  const isSaving =
    upsertMutation.isPending ||
    assignPickupsMutation.isPending ||
    assignBarcodesMutation.isPending;
  const crewLoading =
    Boolean(routeCrewId) && (selectedRouteQuery.isLoading || existingRouteQuery.isLoading);
  const canSubmit =
    itemCount > 0 &&
    Boolean(date.trim()) &&
    Boolean(routeCrewId) &&
    employees.length > 0 &&
    (!isDelivery || selectedContainerId > 0) &&
    !crewLoading &&
    !isSaving;

  function handleRoleChange(employeeId: number, role: RouteCrewRole) {
    setEmployees((current) => setVehicleRouteCrewRole(current, employeeId, role));
    setFormError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSaving) return;
    onOpenChange(nextOpen);
  }

  function resolveSelectedContainer(): ActiveRouteContainerRef | null {
    const picked = containers.find((container) => container.id === selectedContainerId);
    if (picked) {
      return { id: picked.id, name: formatContainerRouteNumber(picked) };
    }
    if (defaultContainer && defaultContainer.id === selectedContainerId) {
      return { ...defaultContainer };
    }
    return null;
  }

  async function confirmAssign() {
    if (!canSubmit || !selectedCrew) return;

    const branch = resolveBranchFromRouteCrew(
      selectedCrew,
      branches,
      isDelivery ? deliveryBranchCode : undefined,
    );
    if (!branch) {
      setFormError(t("orders.dialogs.branchRequired"));
      return;
    }
    if (employees.length === 0) {
      setFormError(t("orders.dialogs.crewRequired"));
      return;
    }

    const container = isDelivery ? resolveSelectedContainer() : null;
    if (isDelivery && !container) {
      setFormError(t("routes.activeRoute.errors.container"));
      return;
    }

    try {
      const saved = await upsertMutation.mutateAsync({
        values: buildScheduledRouteFormValues({
          routeType,
          routeRecordId: selectedCrew.id,
          routeAssignmentName: formatRouteAssignmentName(selectedCrew),
          date,
          branch,
          employees,
          container,
        }),
        existingId: existingRouteQuery.data?.id,
      });

      if (isDelivery) {
        const result = await assignBarcodesMutation.mutateAsync({
          routeId: saved.id,
          barcodeIds: deliveryBarcodeIds,
        });
        const routeName =
          result.routeName ||
          saved.name ||
          formatRouteAssignmentName(selectedCrew);
        notifySuccess(
          t("labels.staging.success.assignedToRoute", {
            count: result.assignedCount,
            route: routeName,
            trip: result.tripNumber,
          }),
        );
      } else {
        await assignPickupsMutation.mutateAsync({ routeId: saved.id, pickupIds: pickupItemIds });
        const routeName = formatOrderRouteName({ routeId: saved.id }, saved, t);
        const routeSuffix = routeName
          ? t("orders.toasts.assignedToRouteNamed", { routeName })
          : "";
        notifySuccess(
          pickupItemIds.length === 1
            ? t("orders.toasts.assignedToRoute", { count: pickupItemIds.length, routeSuffix })
            : t("orders.toasts.assignedToRoute_plural", {
                count: pickupItemIds.length,
                routeSuffix,
              }),
        );
      }

      onOpenChange(false);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setFormError(message);
      notifyError(message);
    }
  }

  const description =
    itemCount === 1
      ? isDelivery
        ? t("labels.staging.routeDialog.description", { count: itemCount })
        : t("orders.dialogs.assignRouteDescription", { count: itemCount })
      : isDelivery
        ? t("labels.staging.routeDialog.description_plural", { count: itemCount })
        : t("orders.dialogs.assignRouteDescription_plural", { count: itemCount });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="z-[70] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:p-4"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isDelivery
              ? t("labels.staging.routeDialog.title")
              : t("orders.dialogs.assignRouteTitle")}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="assign-route-date">{t("orders.dialogs.assignmentDate")}</Label>
            <DateInput
              id="assign-route-date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setFormError(null);
              }}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="assign-route-crew">{t("routes.activeRoute.route")}</Label>
            <SearchableSelect
              id="assign-route-crew"
              value={routeCrewId}
              onValueChange={(value) => {
                setRouteCrewId(value);
                setEmployees([]);
                setFormError(null);
              }}
              placeholder={t("orders.dialogs.selectRouteGroup")}
              searchPlaceholder={t("orders.dialogs.searchRouteGroups")}
              loading={routesQuery.isLoading}
              emptyMessage={
                routesQuery.isLoading
                  ? t("orders.dialogs.loadingRouteGroups")
                  : t("orders.dialogs.noRouteGroupsFound")
              }
              options={routeCrewOptions}
              contentClassName="z-[80]"
              mobileSheet
            />
          </div>

          {isDelivery ? (
            <div className="space-y-1">
              <Label htmlFor="assign-route-container">{t("routes.activeRoute.container")}</Label>
              <SearchableSelect
                id="assign-route-container"
                value={containerId}
                onValueChange={(value) => {
                  setContainerId(value);
                  setFormError(null);
                }}
                placeholder={t("labels.staging.routeDialog.selectContainer")}
                searchPlaceholder={t("routes.activeRoute.containerSearch")}
                loading={containersQuery.isLoading}
                emptyMessage={
                  containersQuery.isLoading
                    ? t("labels.staging.routeDialog.loadingContainers")
                    : t("labels.staging.routeDialog.noContainers")
                }
                options={containerOptions}
                contentClassName="z-[80]"
                mobileSheet
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t("orders.dialogs.selectCrewRoles")}</Label>
            {routeCrewId ? (
              <CrewRolePicker
                employees={employees}
                onRoleChange={handleRoleChange}
                roles={["driver", "appraiser", "helper"]}
                toggleLeadRoles
                loading={crewLoading}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("orders.dialogs.selectRouteGroupFirst")}
              </p>
            )}
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>

        <DialogFooter className="max-md:grid max-md:grid-cols-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={() => void confirmAssign()} disabled={!canSubmit}>
            <RouteIcon className="h-4 w-4" />
            {isDelivery
              ? t("labels.staging.routeDialog.assign")
              : t("orders.actions.assignRoute")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
