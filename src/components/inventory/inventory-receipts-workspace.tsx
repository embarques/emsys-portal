"use client";

import { useMemo, useState } from "react";
import { PackageCheck, Plus } from "lucide-react";

import { InventoryReceiptForm } from "@/components/inventory/inventory-receipt-form";
import { InventoryReceiptMobileList } from "@/components/inventory/inventory-receipt-mobile-list";
import { InventoryReceiptViewSheet } from "@/components/inventory/inventory-receipt-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { formatInventoryDate, formatInventoryMoney, getReceiptItemLabel, getReceiptSupplierLabel } from "@/lib/inventory/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateReceipt,
  useDeleteReceipts,
  useInventoryItems,
  useInventoryReceipts,
  useInventorySuppliers,
  useUpdateReceipt,
} from "@/lib/inventory/hooks/use-inventory";
import { receiptToFormValues, type InventoryReceipt, type ReceiptFormValues } from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";

export function InventoryReceiptsWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const { data: receipts = [], isLoading, isError, error } = useInventoryReceipts();
  const { data: items = [] } = useInventoryItems();
  const { data: suppliers = [] } = useInventorySuppliers();
  const createReceipt = useCreateReceipt();
  const updateReceipt = useUpdateReceipt();
  const deleteReceipts = useDeleteReceipts();
  const canCreate = hasPermission(PERMISSIONS.inventoryReceiptsCreate.name, PERMISSIONS.inventoryReceiptsCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.inventoryReceiptsUpdate.name, PERMISSIONS.inventoryReceiptsUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.inventoryReceiptsDelete.name, PERMISSIONS.inventoryReceiptsDelete.resourceType);

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<InventoryReceipt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryReceipt | InventoryReceipt[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewReceipt, setViewReceipt] = useState<InventoryReceipt | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return receipts;
    return receipts.filter((receipt) =>
      [getReceiptItemLabel(receipt, items), getReceiptSupplierLabel(receipt, suppliers)]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query, receipts, suppliers]);

  const pageLimit = resolveClientTablePageLimit(pageSize, filtered.length);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  const listErrorMessage = isError ? toErrorMessage(error) : null;
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  useTableSelectionReset(buildTableSelectionResetKey(query), setSelectedIds);

  function openAddForm() {
    if (!canCreate) return;
    setEditingReceipt(null);
    setFormMode("add");
  }

  function openEditForm(receipt: InventoryReceipt) {
    if (!canUpdate) return;
    setEditingReceipt(receipt);
    setViewReceipt(null);
    setFormMode("edit");
  }

  async function saveReceipt(values: ReceiptFormValues) {
    try {
      if (formMode === "edit" && editingReceipt) {
        if (areFormValuesEquivalent(values, receiptToFormValues(editingReceipt))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          return;
        }
        const updated = await updateReceipt.mutateAsync({ id: editingReceipt.id, values });
        notifyUpdated(t("inventory.references.receipt"), getReceiptItemLabel(updated, items));
      } else {
        const created = await createReceipt.mutateAsync(values);
        notifyAdded(t("inventory.references.receipt"), getReceiptItemLabel(created, items));
      }
      setFormMode(null);
      setEditingReceipt(null);
    } catch (mutationError) {
      window.alert(toErrorMessage(mutationError));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((row) => row.id) : [deleteTarget.id];
    try {
      const result = await deleteReceipts.mutateAsync(ids);
      notifyDeleted(t("inventory.references.receipt"), result.succeededIds.length);
      setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
      setDeleteTarget(null);
      setViewReceipt(null);
    } catch (mutationError) {
      window.alert(toErrorMessage(mutationError));
    }
  }

  const columns: DataTableColumn<InventoryReceipt>[] = [
    {
      id: "item",
      label: t("inventory.columns.item"),
      renderCell: (row) => getReceiptItemLabel(row, items),
    },
    { id: "quantity", label: t("inventory.form.fields.quantityReceived"), renderCell: (row) => row.quantity },
    { id: "averageCost", label: t("inventory.columns.averageCost"), renderCell: (row) => formatInventoryMoney(row.averageCost) },
    {
      id: "supplier",
      label: t("inventory.columns.supplier"),
      renderCell: (row) => getReceiptSupplierLabel(row, suppliers),
    },
    { id: "date", label: t("inventory.columns.date"), renderCell: (row) => formatInventoryDate(row.receivedAt) },
  ];

  const columnVisibility = useColumnVisibility("inventory-receipts", columns);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: Boolean(query.trim()),
    query,
    matched: filtered.length,
    catalogTotal: receipts.length,
    noun: t("inventory.submenus.receipts").toLowerCase(),
  });

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader
          title={t("inventory.submenus.receipts")}
          description={t("inventory.pages.receipts")}
          actions={
          canCreate ? <Button onClick={openAddForm}>
              <Plus className="h-4 w-4" />
              {t("inventory.actions.newReceipt")}
            </Button> : null
          }
        />
      </div>

      <InventoryReceiptMobileList
        query={query}
        pageRows={pageRows}
        items={items}
        suppliers={suppliers}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onOpen={setViewReceipt}
        onAddReceipt={openAddForm}
        onEdit={canUpdate ? openEditForm : undefined}
        onDelete={canDelete ? setDeleteTarget : undefined}
      />

      {listErrorMessage ? <p className="mt-4 text-sm text-destructive md:hidden">{listErrorMessage}</p> : null}

      <Card className="mt-6 hidden gap-0 md:flex">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={false}
            onFiltersOpenChange={() => undefined}
            activeFilterCount={0}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder={t("inventory.search.receipts")}
              />
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRows.map((row) => row.id)}
          totalCount={filtered.length}
          onSelectedIdsChange={setSelectedIds}
          onEdit={canUpdate ? () => {
            const row = pageRows.find((entry) => entry.id === selectedIds[0]);
            if (row) openEditForm(row);
          } : undefined}
          onDelete={canDelete ? () => setDeleteTarget(receipts.filter((row) => selectedIds.includes(row.id))) : undefined}
        />

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={PackageCheck}
            title={t("inventory.loading.receipts.title")}
            description={t("inventory.loading.receipts.description")}
            columns={[t("inventory.columns.item"), t("inventory.form.fields.quantityReceived"), t("inventory.columns.supplier")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => getReceiptItemLabel(row, items)}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={800}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={(checked) =>
              setSelectedIds((current) =>
                checked
                  ? Array.from(new Set([...current, ...pageRows.map((row) => row.id)]))
                  : current.filter((id) => !pageRows.some((row) => row.id === id)),
              )
            }
            onToggleSelect={(id, checked) =>
              setSelectedIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)))
            }
            onRowClick={setViewReceipt}
            onRowDoubleClick={canUpdate ? openEditForm : undefined}
            activeRowId={viewReceipt?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.receipts")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", { count: pageRows.length, total: filtered.length, noun: t("inventory.submenus.receipts").toLowerCase() })}
            </p>
            <TablePaginationControls
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
            />
          </div>
        ) : null}
      </Card>

      <InventoryReceiptViewSheet
        receipt={viewReceipt}
        items={items}
        suppliers={suppliers}
        open={Boolean(viewReceipt)}
        onOpenChange={(open) => !open && setViewReceipt(null)}
        onEdit={canUpdate ? openEditForm : undefined}
        onDelete={canDelete ? setDeleteTarget : undefined}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{formMode === "edit" ? t("common.actions.edit") : t("inventory.form.newReceiptTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryReceiptForm
            items={items}
            suppliers={suppliers}
            initialValues={editingReceipt ? receiptToFormValues(editingReceipt) : undefined}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.saveReceipt")}
            isSubmitting={createReceipt.isPending || updateReceipt.isPending}
            onCancel={() => setFormMode(null)}
            onSubmit={saveReceipt}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.actions.delete")}</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `${deleteTarget.length} ${t("inventory.submenus.receipts").toLowerCase()}`
                : deleteTarget
                  ? getReceiptItemLabel(deleteTarget, items)
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("common.actions.cancel")}</Button>
            <ConfirmDeleteButton isPending={deleteReceipts.isPending} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
