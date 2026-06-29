"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { BranchForm } from "@/components/branches/branch-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranch, useCreateBranch, useUpdateBranch } from "@/lib/branches/hooks/use-branches";
import {
  createEmptyBranchForm,
  branchToFormValues,
  type BranchFormValues,
} from "@/lib/branches/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function BranchFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
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
      updateTabLabel(tabId, `Edit ${editing.name}`);
    }
  }, [editing?.name, isEditing, tabId, updateTabLabel]);

  async function save(values: BranchFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ branchId: editing.id, values });
        notifyUpdated("Branch", next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded("Branch", next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title="Edit branch">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading branch…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : "This branch could not be found.";
    return (
      <FormTabShell title="Edit branch">
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
      title={isEditing ? "Edit branch" : "Add branch"}
      description={isEditing && editing ? editing.name : "Create a new branch."}
    >
      <BranchForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={isEditing && editing ? branchToFormValues(editing) : createEmptyBranchForm()}
        isEditing={isEditing}
        submitLabel={isEditing ? "Save changes" : "Add branch"}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
