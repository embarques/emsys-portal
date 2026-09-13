"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useCreateBarcodeStatus,
  useDeleteBarcodeStatus,
  useBarcodeStatuses,
  useUpdateBarcodeStatus,
} from "@/lib/barcodes/hooks/use-barcode-statuses";
import type { BarcodeStatusOption } from "@/lib/labels/types";
import { useTranslation } from "@/lib/i18n";

type FormValues = { name: string; prevStatus: string };

const EMPTY_FORM: FormValues = { name: "", prevStatus: "" };

export function BarcodeStatusesWorkspace() {
  const { t } = useTranslation();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifyError } = useFeedback();
  const statusesQuery = useBarcodeStatuses();
  const createMutation = useCreateBarcodeStatus();
  const updateMutation = useUpdateBarcodeStatus();
  const deleteMutation = useDeleteBarcodeStatus();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BarcodeStatusOption | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [statusesQuery.data],
  );
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setEditing(null);
    setValues(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(status: BarcodeStatusOption) {
    setEditing(status);
    setValues({ name: status.name, prevStatus: status.prevStatus ?? "" });
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!values.name.trim()) {
      setError(t("barcodeStatuses.validation.nameRequired"));
      return;
    }

    setError(null);
    try {
      if (editing) {
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

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={t("navigation.items.barcodeStatuses")}
        description={t("barcodeStatuses.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("barcodeStatuses.actions.add")}
          </Button>
        }
      />

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        {statusesQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : statusesQuery.isError ? (
          <p className="p-6 text-sm text-destructive">{normalizeApiError(statusesQuery.error).message}</p>
        ) : statuses.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("barcodeStatuses.empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t("barcodeStatuses.fields.name")}</th>
                <th className="px-4 py-3 font-medium">{t("barcodeStatuses.fields.previousStatus")}</th>
                <th className="w-28 px-4 py-3 text-right font-medium">{t("common.actions.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((status) => (
                <tr key={status.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{status.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{status.prevStatus || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(status)} aria-label={t("common.actions.edit")}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void remove(status)} aria-label={t("common.actions.delete")}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("barcodeStatuses.form.editTitle") : t("barcodeStatuses.form.addTitle")}</DialogTitle>
            <DialogDescription>{t("barcodeStatuses.form.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="barcode-status-name">{t("barcodeStatuses.fields.name")}</Label>
              <Input
                id="barcode-status-name"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="barcode-status-previous">{t("barcodeStatuses.fields.previousStatus")}</Label>
              <Input
                id="barcode-status-previous"
                value={values.prevStatus}
                onChange={(event) => setValues((current) => ({ ...current, prevStatus: event.target.value }))}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.actions.cancel")}</Button>
            <Button onClick={() => void save()} disabled={isSaving}>{t("common.actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
