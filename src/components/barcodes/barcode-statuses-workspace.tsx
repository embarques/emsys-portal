"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { useBarcodeStatusesWorkspace } from "@/lib/barcodes/hooks/use-barcode-statuses-workspace";

export function BarcodeStatusesWorkspace() {
  const { t, statusesQuery, statuses, isSaving, isDeleting, dialogOpen, setDialogOpen, editing, form, error, openCreate, openEdit, save, remove } = useBarcodeStatusesWorkspace();

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
                <th className="px-4 py-3 font-medium">{t("common.apiColumns.id")}</th>
                <th className="px-4 py-3 font-medium">{t("barcodeStatuses.fields.name")}</th>
                <th className="px-4 py-3 font-medium">{t("barcodeStatuses.fields.previousStatus")}</th>
                <th className="w-28 px-4 py-3 text-right font-medium">{t("common.actions.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((status) => (
                <tr key={status.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{status.id}</td>
                  <td className="px-4 py-3 font-medium">{status.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{status.prevStatus || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(status)} aria-label={t("common.actions.edit")}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={isDeleting} onClick={() => void remove(status)} aria-label={t("common.actions.delete")}>
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
          <form id="barcode-status-form" onSubmit={save} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="barcode-status-name">{t("barcodeStatuses.fields.name")}</Label>
              <Input
                id="barcode-status-name"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="barcode-status-previous">{t("barcodeStatuses.fields.previousStatus")}</Label>
              <Input
                id="barcode-status-previous"
                {...form.register("prevStatus")}
              />
            </div>
            {form.formState.errors.name ? <p className="text-sm text-destructive">{t("barcodeStatuses.validation.nameRequired")}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.actions.cancel")}</Button>
            <Button type="submit" form="barcode-status-form" disabled={isSaving}>{t("common.actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
