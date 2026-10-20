"use client";

import { useMemo, useState } from "react";
import { PackageCheck, Plus } from "lucide-react";

import { InventoryDocumentCommandDialog, type InventoryDocumentCommand } from "@/components/inventory/inventory-document-command-dialog";
import { InventoryDocumentMobileList } from "@/components/inventory/inventory-document-mobile-list";
import { InventoryDocumentMobileRow } from "@/components/inventory/inventory-document-mobile-row";
import { InventoryReceiptForm } from "@/components/inventory/inventory-receipt-form";
import { InventoryReceiptViewSheet } from "@/components/inventory/inventory-receipt-view-sheet";
import { InventoryDocumentStatusBadge } from "@/components/inventory/inventory-status-badge";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { INVENTORY_RECEIPT_API_TABLE_FIELDS } from "@/lib/inventory/receipts/table-fields";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import {
  formatInventoryDateTime,
  formatInventoryMinor,
  getDocumentStatusLabel,
  getHolderNameById,
  getSupplierNameById,
  receiptMatchesQuery,
  summarizeDocumentLines,
} from "@/lib/inventory/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCancelReceipt,
  useCreateReceipt,
  useInventoryHolders,
  useInventoryItems,
  useInventoryReceipts,
  useInventorySuppliers,
  usePostReceipt,
  useUpdateReceipt,
} from "@/lib/inventory/hooks/use-inventory";
import {
  receiptToFormValues,
  sumLineQuantities,
  sumReceiptLinesMinor,
  type InventoryReceipt,
  type ReceiptFormValues,
} from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";

