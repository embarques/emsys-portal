"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useCreateBarcodeStatus, useDeleteBarcodeStatus, useBarcodeStatuses, useUpdateBarcodeStatus } from "@/lib/barcodes/hooks/use-barcode-statuses";
import { barcodeStatusFormSchema } from "@/lib/barcodes/schemas/barcode-status.schema";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import type { BarcodeStatusOption } from "@/lib/labels/types";
import { useTranslation } from "@/lib/i18n";

type FormValues = { name: string; prevStatus: string };

const EMPTY_FORM: FormValues = { name: "", prevStatus: "" };

export function useBarcodeStatusesWorkspace() {
  const { t } = useTranslation();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifyError, notifySuccess } = useFeedback();
  const statusesQuery = useBarcodeStatuses();
  const createMutation = useCreateBarcodeStatus();
  const updateMutation = useUpdateBarcodeStatus();
  const deleteMutation = useDeleteBarcodeStatus();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BarcodeStatusOption | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(barcodeStatusFormSchema), defaultValues: EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [statusesQuery.data],
  );
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    form.reset(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(status: BarcodeStatusOption) {
    setEditing(status);
    form.reset({ name: status.name, prevStatus: status.prevStatus ?? "" });
    setError(null);
    setDialogOpen(true);
  }

  async function save(values: FormValues) {

    setError(null);
    try {
      if (editing) {
        if (areFormValuesEquivalent(values, barcodeStatusFormSchema.parse({ name: editing.name, prevStatus: editing.prevStatus ?? "" }))) {
          notifySuccess(t("common.form.noChanges"));
          setDialogOpen(false);
          return;
        }
        const next = await updateMutation.mutateAsync({ id: editing.id, values });
        notifyUpdated(t("barcodeStatuses.entity"), next.name);
      } else {
        const next = await createMutation.mutateAsync(values);
        notifyAdded(t("barcodeStatuses.entity"), next.name);
      }
      setDialogOpen(false);
    } catch (mutationError) {
      setError(normalizeApiError(mutationError).message);
    }
  }

  async function remove(status: BarcodeStatusOption) {
    if (!window.confirm(t("barcodeStatuses.confirmDelete", { name: status.name }))) return;
    try {
      await deleteMutation.mutateAsync(status.id);
      notifyDeleted(t("barcodeStatuses.entity"), 1);
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  return { t, statusesQuery, statuses, isSaving, isDeleting: deleteMutation.isPending, dialogOpen, setDialogOpen, editing, form, error, openCreate, openEdit, save: form.handleSubmit(save), remove };
}
