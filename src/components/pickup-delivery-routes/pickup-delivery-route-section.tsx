"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActiveRouteForm } from "@/components/pickup-delivery-routes/pickup-delivery-route-form";
import { RouteForm } from "@/components/route-manager/route-form";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
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
import { useVehiclePicker, useCreateVehicle } from "@/lib/vehicles/hooks/use-vehicles";
import {
  createEmptyVehicleForm,
  type VehicleFormValues,
} from "@/lib/vehicles/types";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import {
  buildFormBranchOptions,
  findBranchByCodeOrId,
  resolveUserBranchRef,
  type BranchRef,
} from "@/lib/branches/user-branch";
import { useTranslation } from "@/lib/i18n";
import { useUserError } from "@/lib/errors/use-user-error";
import {
  formatPreviousDailyRouteLabel,
} from "@/lib/pickup-delivery-routes/display";
import {
  formatRouteAssignmentName,
  formatRouteAssignmentOptionLabel,
  getVehicleRefLabel,
} from "@/lib/route-manager/display";
import {
  useCreateRoute,
  useRoute,
  useRoutePicker,
} from "@/lib/route-manager/hooks/use-route-manager";
import {
  createEmptyRouteForm,
  createEmptyVehicleRef,
  crewFromRouteGroup,
  getRouteBranchCode,
  setVehicleRouteCrewRole,
  type RouteCrewRole,
  type RouteFormValues,
} from "@/lib/route-manager/types";
import type { ActiveRoutesDirectoryVariant } from "@/lib/pickup-delivery-routes/directory-variant";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useAuth } from "@/providers/auth-provider";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

const EMPTY_BRANCHES: BranchRef[] = [];

type ActiveRouteSectionProps = {
  initialRecord?: ActiveRoute | null;
  variant?: ActiveRoutesDirectoryVariant;
  defaultDate?: string;
  onSaved?: (record?: ActiveRoute) => void;
  onCancel?: () => void;
};

