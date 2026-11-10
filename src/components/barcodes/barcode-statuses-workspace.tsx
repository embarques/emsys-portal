"use client";

import { useMemo } from "react";
import { Tag, Plus } from "lucide-react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";

import { CatalogBulkDeleteDialog } from "@/components/app-shell/catalog-bulk-delete-dialog";
import { DirectoryTableRowActions } from "@/components/app-shell/directory-table-row-actions";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBarcodeStatusesWorkspace } from "@/lib/barcodes/hooks/use-barcode-statuses-workspace";
import { fetchBarcodeStatusesPage } from "@/lib/barcodes/api/barcode-statuses-api";
import { BARCODE_STATUS_TABLE_FILTER_FIELDS } from "@/lib/barcodes/barcode-status-filter-fields";
import type { BarcodeStatusOption } from "@/lib/labels/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogBulkDelete } from "@/lib/table/hooks/use-catalog-bulk-delete";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import type { DataTableColumn } from "@/lib/table/types";
import { CatalogDataTable, CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";

const statusRowId = (status: BarcodeStatusOption) => String(status.id);

export function BarcodeStatusesWorkspace() {
  const handleEnterNavigation = useFormEnterNavigation();
  const { t, isSaving, isDeleting, dialogOpen, setDialogOpen, editing, form, error, openCreate, openEdit, save, remove, deleteRecord } = useBarcodeStatusesWorkspace();
  const table = useCatalogTable({
    fields: BARCODE_STATUS_TABLE_FILTER_FIELDS,
    keyPrefix: "barcodeStatuses.filters.fields",
    defaultSort: "name:asc",
    getRowId: statusRowId,
    queryKey: queryKeys.barcodeStatuses.page,
    fetchPage: fetchBarcodeStatusesPage,
  });
  const bulkDelete = useCatalogBulkDelete({
    getId: statusRowId,
    deleteOne: deleteRecord,
    entityLabel: t("barcodeStatuses.entity"),
    onDeleted: (ids) => table.selection.setSelectedIds((current) => current.filter((id) => !ids.includes(id))),
  });
  const columns = useMemo<DataTableColumn<BarcodeStatusOption>[]>(() => [
    { id: "id", label: t("common.apiColumns.id"), defaultWidth: 96, cellClassName: "tabular-nums", renderCell: (status) => status.id },
    { id: "name", label: t("barcodeStatuses.fields.name"), cellClassName: "font-medium", renderCell: (status) => status.name },
    {
      id: "prevStatus",
      label: t("barcodeStatuses.fields.previousStatus"),
      cellClassName: "text-muted-foreground",
      renderCell: (status) => status.prevStatus || t("common.empty.dash"),
    },
  ], [t]);
  const columnLayout = useColumnVisibility("barcode-statuses-catalog-v1", columns);
  const { selectedIds, selectedRows } = table.selection;

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

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <CatalogTableToolbar
            state={table}
            presetScope="barcode-statuses"
            searchPlaceholder={t("barcodeStatuses.searchPlaceholder")}
            columnLayout={columnLayout}
          />
        </CardHeader>
        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={table.selection.pageRowIds}
          totalCount={table.total}
          onSelectedIdsChange={table.selection.setSelectedIds}
          deleteDisabled={isDeleting || bulkDelete.isPending}
          onEdit={() => { if (selectedRows[0]) openEdit(selectedRows[0]); }}
          onDelete={() => bulkDelete.request(selectedRows)}
        />
        <CatalogDataTable
          state={table}
          columns={columnLayout.columns}
          columnLayout={columnLayout}
          rowKey={statusRowId}
          rowLabel={(status) => status.name}
          emptyMessage={t("barcodeStatuses.empty")}
          onRowDoubleClick={openEdit}
          renderSelectCellActions={(status) => (
            <DirectoryTableRowActions
              row={status}
              onEdit={openEdit}
              onDelete={(row) => void remove(row)}
              deleteDisabled={isDeleting}
            />
          )}
        />
        <CatalogTablePagination state={table} />
      </Card>
      <CatalogBulkDeleteDialog state={bulkDelete} entity={t("barcodeStatuses.entity")} entities={t("barcodeStatuses.entities")} getName={(status) => status.name} />

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
