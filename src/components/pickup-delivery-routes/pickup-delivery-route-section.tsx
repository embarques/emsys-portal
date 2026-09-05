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
  useDailyRoutePicker,
  useUpsertActiveRoute,
} from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import {
  activeRouteToFormValues,
  areActiveRouteFormValuesEquivalent,
  createEmptyActiveRouteForm,
  isDeliveryBranchCode,
  routeTypeForBranchCode,
  type ActiveRoute,
  type ActiveRouteFormValues,
} from "@/lib/pickup-delivery-routes/types";
import { formatContainerLabel, formatContainerRouteNumber } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  buildFormBranchOptions,
  findBranchByCodeOrId,
  resolveUserBranchRef,
} from "@/lib/branches/user-branch";
import { useTranslation } from "@/lib/i18n";
import { useUserError } from "@/lib/errors/use-user-error";
import {
  formatPreviousDailyRouteLabel,
} from "@/lib/pickup-delivery-routes/display";
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
  createEmptyVehicleRef,
  getRouteBranchCode,
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
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const copyPrefix = variant?.copyPrefix ?? "dailyRoutes";
  const { displayName } = useAuth();
  const { notifySuccess } = useFeedback();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const containersQuery = useContainerPicker(200);
  const containers = containersQuery.data?.items ?? [];
  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];
  const currentUserQuery = useCurrentUser();
  const isEditing = Boolean(initialRecord);

  const [values, setValues] = useState<ActiveRouteFormValues>(() =>
    initialRecord
      ? {
          ...activeRouteToFormValues(initialRecord),
          scheduleType: "date",
          dayOfWeek: [],
        }
      : createEmptyActiveRouteForm("pickup"),
  );
  const [previousRouteId, setPreviousRouteId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const syncedRouteRecordIdRef = useRef("");
  const branchCode = values.branch.code;
  const isDeliveryBranch = isDeliveryBranchCode(branchCode);
  const effectiveRouteType = routeTypeForBranchCode(branchCode);

  const routesQuery = useRoutePicker(200, {
    branchCode: branchCode.trim() || undefined,
    enabled: Boolean(branchCode.trim()),
  });
  const previousRoutesQuery = useDailyRoutePicker(200, { enabled: !isEditing });

  useEffect(() => {
    const resolved = resolveUserBranchRef(currentUserQuery.data?.branch, branches);
    if (!resolved) return;
    setValues((current) =>
      current.branch.id > 0 && current.branch.code.trim()
        ? current
        : {
            ...current,
            branch: resolved,
            routeType: routeTypeForBranchCode(resolved.code),
          },
    );
  }, [branches, currentUserQuery.data?.branch]);

  useEffect(() => {
    const code = values.branch.code.trim();
    if (!code || branches.length === 0) return;

    const match = findBranchByCodeOrId(branches, values.branch);
    if (!match) return;

    setValues((current) => {
      const name = match.name?.trim() ?? "";
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
        routeType: routeTypeForBranchCode(match.code),
      };
    });
  }, [branches, values.branch]);

  const upsertMutation = useUpsertActiveRoute();
  const createRouteMutation = useCreateRoute();
  const selectedRouteQuery = useRoute(values.routeRecordId || null, Boolean(values.routeRecordId));

  useEffect(() => {
    if (initialRecord) {
      syncedRouteRecordIdRef.current = "";
      setValues({
        ...activeRouteToFormValues(initialRecord),
        scheduleType: "date",
        dayOfWeek: [],
      });
      setPreviousRouteId("");
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
          getRouteBranchCode(route),
          ...route.employees.map((employee) => employee.name),
        ],
      }));
  }, [routesQuery.data?.items]);

  const selectedRoute = selectedRouteQuery.data ?? null;

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
          role: existing?.role ?? "helper",
          ...(existing?.roles?.length ? { roles: existing.roles } : {}),
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
    () => buildFormBranchOptions(branches, values.branch.code.trim() ? values.branch : null),
    [branches, values.branch],
  );
  const selectBranchCode =
    findBranchByCodeOrId(branches, values.branch)?.code || values.branch.code;

  const previousRoutes = previousRoutesQuery.data?.items ?? [];
  const previousRouteOptions = useMemo(
    () =>
      [...previousRoutes]
        .sort((left, right) => right.date.localeCompare(left.date))
        .map((record) => ({
          value: record.id,
          label: formatPreviousDailyRouteLabel(record, t("common.empty.dash")),
          keywords: [
            record.date,
            record.branch?.code ?? "",
            record.route.name,
            ...record.employees.map((employee) => employee.name),
          ],
        })),
    [previousRoutes, t],
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
  const submitDisabled =
    !values.date.trim() ||
    !(values.branch.id > 0) ||
    !values.routeRecordId.trim() ||
    (isDeliveryBranch && (!values.container || values.container.id <= 0));

  function resetCrew(partial: Partial<ActiveRouteFormValues>) {
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

  function handleBranchChange(nextBranchCode: string) {
    const normalized = nextBranchCode.trim().toLowerCase();
    const branch = branches.find((entry) => entry.code.trim().toLowerCase() === normalized);
    const nextIsDelivery = isDeliveryBranchCode(branch?.code ?? nextBranchCode);
    resetCrew({
      branch: {
        id: branch?.id ?? 0,
        code: branch?.code ?? nextBranchCode,
        name: branch?.name ?? "",
      },
      routeType: routeTypeForBranchCode(branch?.code ?? nextBranchCode),
      container: nextIsDelivery ? values.container : null,
      rate: nextIsDelivery ? values.rate : "",
    });
    setPreviousRouteId("");
  }

  function handlePreviousRouteChange(routeId: string) {
    const record = previousRoutes.find((entry) => entry.id === routeId);
    if (!record) return;
    syncedRouteRecordIdRef.current = record.route.id;
    setPreviousRouteId(routeId);
    setValues((current) => ({
      ...activeRouteToFormValues(record),
      date: current.date,
      scheduleType: "date",
      dayOfWeek: [],
      vehicle: createEmptyVehicleRef(),
      routeType: routeTypeForBranchCode(record.branch?.code),
    }));
    setFormError(null);
  }

  function updateContainer(nextValue: string) {
    const container = containers.find((entry) => String(entry.id) === nextValue);
    if (!container) return;
    setValues((current) => ({
      ...current,
      container: {
        id: container.id,
        name: formatContainerRouteNumber(container),
      },
    }));
    setFormError(null);
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

    if (!values.date.trim()) {
      setFormError(t("routes.activeRoute.errors.date"));
      return;
    }
    if (!(values.branch.id > 0)) {
      setFormError(t("routes.activeRoute.errors.branch"));
      return;
    }
    if (isDeliveryBranch && (!values.container || values.container.id <= 0)) {
      setFormError(t("routes.activeRoute.errors.container"));
      return;
    }
    if (!values.routeRecordId.trim()) {
      setFormError(t("routes.activeRoute.errors.route"));
      return;
    }

    try {
      const payload = {
        ...values,
        scheduleType: "date" as const,
        dayOfWeek: [],
        routeType: effectiveRouteType,
        container: isDeliveryBranch ? values.container : null,
        vehicle: createEmptyVehicleRef(),
        active: true,
      };
      if (
        initialRecord &&
        areActiveRouteFormValuesEquivalent(payload, {
          ...activeRouteToFormValues(initialRecord),
          scheduleType: "date",
          dayOfWeek: [],
          active: true,
        })
      ) {
        notifySuccess(t("common.form.noChanges"));
        onSaved?.();
        return;
      }

      await upsertMutation.mutateAsync({
        values: payload,
        existingId: initialRecord?.id,
      });
      notifySuccess(t(`routes.${copyPrefix}.form.saved`));
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
        name: values.branch.name,
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
        isDeliveryBranch={isDeliveryBranch}
        copyPrefix={copyPrefix}
        showPreviousRouteField={!isEditing}
        submitLabel={
          isEditing ? t("common.actions.saveChanges") : t(`routes.${copyPrefix}.form.save`)
        }
        isSubmitting={isSaving}
        externalError={formError}
        routeOptions={routeOptions}
        containerOptions={containerOptions}
        branchOptions={branchOptions}
        previousRouteOptions={previousRouteOptions}
        previousRouteId={previousRouteId}
        branchCode={selectBranchCode}
        branchesLoading={branchesQuery.isLoading}
        routesLoading={routesQuery.isLoading}
        previousRoutesLoading={previousRoutesQuery.isLoading}
        selectedRouteLoading={selectedRouteQuery.isLoading}
        submitDisabled={submitDisabled}
        onPreviousRouteChange={handlePreviousRouteChange}
        onBranchChange={handleBranchChange}
        onDateChange={(date) => {
          setValues((current) => ({ ...current, date, scheduleType: "date", dayOfWeek: [] }));
          setFormError(null);
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
        vehicleRouteId={isEditing && !isDeliveryBranch ? initialRecord?.id : undefined}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("routes.createDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("routes.createDialog.description")}
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