export function InventoryReceiptsWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { hasPermission } = useAuth();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifySuccess, notifyError } = useFeedback();
  const { data: receipts = [], isLoading, isError, error } = useInventoryReceipts();
  const { data: items = [] } = useInventoryItems();
  const { data: suppliers = [] } = useInventorySuppliers();
  const { data: holders = [] } = useInventoryHolders();
  const createReceipt = useCreateReceipt();
  const updateReceipt = useUpdateReceipt();
  const postReceipt = usePostReceipt();
  const cancelReceipt = useCancelReceipt();
  const canCreate = hasPermission(PERMISSIONS.inventoryReceiptsCreate.name, PERMISSIONS.inventoryReceiptsCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.inventoryReceiptsUpdate.name, PERMISSIONS.inventoryReceiptsUpdate.resourceType);

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<InventoryReceipt | null>(null);
  const [viewReceipt, setViewReceipt] = useState<InventoryReceipt | null>(null);
  const [commandTarget, setCommandTarget] = useState<{ command: InventoryDocumentCommand; receipt: InventoryReceipt } | null>(null);

  const filtered = useMemo(
    () =>
      receipts.filter((receipt) =>
        receiptMatchesQuery(receipt, query, {
          items,
          suppliers,
          holders,
          statusLabel: getDocumentStatusLabel(receipt.status, t),
        }),
      ),
    [holders, items, query, receipts, suppliers, t],
  );

  const pageLimit = resolveClientTablePageLimit(pageSize, filtered.length);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  const listErrorMessage = isError ? toErrorMessage(error) : null;
  const commandPending = postReceipt.isPending || cancelReceipt.isPending;
  const editingReceiptValues = useMemo(() => (editingReceipt ? receiptToFormValues(editingReceipt) : undefined), [editingReceipt]);

  function openAddForm() {
    if (!canCreate) return;
    setEditingReceipt(null);
    setFormMode("add");
  }

  function openEditForm(receipt: InventoryReceipt) {
    if (!canUpdate || receipt.status !== "DRAFT") return;
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
        const updated = await updateReceipt.mutateAsync({ receipt: editingReceipt, values });
        notifyUpdated(t("inventory.references.receipt"), getSupplierNameById(updated.supplierId, suppliers));
      } else {
        const created = await createReceipt.mutateAsync(values);
        notifyAdded(t("inventory.references.receipt"), getSupplierNameById(created.supplierId, suppliers));
      }
      setFormMode(null);
      setEditingReceipt(null);
    } catch (mutationError) {
      notifyError(toErrorMessage(mutationError));
    }
  }

  async function confirmCommand() {
    if (!commandTarget) return;
    const { command, receipt } = commandTarget;
    try {
      if (command === "post") {
        await postReceipt.mutateAsync(receipt);
        notifySuccess(t("inventory.toasts.receiptPosted"));
      } else {
        await cancelReceipt.mutateAsync(receipt);
        notifySuccess(t("inventory.toasts.receiptCancelled"));
      }
      setCommandTarget(null);
      setViewReceipt(null);
    } catch (mutationError) {
      notifyError(toErrorMessage(mutationError));
    }
  }

  const columns: DataTableColumn<InventoryReceipt>[] = [
    {
      id: "supplier",
      label: t("inventory.columns.supplier"),
      cellClassName: "font-medium",
      renderCell: (row) => getSupplierNameById(row.supplierId, suppliers) || dash,
    },
    { id: "holder", label: t("inventory.columns.warehouse"), renderCell: (row) => getHolderNameById(row.toHolderId, holders) || dash },
    { id: "lines", label: t("inventory.columns.lines"), renderCell: (row) => summarizeDocumentLines(row.lines, items) || dash },
    { id: "totalQuantity", label: t("inventory.columns.totalQuantity"), cellClassName: "tabular-nums", renderCell: (row) => sumLineQuantities(row.lines) },
    { id: "totalCost", label: t("inventory.columns.totalCost"), cellClassName: "tabular-nums", renderCell: (row) => formatInventoryMinor(sumReceiptLinesMinor(row.lines)) },
    { id: "date", label: t("inventory.columns.date"), renderCell: (row) => formatInventoryDateTime(row.receivedAt) },
    { id: "status", label: t("inventory.columns.status"), renderCell: (row) => <InventoryDocumentStatusBadge status={row.status} /> },
  ];

  const columnVisibility = useApiTableColumns("inventory-receipts", columns, INVENTORY_RECEIPT_API_TABLE_FIELDS);
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

      <InventoryDocumentMobileList
        title={t("inventory.submenus.receipts")}
        description={t("inventory.pages.receipts")}
        addLabel={t("inventory.actions.newReceipt")}
        searchPlaceholder={t("inventory.search.receipts")}
        emptyMessage={t("inventory.empty.receipts")}
        loadingTitle={t("inventory.loading.receipts.title")}
        loadingDescription={t("inventory.loading.receipts.description")}
        loadingColumns={[t("inventory.columns.supplier"), t("inventory.columns.lines"), t("inventory.columns.status")]}
        icon={PackageCheck}
        query={query}
        pageRows={pageRows}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onAdd={canCreate ? openAddForm : undefined}
        renderRow={(receipt) => (
          <InventoryDocumentMobileRow
            key={receipt.id}
            icon={PackageCheck}
            iconClassName="bg-emerald-100 text-emerald-700"
            title={getSupplierNameById(receipt.supplierId, suppliers) || dash}
            subtitle={formatInventoryDateTime(receipt.receivedAt)}
            detail={summarizeDocumentLines(receipt.lines, items) || dash}
            amount={formatInventoryMinor(sumReceiptLinesMinor(receipt.lines))}
            status={receipt.status}
            onOpen={() => setViewReceipt(receipt)}
            onEdit={canUpdate && receipt.status === "DRAFT" ? () => openEditForm(receipt) : undefined}
            onPost={canUpdate && receipt.status === "DRAFT" ? () => setCommandTarget({ command: "post", receipt }) : undefined}
          />
        )}
      />

      {listErrorMessage ? <p className="mt-4 text-sm text-destructive md:hidden">{listErrorMessage}</p> : null}

      <Card className="mt-6 hidden gap-0 md:flex">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            showFilterToggle={false}
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

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={PackageCheck}
            title={t("inventory.loading.receipts.title")}
            description={t("inventory.loading.receipts.description")}
            columns={[t("inventory.columns.supplier"), t("inventory.columns.lines"), t("inventory.columns.status")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => getSupplierNameById(row.supplierId, suppliers)}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={960}
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
        holders={holders}
        open={Boolean(viewReceipt)}
        isBusy={commandPending}
        onOpenChange={(open) => !open && setViewReceipt(null)}
        onEdit={canUpdate ? openEditForm : undefined}
        onPost={canUpdate ? (receipt) => setCommandTarget({ command: "post", receipt }) : undefined}
        onCancelDraft={canUpdate ? (receipt) => setCommandTarget({ command: "cancel", receipt }) : undefined}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{formMode === "edit" ? t("inventory.form.editReceiptTitle") : t("inventory.form.newReceiptTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryReceiptForm
            key={editingReceipt?.id ?? "new"}
            items={items}
            suppliers={suppliers}
            holders={holders}
            initialValues={editingReceiptValues}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.saveDraft")}
            isSubmitting={createReceipt.isPending || updateReceipt.isPending}
            onCancel={() => setFormMode(null)}
            onSubmit={saveReceipt}
          />
        </DialogContent>
      </Dialog>

      <InventoryDocumentCommandDialog
        command={commandTarget?.command ?? null}
        copyKey="inventory.commands.receipt"
        label={commandTarget ? getSupplierNameById(commandTarget.receipt.supplierId, suppliers) : ""}
        isPending={commandPending}
        onConfirm={confirmCommand}
        onOpenChange={(open) => !open && setCommandTarget(null)}
      />
    </div>
  );
}
