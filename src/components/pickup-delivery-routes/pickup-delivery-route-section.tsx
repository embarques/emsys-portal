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
import { formatContainerLabel, formatContainerRouteNumber } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import {
  formatRouteAssignmentDescriptionLines,
  formatRouteAssignmentName,
} from "@/lib/route-manager/display";
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
import { useCurrentUser } from "@/lib/users/hooks/use-users";

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
  const currentUserQuery = useCurrentUser();

  const [values, setValues] = useState<ActiveRouteFormValues>(() =>
    initialRecord
      ? activeRouteToFormValues(initialRecord)
      : createEmptyActiveRouteForm(fixedRouteType ?? "pickup"),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const defaultBranchAppliedRef = useRef(false);
  const syncedRouteRecordIdRef = useRef("");
  const effectiveRouteType = fixedRouteType ?? values.routeType;
  const branchCode = fixedBranchCode ?? values.branch.code;

  const routesQuery = useRoutePicker(200, {
    branchCode: branchCode.trim() || undefined,
    enabled: Boolean(branchCode.trim()),
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

  // Default the branch to the current user's branch for new schedules that do
  // not lock the branch (e.g. pickup routes). Applied once and never overrides
  // a branch the user picked or an existing record's branch.
  useEffect(() => {
    if (fixedBranchCode || initialRecord) return;
    if (defaultBranchAppliedRef.current) return;
    const userBranch = currentUserQuery.data?.branch;
    if (!userBranch || !(userBranch.id > 0)) return;
    defaultBranchAppliedRef.current = true;
    setValues((current) =>
      current.branch.id > 0
        ? current
        : { ...current, branch: { id: userBranch.id, code: userBranch.code } },
    );
  }, [currentUserQuery.data?.branch, fixedBranchCode, initialRecord]);

  const upsertMutation = useUpsertActiveRoute();
  const createRouteMutation = useCreateRoute();
  const selectedRouteQuery = useRoute(values.routeRecordId || null, Boolean(values.routeRecordId));

  useEffect(() => {
    if (initialRecord) {
      syncedRouteRecordIdRef.current = "";
      setValues(activeRouteToFormValues(initialRecord));
    }
  }, [initialRecord]);

  const routeOptions = useMemo(() => {
    const items = routesQuery.data?.items ?? [];
    return [...items]
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
          route.vehicle.name,
          route.vehicle.branch ?? "",
        ],
      }));
  }, [routesQuery.data?.items]);

  const selectedRoute = selectedRouteQuery.data ?? null;

  // Sync crew from the selected route template when the user picks a route.
  // Runs once per routeRecordId so role edits are not overwritten on re-render.
  useEffect(() => {
    const routeRecordId = values.routeRecordId.trim();
    if (!routeRecordId || selectedRouteQuery.isLoading) return;
    if (!selectedRoute) return;

    const alreadySynced = syncedRouteRecordIdRef.current === routeRecordId;
    if (alreadySynced && values.employees.length > 0) return;

    syncedRouteRecordIdRef.current = routeRecordId;
    const crew = selectedRoute.employees;

    setValues((current) => {
      const rolesById = new Map(current.employees.map((employee) => [employee.id, employee.role]));
      const employees = crew.map((employee) => {
        let role = rolesById.get(employee.id) ?? resolveCrewRole(employee.role);
        if (effectiveRouteType === "delivery" && role === "appraiser") {
          role = "driver";
        }
        return { id: employee.id, name: employee.name, role };
      });
      return {
        ...current,
        routeAssignmentName: formatRouteAssignmentName(selectedRoute),
        employees,
      };
    });
  }, [
    effectiveRouteType,
    selectedRoute,
    selectedRouteQuery.isLoading,
    values.employees.length,
    values.routeRecordId,
  ]);

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

  const isSaving = upsertMutation.isPending;
  const isDelivery = effectiveRouteType === "delivery";
  const isEditing = Boolean(initialRecord);
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
    syncedRouteRecordIdRef.current = "";
    setValues((current) => ({
      ...current,
      routeRecordId: "",
      routeAssignmentName: "",
      employees: [],
      ...partial,
    }));
    setFormError(null);
  }

  function handleRouteTypeChange(routeType: RouteType) {
    if (fixedRouteType) return;
    resetSchedule({
      routeType,
      // Delivery routes are always date-based.
      scheduleType: routeType === "delivery" ? "date" : values.scheduleType,
      dayOfWeek: routeType === "delivery" ? [] : values.dayOfWeek,
      container: routeType === "delivery" ? values.container : null,
    });
  }

  function handleScheduleTypeChange(scheduleType: RouteScheduleType) {
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
    resetSchedule({
      container: {
        id: container.id,
        name: formatContainerRouteNumber(container),
      },
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
      await upsertMutation.mutateAsync({
        values: {
          ...values,
          routeType: effectiveRouteType,
          container: isDelivery ? values.container : null,
        },
        existingId: initialRecord?.id,
      });
      notifySuccess(t("routes.activeRoute.saved"));
      onSaved?.();
    } catch (error) {
      setFormError(normalizeApiError(error).message);
    }
  }

  function buildCreateRouteInitialValues(): RouteFormValues {
    const form = createEmptyRouteForm(displayName ?? undefined);
    if (values.branch.id > 0 || values.branch.code.trim()) {
      form.branch = {
        id: values.branch.id,
        code: values.branch.code,
      };
    }
    return form;
  }

  async function handleCreateRoute(routeValues: RouteFormValues) {
    setCreateFormError(null);
    try {
      const created = await createRouteMutation.mutateAsync(routeValues);
      setValues((current) => ({
        ...current,
        routeRecordId: created.id,
        routeAssignmentName: created.name,
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
          syncedRouteRecordIdRef.current = "";
          const assignment = (routesQuery.data?.items ?? []).find((route) => route.id === routeRecordId);
          setValues((current) => ({
            ...current,
            routeRecordId,
            routeAssignmentName: assignment ? formatRouteAssignmentName(assignment) : "",
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
          {createDialogOpen ? (
            <RouteForm
              key="create-route-from-active"
              initialValues={buildCreateRouteInitialValues()}
              submitLabel={t("routes.activeRoute.createRoute")}
              isSubmitting={createRouteMutation.isPending}
              externalError={createFormError}
              onSubmit={handleCreateRoute}
              onCancel={() => setCreateDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
