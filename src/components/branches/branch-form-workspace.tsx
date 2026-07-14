"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { BranchForm } from "@/components/branches/branch-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useBranch, useCreateBranch, useUpdateBranch } from "@/lib/branches/hooks/use-branches";
import {
  createEmptyBranchForm,
  branchToFormValues,
  type BranchFormValues,
  areBranchFormValuesEquivalent,
} from "@/lib/branches/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function BranchFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated, notifySuccess } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const numericId = entityId != null ? Number(entityId) : null;
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const detailQuery = useBranch(isEditing ? numericId : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, t("branches.actions.editNamed", { name: editing.name }));
    }
  }, [editing?.name, isEditing, tabId, t, updateTabLabel]);

  async function save(values: BranchFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        if (areBranchFormValuesEquivalent(values, branchToFormValues(editing))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const next = await updateMutation.mutateAsync({ branchId: editing.id, values });
        notifyUpdated(t("branches.entity"), next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("branches.entity"), next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("branches.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("branches.loading.branch")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : t("branches.form.notFound");
    return (
      <FormTabShell title={t("branches.form.editTitle")}>
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
      title={isEditing ? t("branches.form.editTitle") : t("branches.form.addTitle")}
      description={isEditing && editing ? editing.name : t("branches.form.addDescription")}
    >
      <BranchForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={isEditing && editing ? branchToFormValues(editing) : createEmptyBranchForm()}
        isEditing={isEditing}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("branches.actions.add")}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
