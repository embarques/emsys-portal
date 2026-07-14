"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { BarcodeForm } from "@/components/barcodes/barcode-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { useUserError } from "@/lib/errors";
import {
  useBarcode,
  useCreateBarcode,
  useUpdateBarcode,
} from "@/lib/barcodes/hooks/use-barcodes";
import {
  barcodeToFormValues,
  createEmptyBarcodeForm,
  type BarcodeFormValues,
  areBarcodeFormValuesEquivalent,
} from "@/lib/barcodes/types";
import { useTranslation } from "@/lib/i18n";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function BarcodeFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated, notifySuccess } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const numericId = entityId != null ? Number(entityId) : null;
  const createMutation = useCreateBarcode();
  const updateMutation = useUpdateBarcode();
  const detailQuery = useBarcode(isEditing ? numericId : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isEditing && editing?.number) {
      updateTabLabel(tabId, t("barcodes.actions.editNamed", { number: editing.number }));
    }
  }, [editing?.number, isEditing, t, tabId, updateTabLabel]);

  async function save(values: BarcodeFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        if (areBarcodeFormValuesEquivalent(values, barcodeToFormValues(editing))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const next = await updateMutation.mutateAsync({ barcodeId: editing.id, values });
        notifyUpdated(t("barcodes.entity"), next.number);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("barcodes.entity"), next.number);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("barcodes.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("barcodes.loading.barcode")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? toErrorMessage(detailQuery.error)
      : t("barcodes.form.notFound");
    return (
      <FormTabShell title={t("barcodes.form.editTitle")}>
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
      title={isEditing ? t("barcodes.form.editTitle") : t("barcodes.form.addTitle")}
      description={isEditing && editing ? editing.number : t("barcodes.form.addDescription")}
    >
      <BarcodeForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editing ? barcodeToFormValues(editing) : createEmptyBarcodeForm()
        }
        isEditing={isEditing}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("barcodes.actions.add")}
        externalError={formError}
        isSubmitting={isSaving}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
