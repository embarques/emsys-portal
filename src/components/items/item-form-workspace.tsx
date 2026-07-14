"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ItemForm } from "@/components/items/item-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import { useCreateItem, useItem, useUpdateItem } from "@/lib/items/hooks/use-items";
import {
  createEmptyItemForm, itemToFormValues, type ItemFormValues,
  areItemFormValuesEquivalent,
} from "@/lib/items/types";
import { truncateItemId } from "@/lib/items/display";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function ItemFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated, notifySuccess } = useFeedback();
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
      updateTabLabel(tabId, t("items.actions.editNamed", { name: editingLabel }));
    }
  }, [editingLabel, isEditing, tabId, t, updateTabLabel]);

  async function save(values: ItemFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        if (areItemFormValuesEquivalent(values, itemToFormValues(editing))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const next = await updateMutation.mutateAsync({ itemId: editing.itemId, values });
        notifyUpdated(t("items.entity"), next.description || truncateItemId(next.itemId));
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("items.entity"), next.description || truncateItemId(next.itemId));
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("items.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("items.loading.item")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? toErrorMessage(detailQuery.error)
      : t("items.form.notFound");
    return (
      <FormTabShell title={t("items.form.editTitle")}>
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
      title={isEditing ? t("items.form.editTitle") : t("items.form.addTitle")}
      description={isEditing && editingLabel ? editingLabel : t("items.form.addDescription")}
    >
      <ItemForm
        key={isEditing ? (editing?.itemId ?? "edit") : `new-${formInstance}`}
        initialValues={isEditing && editing ? itemToFormValues(editing) : createEmptyItemForm()}
        isEditing={isEditing}
        updatedAt={editing?.updatedAt}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("items.actions.add")}
        externalError={formError}
        isSubmitting={isSaving}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