export function ActiveRouteSection({
  initialRecord = null,
  variant,
  defaultDate,
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
  const branches = branchesQuery.data?.items ?? EMPTY_BRANCHES;
  const currentUserQuery = useCurrentUser();
  const isEditing = Boolean(initialRecord);

  const [values, setValues] = useState<ActiveRouteFormValues>(() =>
    initialRecord
      ? {
          ...activeRouteToFormValues(initialRecord),
          scheduleType: "date",
          dayOfWeek: [],
        }
      : {
          ...createEmptyActiveRouteForm("pickup"),
          ...(defaultDate?.trim() ? { date: defaultDate.trim() } : {}),
        },
  );
  const [previousRouteId, setPreviousRouteId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [createVehicleDialogOpen, setCreateVehicleDialogOpen] = useState(false);
  const [createVehicleFormError, setCreateVehicleFormError] = useState<string | null>(null);
  const syncedRouteRecordIdRef = useRef("");
  const branchCode = values.branch.code;
  const isDeliveryBranch = isDeliveryBranchCode(branchCode);
  const effectiveRouteType = routeTypeForBranchCode(branchCode);

  const routesQuery = useRoutePicker(200, {
    branchCode: branchCode.trim() || undefined,
    enabled: Boolean(branchCode.trim()),
  });
  const vehiclesQuery = useVehiclePicker(200, {
    branchCode: branchCode.trim() || undefined,
    enabled: Boolean(branchCode.trim()),
  });
  const vehicles = vehiclesQuery.data?.items ?? [];
  const previousRoutesQuery = useDailyRoutePicker(200, { enabled: !isEditing });

  useEffect(() => {
    // Wait until the branch catalog can resolve a real code. Applying a
    // code-less user branch keeps failing the "already set" guard and loops.
    const resolved = resolveUserBranchRef(currentUserQuery.data?.branch, branches);
    if (!resolved?.code.trim()) return;
    setValues((current) => {
      if (current.branch.id > 0 && current.branch.code.trim()) return current;
      if (
        current.branch.id === resolved.id &&
        current.branch.code === resolved.code &&
        (current.branch.name?.trim() ?? "") === resolved.name
      ) {
        return current;
      }
      return {
        ...current,
        branch: resolved,
        routeType: routeTypeForBranchCode(resolved.code),
      };
    });
  }, [branches, currentUserQuery.data?.branch]);

  useEffect(() => {
    const code = values.branch.code.trim();
    if (!code || branches.length === 0) return;

    const match = findBranchByCodeOrId(branches, {
      id: values.branch.id,
      code: values.branch.code,
      name: values.branch.name,
    });
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
  }, [branches, values.branch.id, values.branch.code, values.branch.name]);

  const upsertMutation = useUpsertActiveRoute();
  const createRouteMutation = useCreateRoute();
  const createVehicleMutation = useCreateVehicle();
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
        formatRouteAssignmentOptionLabel(left).localeCompare(
          formatRouteAssignmentOptionLabel(right),
        ),
      )
      .map((route) => ({
        value: route.id,
        label: formatRouteAssignmentOptionLabel(route),
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

    const crew = selectedRoute.employees;

    setValues((current) => {
      const alreadySynced = syncedRouteRecordIdRef.current === routeRecordId;
      const nextEmployees = crewFromRouteGroup(crew, current.employees);
      const crewIds = nextEmployees.map((employee) => employee.id).join(",");
      const currentIds = current.employees.map((employee) => employee.id).join(",");
      const nextName = formatRouteAssignmentName(selectedRoute);
      if (
        alreadySynced &&
        crewIds === currentIds &&
        current.routeAssignmentName === nextName
      ) {
        return current;
      }

      syncedRouteRecordIdRef.current = routeRecordId;
      return {
        ...current,
        routeAssignmentName: nextName,
        employees: nextEmployees,
      };
    });
  }, [selectedRoute, selectedRouteQuery.isLoading, values.routeRecordId]);

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
            record.vehicle.name,
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

  const vehicleOptions = useMemo(() => {
    const options: SearchableSelectOption[] = [...vehicles]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((vehicle) => ({
        value: vehicle.id,
        label: vehicle.name,
        ...(vehicle.licensePlate ? { description: vehicle.licensePlate } : {}),
        keywords: [vehicle.name, vehicle.vehicleId, vehicle.licensePlate, vehicle.vin],
      }));

    if (values.vehicle.id && !options.some((option) => option.value === values.vehicle.id)) {
      options.unshift({
        value: values.vehicle.id,
        label: getVehicleRefLabel(values.vehicle),
        keywords: [values.vehicle.name, values.vehicle.id],
      });
    }

    return options;
  }, [vehicles, values.vehicle]);

  const isSaving = upsertMutation.isPending;
  const submitDisabled =
    !values.date.trim() ||
    !(values.branch.id > 0) ||
    !values.vehicle.id.trim() ||
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
      vehicle: createEmptyVehicleRef(),
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
    if (!values.vehicle.id.trim()) {
      setFormError(t("routes.activeRoute.errors.vehicle"));
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
        onSaved?.(initialRecord ?? undefined);
        return;
      }

      const saved = await upsertMutation.mutateAsync({
        values: payload,
        existingId: initialRecord?.id,
      });
      notifySuccess(t(`routes.${copyPrefix}.form.saved`));
      onSaved?.(saved);
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

  function buildCreateVehicleInitialValues(): VehicleFormValues {
    const form = createEmptyVehicleForm();
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
      syncedRouteRecordIdRef.current = created.id;
      setValues((current) => ({
        ...current,
        routeRecordId: created.id,
        routeAssignmentName: created.name,
        employees: crewFromRouteGroup(created.employees),
      }));
      setCreateDialogOpen(false);
      notifySuccess(t("routes.activeRoute.routeCreated"));
    } catch (error) {
      setCreateFormError(toErrorMessage(error));
    }
  }

  async function handleCreateVehicle(vehicleValues: VehicleFormValues) {
    setCreateVehicleFormError(null);
    try {
      const created = await createVehicleMutation.mutateAsync(vehicleValues);
      setValues((current) => ({
        ...current,
        vehicle: {
          id: created.id,
          name: created.name.trim(),
          ...(created.branch.code.trim() ? { branch: created.branch.code } : {}),
        },
      }));
      setCreateVehicleDialogOpen(false);
      notifySuccess(t("routes.activeRoute.vehicleCreated"));
    } catch (error) {
      setCreateVehicleFormError(toErrorMessage(error));
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
        vehicleOptions={vehicleOptions}
        previousRouteOptions={previousRouteOptions}
        previousRouteId={previousRouteId}
        branchCode={selectBranchCode}
        branchesLoading={branchesQuery.isLoading}
        vehiclesLoading={vehiclesQuery.isLoading}
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
        onVehicleChange={(vehicleId) => {
          const vehicle = vehicles.find((entry) => entry.id === vehicleId);
          setValues((current) => ({
            ...current,
            vehicle: vehicle
              ? {
                  id: vehicle.id,
                  name: vehicle.name.trim(),
                  ...(vehicle.branch.code.trim() ? { branch: vehicle.branch.code } : {}),
                }
              : createEmptyVehicleRef(),
          }));
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
            employees: assignment ? crewFromRouteGroup(assignment.employees) : [],
          }));
          setFormError(null);
        }}
        onRoleChange={handleRoleChange}
        onCreateVehicleClick={() => {
          if (isDesktopTabs) {
            openFormTab({
              feature: "vehicles",
              baseHref: "/vehicles",
              mode: "add",
              label: t("vehicles.actions.add"),
            });
            return;
          }
          setCreateVehicleFormError(null);
          setCreateVehicleDialogOpen(true);
        }}
        onEditVehicleClick={() => {
          if (!values.vehicle.id) return;
          openFormTab({
            feature: "vehicles",
            baseHref: "/vehicles",
            mode: "edit",
            entityId: values.vehicle.id,
            label: t("vehicles.actions.edit"),
          });
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
        onEditRouteClick={() => {
          if (!values.routeRecordId) return;
          openFormTab({
            feature: "routes",
            baseHref: "/routes",
            mode: "edit",
            entityId: values.routeRecordId,
            label: t("routes.form.editTabLabel"),
          });
        }}
        onSubmit={saveActiveRoute}
        onCancel={onCancel}
        vehicleRouteId={isEditing && !isDeliveryBranch ? initialRecord?.id : undefined}
      />

      <Dialog open={createVehicleDialogOpen} onOpenChange={setCreateVehicleDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("routes.createVehicleDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("routes.createVehicleDialog.description")}
            </DialogDescription>
          </DialogHeader>
          {createVehicleDialogOpen ? (
            <VehicleForm
              key="create-vehicle-from-active"
              initialValues={buildCreateVehicleInitialValues()}
              submitLabel={t("routes.activeRoute.createVehicle")}
              isSubmitting={createVehicleMutation.isPending}
              externalError={createVehicleFormError}
              onSubmit={handleCreateVehicle}
              onCancel={() => setCreateVehicleDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

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
