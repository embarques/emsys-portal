"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateVehicle,
  useUpdateVehicle,
  useVehicle,
} from "@/lib/vehicles/hooks/use-vehicles";
import {
  createEmptyVehicleForm,
  vehicleToFormValues,
  type VehicleFormValues,
  areVehicleFormValuesEquivalent,
} from "@/lib/vehicles/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function VehicleFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated, notifySuccess } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();
  const detailQuery = useVehicle(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, t("vehicles.actions.editNamed", { name: editing.name }));
    }
  }, [editing?.name, isEditing, tabId, t, updateTabLabel]);

  async function save(values: VehicleFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        if (areVehicleFormValuesEquivalent(values, vehicleToFormValues(editing))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const next = await updateMutation.mutateAsync({ vehicleId: editing.id, values });
        notifyUpdated(t("vehicles.entity"), next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("vehicles.entity"), next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("vehicles.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("vehicles.loading.vehicle")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : t("vehicles.form.notFound");
    return (
      <FormTabShell title={t("vehicles.form.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? t("vehicles.form.editTitle") : t("vehicles.form.addTitle")}
      description={isEditing && editing ? editing.name : t("vehicles.form.addDescription")}
    >
      <VehicleForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editing ? vehicleToFormValues(editing) : createEmptyVehicleForm()
        }
        isEditing={isEditing}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("vehicles.actions.add")}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
