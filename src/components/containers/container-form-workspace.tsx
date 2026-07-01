"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { ContainerForm } from "@/components/containers/container-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { useUserError } from "@/lib/errors";
import {
  useContainer,
  useContainerPicker,
  useCreateContainer,
  useUpdateContainer,
} from "@/lib/containers/hooks/use-containers";
import {
  createEmptyContainerForm,
  containerToFormValues,
  suggestNextContainerName,
  type ContainerFormValues,
} from "@/lib/containers/types";
import { useTranslation } from "@/lib/i18n";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function ContainerFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const numericId = entityId != null ? Number(entityId) : null;
  const createMutation = useCreateContainer();
  const updateMutation = useUpdateContainer();
  const detailQuery = useContainer(isEditing ? numericId : null);
  const pickerQuery = useContainerPicker(200, { enabled: !isEditing });

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const suggestedContainerName = useMemo(
    () => (isEditing ? undefined : suggestNextContainerName(pickerQuery.data?.items ?? [])),
    [isEditing, pickerQuery.data?.items],
  );

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, t("containers.actions.editNamed", { name: editing.name }));
    }
  }, [editing?.name, isEditing, t, tabId, updateTabLabel]);

  async function save(values: ContainerFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ containerId: editing.id, values });
        notifyUpdated(t("containers.entity"), next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("containers.entity"), next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("containers.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("containers.loading.container")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? toErrorMessage(detailQuery.error)
      : t("containers.form.notFound");
    return (
      <FormTabShell title={t("containers.form.editTitle")}>
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
      title={isEditing ? t("containers.form.editTitle") : t("containers.form.addTitle")}
      description={isEditing && editing ? editing.name : t("containers.form.addDescription")}
    >
      <ContainerForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editing ? containerToFormValues(editing) : createEmptyContainerForm()
        }
        isEditing={isEditing}
        suggestedContainerName={suggestedContainerName}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("containers.actions.add")}
        externalError={formError}
        isSubmitting={isSaving}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
