"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ItemForm } from "@/components/items/item-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useCreateItem, useItem, useUpdateItem } from "@/lib/items/hooks/use-items";
import { createEmptyItemForm, itemToFormValues, type ItemFormValues } from "@/lib/items/types";
import { truncateItemId } from "@/lib/items/display";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function ItemFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();
  const detailQuery = useItem(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const editingLabel = editing
    ? editing.description || truncateItemId(editing.itemId)
    : undefined;

  useEffect(() => {
    if (isEditing && editingLabel) {
      updateTabLabel(tabId, `Edit ${editingLabel}`);
    }
  }, [editingLabel, isEditing, tabId, updateTabLabel]);

  async function save(values: ItemFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ itemId: editing.itemId, values });
        notifyUpdated("Item", next.description || truncateItemId(next.itemId));
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded("Item", next.description || truncateItemId(next.itemId));
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title="Edit item">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading item…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : "This item could not be found.";
    return (
      <FormTabShell title="Edit item">
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
      title={isEditing ? "Edit item" : "Add item"}
      description={isEditing && editingLabel ? editingLabel : "Create a new item description."}
    >
      <ItemForm
        key={isEditing ? (editing?.itemId ?? "edit") : `new-${formInstance}`}
        initialValues={isEditing && editing ? itemToFormValues(editing) : createEmptyItemForm()}
        isEditing={isEditing}
        updatedAt={editing?.updatedAt}
        submitLabel={isEditing ? "Save changes" : "Add item"}
        externalError={formError}
        isSubmitting={isSaving}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
