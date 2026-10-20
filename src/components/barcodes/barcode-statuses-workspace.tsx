"use client";

import { Tag, Pencil, Plus, Trash2 } from "lucide-react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeApiError } from "@/lib/api/axios";
import { useBarcodeStatusesWorkspace } from "@/lib/barcodes/hooks/use-barcode-statuses-workspace";
import { fetchBarcodeStatusesPage } from "@/lib/barcodes/api/barcode-statuses-api";
import { BARCODE_STATUS_TABLE_FILTER_FIELDS } from "@/lib/barcodes/barcode-status-filter-fields";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import { CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";

export function BarcodeStatusesWorkspace() {
  const handleEnterNavigation = useFormEnterNavigation();
  const { t, isSaving, isDeleting, dialogOpen, setDialogOpen, editing, form, error, openCreate, openEdit, save, remove } = useBarcodeStatusesWorkspace();
  const table = useCatalogTable({
    fields: BARCODE_STATUS_TABLE_FILTER_FIELDS,
    keyPrefix: "barcodeStatuses.filters.fields",
    sort: "name:asc",
    queryKey: queryKeys.barcodeStatuses.page,
    fetchPage: fetchBarcodeStatusesPage,
  });

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
        <div className="border-b px-4 py-3">
          <CatalogTableToolbar
            state={table}
            presetScope="barcode-statuses"
            searchPlaceholder={t("barcodeStatuses.searchPlaceholder")}
          />
        </div>
        {table.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : table.isError ? (
          <p className="p-6 text-sm text-destructive">{normalizeApiError(table.error).message}</p>
        ) : table.items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {table.hasActiveFilters ? t("common.table.noMatches") : t("barcodeStatuses.empty")}
          </p>
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
              {table.items.map((status) => (
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
        {!table.isLoading && !table.isError ? <CatalogTablePagination state={table} /> : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
            <DialogTitle>{editing ? t("barcodeStatuses.form.editTitle") : t("barcodeStatuses.form.addTitle")}</DialogTitle>
            <DialogDescription>{t("barcodeStatuses.form.description")}</DialogDescription>
          </DialogHeader>
          <form id="barcode-status-form" onSubmit={save} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
            <FormBody workflow isBusy={isSaving}>
              <FormSection variant="card" icon={Tag} title={t("barcodeStatuses.form.details")}>
            <div className="space-y-1">
              <Label htmlFor="barcode-status-name">{t("barcodeStatuses.fields.name")} <span className="text-destructive">*</span></Label>
              <Input
                id="barcode-status-name"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="barcode-status-previous">{t("barcodeStatuses.fields.previousStatus")} <span className="text-xs text-muted-foreground">{t("barcodeStatuses.form.optional")}</span></Label>
              <Input
                id="barcode-status-previous"
                {...form.register("prevStatus")}
              />
            </div>
            {form.formState.errors.name ? <p className="text-sm text-destructive">{t("barcodeStatuses.validation.nameRequired")}</p> : null}
              </FormSection>
            </FormBody>
            <FormFooter error={error} submitLabel={t("common.actions.save")} isSubmitting={isSaving} onCancel={() => setDialogOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
