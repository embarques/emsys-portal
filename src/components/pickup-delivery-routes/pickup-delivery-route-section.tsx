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
import { useUserError } from "@/lib/errors/use-user-error";
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
  setVehicleRouteCrewRole,
  type RouteCrewRole,
  type RouteEmployeeRef,
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
  const { toErrorMessage } = useUserError();
  const copyPrefix = variant?.copyPrefix;
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
        : { ...current, branch: { id: match.id, code: match.code, name: match.name } },
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
        : {
            ...current,
            branch: {
              id: userBranch.id,
              code: userBranch.code,
              name: userBranch.name || "",
            },
          },
    );
  }, [currentUserQuery.data?.branch, fixedBranchCode, initialRecord]);

  // Keep branch name in sync with the branch directory (required on API write).
  useEffect(() => {
    const code = values.branch.code.trim();
    if (!code || branches.length === 0) return;

    const match = branches.find(
      (branch) => branch.code.trim().toLowerCase() === code.toLowerCase(),
    );
    if (!match) return;

    setValues((current) => {
      const name = match.name.trim();
      if (
        current.branch.id === match.id &&
        current.branch.code === match.code &&
        current.branch.name?.trim() === name
      ) {
        return current;
      }

      return {
        ...current,
        branch: { id: match.id, code: match.code, name },
      };
    });
  }, [branches, values.branch.code]);

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
      const existingById = new Map(current.employees.map((employee) => [employee.id, employee]));
      const templateIds = new Set(crew.map((employee) => employee.id));
      const employeesFromTemplate = crew.map((employee) => {
        const existing = existingById.get(employee.id);
        return {
          id: employee.id,
          name: employee.name,
          role: existing?.role ?? resolveCrewRole(employee.role),
          ...(existing?.roles ? { roles: existing.roles } : {}),
        };
      });
      const extraEmployees = current.employees.filter((employee) => !templateIds.has(employee.id));
      return {
        ...current,
        routeAssignmentName: formatRouteAssignmentName(selectedRoute),
        employees: [...employeesFromTemplate, ...extraEmployees],
      };
    });
  }, [
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
      rate: routeType === "delivery" ? values.rate : "",
    });
  }

  function handleScheduleTypeChange(scheduleType: RouteScheduleType) {
    resetSchedule({ scheduleType });
  }

  function handleBranchChange(nextBranchCode: string) {
    const normalized = nextBranchCode.trim().toLowerCase();
    const branch = branches.find((entry) => entry.code.trim().toLowerCase() === normalized);
    resetSchedule({
      branch: {
        id: branch?.id ?? 0,
        code: branch?.code ?? nextBranchCode,
        name: branch?.name ?? "",
      },
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
      employees: setVehicleRouteCrewRole(current.employees, employeeId, role),
    }));
    setFormError(null);
  }

  function handleEmployeesChange(employees: RouteEmployeeRef[]) {
    setValues((current) => ({ ...current, employees }));
    setFormError(null);
  }

  function handleRemoveEmployee(employeeId: number) {
    setValues((current) => ({
      ...current,
      employees: current.employees.filter((employee) => employee.id !== employeeId),
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
      notifySuccess(
        copyPrefix ? t(`routes.${copyPrefix}.form.saved`) : t("routes.activeRoute.saved"),
      );
      onSaved?.();
    } catch (error) {
      setFormError(toErrorMessage(error));
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
      setCreateFormError(toErrorMessage(error));
    }
  }

  return (
    <>
      <ActiveRouteForm
        values={{ ...values, routeType: effectiveRouteType }}
        isEditing={isEditing}
        isDelivery={isDelivery}
        copyPrefix={copyPrefix}
        showRouteTypeField={showRouteTypeField}
        showContainerField={showContainerField}
        showBranchField={!fixedBranchCode}
        submitLabel={
          isEditing
            ? t("common.actions.saveChanges")
            : copyPrefix
              ? t(`routes.${copyPrefix}.form.save`)
              : t("routes.activeRoute.save")
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
        onRateChange={(rate) => {
          setValues((current) => ({ ...current, rate }));
          setFormError(null);
        }}
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
        onEmployeesChange={handleEmployeesChange}
        onRemoveEmployee={handleRemoveEmployee}
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
        vehicleRouteId={isEditing && !isDelivery ? initialRecord?.id : undefined}
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
