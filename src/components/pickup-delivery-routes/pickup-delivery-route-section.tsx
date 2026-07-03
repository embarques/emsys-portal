"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActiveRouteForm } from "@/components/pickup-delivery-routes/pickup-delivery-route-form";
import { RouteForm } from "@/components/route-manager/route-form";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useActiveRoute,
  useUpsertActiveRoute,
} from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import {
  activeRouteToFormValues,
  createEmptyActiveRouteForm,
  DAYS_OF_WEEK,
  type ActiveRoute,
  type ActiveRouteFormValues,
  type RouteScheduleType,
  type RouteType,
} from "@/lib/pickup-delivery-routes/types";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { formatRouteCopyLabel } from "@/lib/route-manager/display";
import {
  useCreateRoute,
  useRoute,
  useRoutePicker,
} from "@/lib/route-manager/hooks/use-route-manager";
import {
  createEmptyRouteForm,
  resolveCrewRole,
  setCrewMemberRole,
  type RouteCrewRole,
  type RouteFormValues,
} from "@/lib/route-manager/types";
import type { ActiveRoutesDirectoryVariant } from "@/lib/pickup-delivery-routes/directory-variant";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useAuth } from "@/providers/auth-provider";

type ActiveRouteSectionProps = {
  initialRecord?: ActiveRoute | null;
  variant?: ActiveRoutesDirectoryVariant;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function ActiveRouteSection({
  initialRecord = null,
  variant,
  onSaved,
  onCancel,
}: ActiveRouteSectionProps) {
  const fixedRouteType = variant?.routeType;
  const showRouteTypeField = variant?.showRouteTypeField ?? true;
  const showContainerField = variant?.showContainerField;
  const fixedBranchCode = variant?.fixedBranchCode;

  const { t } = useTranslation();
  const { displayName } = useAuth();
  const { notifySuccess } = useFeedback();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const containersQuery = useContainerPicker(200);
  const containers = containersQuery.data?.items ?? [];
  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];

  const [values, setValues] = useState<ActiveRouteFormValues>(() =>
    initialRecord
      ? activeRouteToFormValues(initialRecord)
      : createEmptyActiveRouteForm(fixedRouteType ?? "pickup"),
  );
  const [savedRecord, setSavedRecord] = useState<ActiveRoute | null>(initialRecord);
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const hydratedLookupRef = useRef("");
  const effectiveRouteType = fixedRouteType ?? values.routeType;
  const branchCode = fixedBranchCode ?? values.branch.code;

  const routesQuery = useRoutePicker(200, {
    branchCode: branchCode.trim() || undefined,
  });

  // Lock the branch to the variant's fixed code (e.g. delivery routes → RD).
  useEffect(() => {
    if (!fixedBranchCode || initialRecord) return;
    const match = branches.find(
      (branch) => branch.code.toLowerCase() === fixedBranchCode.toLowerCase(),
    );
    if (!match) return;
    setValues((current) =>
      current.branch.id === match.id && current.branch.code === match.code
        ? current
        : { ...current, branch: { id: match.id, code: match.code } },
    );
  }, [branches, fixedBranchCode, initialRecord]);

  // Auto-detect an existing schedule only for date-based routes.
  const lookup = useMemo(() => {
    if (values.scheduleType !== "date") return null;
    const date = values.date.trim();
    if (!date) return null;

    if (effectiveRouteType === "pickup") {
      return { routeType: effectiveRouteType, date };
    }

    const containerId = values.container?.id ?? 0;
    if (effectiveRouteType === "delivery" && containerId > 0) {
      return { routeType: effectiveRouteType, date, containerId };
    }

    return null;
  }, [effectiveRouteType, values.scheduleType, values.date, values.container?.id]);

  const activeRouteQuery = useActiveRoute(lookup);
  const upsertMutation = useUpsertActiveRoute();
  const createRouteMutation = useCreateRoute();
  const selectedRouteQuery = useRoute(values.routeRecordId || null, Boolean(values.routeRecordId));

  useEffect(() => {
    if (initialRecord) {
      setValues(activeRouteToFormValues(initialRecord));
      setSavedRecord(initialRecord);
    }
  }, [initialRecord]);

  useEffect(() => {
    if (!lookup || activeRouteQuery.isLoading || initialRecord) return;

    const lookupKey = `${lookup.routeType}:${lookup.date}:${lookup.containerId ?? "pickup"}`;
    if (activeRouteQuery.data) {
      if (hydratedLookupRef.current === lookupKey) return;

      setValues(activeRouteToFormValues(activeRouteQuery.data));
      setSavedRecord(activeRouteQuery.data);
      hydratedLookupRef.current = lookupKey;
      return;
    }

    if (hydratedLookupRef.current === lookupKey) return;

    setSavedRecord(null);
    setValues((current) => ({
      ...current,
      routeRecordId: "",
      employees: [],
    }));
    hydratedLookupRef.current = lookupKey;
  }, [activeRouteQuery.data, activeRouteQuery.isLoading, initialRecord, lookup]);

  const routeOptions = useMemo(() => {
    const items = routesQuery.data?.items ?? [];
    return [...items]
      .sort((left, right) => formatRouteCopyLabel(left).localeCompare(formatRouteCopyLabel(right)))
      .map((route) => ({
        value: route.id,
        label: formatRouteCopyLabel(route),
        keywords: [route.name, route.routeId, route.vehicle.name, route.vehicle.branch ?? ""],
      }));
  }, [routesQuery.data?.items]);

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.code,
        label: formatBranchFilterLabel(branch),
        keywords: [branch.code, branch.name],
      })),
    [branches],
  );

  const dayOfWeekOptions = useMemo(
    () =>
      DAYS_OF_WEEK.map((day) => ({
        value: day,
        label: t(`routes.activeRoute.days.${day}`),
      })),
    [t],
  );

  const containerOptions = useMemo(() => {
    const options = containers.map((container) => ({
      value: String(container.id),
      label: formatContainerLabel(container),
    }));

    if (
      values.container &&
      values.container.id > 0 &&
      !options.some((option) => option.value === String(values.container?.id))
    ) {
      options.unshift({
        value: String(values.container.id),
        label: values.container.name,
      });
    }

    return options;
  }, [containers, values.container]);

  const selectedRoute = selectedRouteQuery.data ?? null;

  // Sync the crew from the selected route template, preserving any per-schedule
  // role edits for crew members that remain on the route.
  useEffect(() => {
    if (!selectedRoute || selectedRouteQuery.isLoading) return;

    const crew = selectedRoute.employees;
    setValues((current) => {
      const rolesById = new Map(current.employees.map((employee) => [employee.id, employee.role]));
      const employees = crew.map((employee) => {
        let role = rolesById.get(employee.id) ?? resolveCrewRole(employee.role);
        // Deliveries have no appraiser role.
        if (effectiveRouteType === "delivery" && role === "appraiser") {
          role = "driver";
        }
        return { id: employee.id, name: employee.name, role };
      });
      return { ...current, employees };
    });
  }, [selectedRoute, selectedRouteQuery.isLoading, effectiveRouteType]);

  const isSaving = upsertMutation.isPending;
  const isDelivery = effectiveRouteType === "delivery";
  const isEditing = Boolean(initialRecord ?? savedRecord?.id);
  const scheduleFilled =
    values.scheduleType === "date"
      ? Boolean(values.date.trim())
      : values.dayOfWeek.length > 0;
  const submitDisabled =
    !scheduleFilled ||
    !(values.branch.id > 0) ||
    (isDelivery && (!values.container || values.container.id <= 0)) ||
    !values.routeRecordId.trim();

  function resetSchedule(partial: Partial<ActiveRouteFormValues>) {
    setValues((current) => ({
      ...current,
      routeRecordId: "",
      employees: [],
      ...partial,
    }));
    setSavedRecord(null);
    setFormError(null);
  }

  function handleRouteTypeChange(routeType: RouteType) {
    if (fixedRouteType) return;
    hydratedLookupRef.current = "";
    resetSchedule({
      routeType,
      // Delivery routes are always date-based.
      scheduleType: routeType === "delivery" ? "date" : values.scheduleType,
      dayOfWeek: routeType === "delivery" ? [] : values.dayOfWeek,
      container: routeType === "delivery" ? values.container : null,
    });
  }

  function handleScheduleTypeChange(scheduleType: RouteScheduleType) {
    hydratedLookupRef.current = "";
    resetSchedule({ scheduleType });
  }

  function handleBranchChange(nextBranchCode: string) {
    const branch = branches.find((entry) => entry.code === nextBranchCode);
    resetSchedule({
      branch: { id: branch?.id ?? 0, code: branch?.code ?? nextBranchCode },
    });
  }

  function updateContainer(nextValue: string) {
    const container = containers.find((entry) => String(entry.id) === nextValue);
    if (!container) return;
    hydratedLookupRef.current = "";
    resetSchedule({
      container: { id: container.id, name: formatContainerLabel(container) },
    });
  }

  function handleRoleChange(employeeId: number, role: RouteCrewRole) {
    setValues((current) => ({
      ...current,
      employees: setCrewMemberRole(current.employees, employeeId, role),
    }));
    setFormError(null);
  }

  async function saveActiveRoute() {
    setFormError(null);

    if (!scheduleFilled) {
      setFormError(
        values.scheduleType === "date"
          ? t("routes.activeRoute.errors.date")
          : t("routes.activeRoute.errors.dayOfWeek"),
      );
      return;
    }
    if (!(values.branch.id > 0)) {
      setFormError(t("routes.activeRoute.errors.branch"));
      return;
    }
    if (effectiveRouteType === "delivery" && (!values.container || values.container.id <= 0)) {
      setFormError(t("routes.activeRoute.errors.container"));
      return;
    }
    if (!values.routeRecordId.trim()) {
      setFormError(t("routes.activeRoute.errors.route"));
      return;
    }

    try {
      const record = await upsertMutation.mutateAsync({
        values: {
          ...values,
          routeType: effectiveRouteType,
          container: isDelivery ? values.container : null,
        },
        existingId: savedRecord?.id ?? initialRecord?.id,
      });
      setSavedRecord(record);
      notifySuccess(t("routes.activeRoute.saved"));
      onSaved?.();
    } catch (error) {
      setFormError(normalizeApiError(error).message);
    }
  }

  function buildCreateRouteInitialValues(): RouteFormValues {
    return createEmptyRouteForm(displayName ?? undefined);
  }

  async function handleCreateRoute(routeValues: RouteFormValues) {
    setCreateFormError(null);
    try {
      const created = await createRouteMutation.mutateAsync(routeValues);
      setValues((current) => ({
        ...current,
        routeRecordId: created.id,
      }));
      setCreateDialogOpen(false);
      notifySuccess(t("routes.activeRoute.routeCreated"));
    } catch (error) {
      setCreateFormError(normalizeApiError(error).message);
    }
  }

  return (
    <>
      <ActiveRouteForm
        values={{ ...values, routeType: effectiveRouteType }}
        isEditing={isEditing}
        isDelivery={isDelivery}
        showRouteTypeField={showRouteTypeField}
        showContainerField={showContainerField}
        showBranchField={!fixedBranchCode}
        submitLabel={
          isEditing ? t("common.actions.saveChanges") : t("routes.activeRoute.save")
        }
        isSubmitting={isSaving}
        externalError={formError}
        routeOptions={routeOptions}
        containerOptions={containerOptions}
        branchOptions={branchOptions}
        dayOfWeekOptions={dayOfWeekOptions}
        branchCode={branchCode}
        branchesLoading={branchesQuery.isLoading}
        routesLoading={routesQuery.isLoading}
        selectedRouteLoading={selectedRouteQuery.isLoading}
        submitDisabled={submitDisabled}
        onRouteTypeChange={handleRouteTypeChange}
        onScheduleTypeChange={handleScheduleTypeChange}
        onBranchChange={handleBranchChange}
        onDateChange={(date) => {
          hydratedLookupRef.current = "";
          resetSchedule({ date });
        }}
        onDayOfWeekChange={(dayOfWeek) => {
          setValues((current) => ({ ...current, dayOfWeek }));
          setFormError(null);
        }}
        onNameChange={(name) => {
          setValues((current) => ({ ...current, name }));
        }}
        onContainerChange={updateContainer}
        onRouteRecordChange={(routeRecordId) => {
          setValues((current) => ({
            ...current,
            routeRecordId,
            employees: [],
          }));
          setFormError(null);
        }}
        onRoleChange={handleRoleChange}
        onActiveChange={(active) => {
          setValues((current) => ({ ...current, active }));
        }}
        onCreateRouteClick={() => {
          if (isDesktopTabs) {
            openFormTab({
              feature: "routes",
              baseHref: "/routes",
              mode: "add",
              label: t("routes.form.addTabLabel"),
            });
            return;
          }
          setCreateFormError(null);
          setCreateDialogOpen(true);
        }}
        onSubmit={saveActiveRoute}
        onCancel={onCancel}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("routes.createDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("routes.createDialog.description", { date: values.date })}
            </DialogDescription>
          </DialogHeader>
          <RouteForm
            initialValues={buildCreateRouteInitialValues()}
            submitLabel={t("routes.activeRoute.createRoute")}
            isSubmitting={createRouteMutation.isPending}
            externalError={createFormError}
            onSubmit={handleCreateRoute}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
