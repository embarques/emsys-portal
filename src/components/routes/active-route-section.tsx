"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActiveRouteForm } from "@/components/routes/active-route-form";
import { RouteForm } from "@/components/routes/route-form";
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
} from "@/lib/active-routes/hooks/use-active-routes";
import {
  activeRouteToFormValues,
  createEmptyActiveRouteForm,
  type ActiveRoute,
  type ActiveRouteFormValues,
} from "@/lib/active-routes/types";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { formatRouteCopyLabel } from "@/lib/routes/display";
import {
  useCreateRoute,
  useRoute,
  useRoutePicker,
} from "@/lib/routes/hooks/use-routes";
import { createEmptyRouteForm, type RouteFormValues } from "@/lib/routes/types";
import type { RouteType } from "@/lib/active-routes/types";
import { useAuth } from "@/providers/auth-provider";

type ActiveRouteSectionProps = {
  initialRecord?: ActiveRoute | null;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function ActiveRouteSection({
  initialRecord = null,
  onSaved,
  onCancel,
}: ActiveRouteSectionProps) {
  const { t } = useTranslation();
  const { displayName } = useAuth();
  const { notifySuccess } = useFeedback();
  const containersQuery = useContainerPicker(200);
  const containers = containersQuery.data?.items ?? [];
  const routesQuery = useRoutePicker(200);

  const [values, setValues] = useState<ActiveRouteFormValues>(() =>
    initialRecord ? activeRouteToFormValues(initialRecord) : createEmptyActiveRouteForm(),
  );
  const [savedRecord, setSavedRecord] = useState<ActiveRoute | null>(initialRecord);
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const hydratedLookupRef = useRef("");

  const lookup =
    values.date.trim() &&
    (values.routeType === "pickup" ||
      (values.routeType === "delivery" && (values.container?.id ?? 0) > 0))
      ? {
          routeType: values.routeType,
          date: values.date.trim(),
          ...(values.routeType === "delivery" && values.container
            ? { containerId: values.container.id }
            : {}),
        }
      : null;

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
      driver: null,
      appraiser: null,
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
        keywords: [route.name, route.routeId, route.vehicle.name],
      }));
  }, [routesQuery.data?.items]);

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
  const routeEmployees = selectedRoute?.employees ?? [];

  useEffect(() => {
    if (!selectedRoute || selectedRouteQuery.isLoading) return;

    const crew = selectedRoute.employees;
    setValues((current) => {
      const driverValid =
        current.driver && crew.some((employee) => employee.id === current.driver?.id);
      const appraiserValid =
        current.appraiser && crew.some((employee) => employee.id === current.appraiser?.id);

      if (driverValid && appraiserValid) return current;

      return {
        ...current,
        driver: driverValid ? current.driver : null,
        appraiser: appraiserValid ? current.appraiser : null,
      };
    });
  }, [selectedRoute, selectedRouteQuery.isLoading]);

  const isSaving = upsertMutation.isPending;
  const isDelivery = values.routeType === "delivery";
  const isEditing = Boolean(initialRecord ?? savedRecord?.id);
  const submitDisabled =
    !values.date.trim() ||
    (isDelivery && (!values.container || values.container.id <= 0)) ||
    !values.routeRecordId.trim();

  function handleRouteTypeChange(routeType: RouteType) {
    setValues((current) => ({
      ...current,
      routeType,
      container: routeType === "delivery" ? current.container : null,
      routeRecordId: "",
      driver: null,
      appraiser: null,
    }));
    setSavedRecord(null);
    setFormError(null);
  }

  function updateContainer(nextValue: string) {
    const container = containers.find((entry) => String(entry.id) === nextValue);
    if (!container) return;
    setValues((current) => ({
      ...current,
      container: { id: container.id, name: formatContainerLabel(container) },
      routeRecordId: "",
      driver: null,
      appraiser: null,
    }));
    setSavedRecord(null);
    setFormError(null);
  }

  async function saveActiveRoute() {
    setFormError(null);

    if (!values.date.trim()) {
      setFormError(t("routes.activeRoute.errors.date"));
      return;
    }
    if (values.routeType === "delivery" && (!values.container || values.container.id <= 0)) {
      setFormError(t("routes.activeRoute.errors.container"));
      return;
    }
    if (!values.routeRecordId.trim()) {
      setFormError(t("routes.activeRoute.errors.route"));
      return;
    }

    try {
      const record = await upsertMutation.mutateAsync({
        values,
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
        values={values}
        isEditing={isEditing}
        isDelivery={isDelivery}
        submitLabel={
          isEditing ? t("common.actions.saveChanges") : t("routes.activeRoute.save")
        }
        isSubmitting={isSaving}
        externalError={formError}
        routeOptions={routeOptions}
        containerOptions={containerOptions}
        routesLoading={routesQuery.isLoading}
        routeEmployees={routeEmployees}
        selectedRouteLoading={selectedRouteQuery.isLoading}
        submitDisabled={submitDisabled}
        onRouteTypeChange={handleRouteTypeChange}
        onDateChange={(date) => {
          setValues((current) => ({
            ...current,
            date,
            routeRecordId: "",
            driver: null,
            appraiser: null,
          }));
          setSavedRecord(null);
          setFormError(null);
        }}
        onContainerChange={updateContainer}
        onRouteRecordChange={(routeRecordId) => {
          setValues((current) => ({
            ...current,
            routeRecordId,
            driver: null,
            appraiser: null,
          }));
          setFormError(null);
        }}
        onDriverChange={(driver) => {
          setValues((current) => ({ ...current, driver }));
          setFormError(null);
        }}
        onAppraiserChange={(appraiser) => {
          setValues((current) => ({ ...current, appraiser }));
          setFormError(null);
        }}
        onCreateRouteClick={() => {
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
