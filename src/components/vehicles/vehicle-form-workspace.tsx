"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useCreateVehicle,
  useUpdateVehicle,
  useVehicle,
} from "@/lib/vehicles/hooks/use-vehicles";
import {
  createEmptyVehicleForm,
  vehicleToFormValues,
  type VehicleFormValues,
} from "@/lib/vehicles/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function VehicleFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
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
      updateTabLabel(tabId, `Edit ${editing.name}`);
    }
  }, [editing?.name, isEditing, tabId, updateTabLabel]);

  async function save(values: VehicleFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ vehicleId: editing.id, values });
        notifyUpdated("Vehicle", next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded("Vehicle", next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title="Edit vehicle">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading vehicle…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : "This vehicle could not be found.";
    return (
      <FormTabShell title="Edit vehicle">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            Close
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? "Edit vehicle" : "Add vehicle"}
      description={isEditing && editing ? editing.name : "Create a new vehicle record."}
    >
      <VehicleForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editing ? vehicleToFormValues(editing) : createEmptyVehicleForm()
        }
        isEditing={isEditing}
        submitLabel={isEditing ? "Save changes" : "Add vehicle"}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
