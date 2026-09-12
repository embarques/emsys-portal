"use client";

import { useMemo, useState } from "react";
import { PackageCheck, Plus } from "lucide-react";

import { InventoryReceiptForm } from "@/components/inventory/inventory-receipt-form";
import { InventoryReceiptMobileList } from "@/components/inventory/inventory-receipt-mobile-list";
import { InventoryReceiptViewSheet } from "@/components/inventory/inventory-receipt-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInventoryDate, formatInventoryMoney, getReceiptItemLabel, getReceiptSupplierLabel } from "@/lib/inventory/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateReceipt,
  useInventoryItems,
  useInventoryReceipts,
  useInventorySuppliers,
} from "@/lib/inventory/hooks/use-inventory";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";

export function InventoryReceiptsWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded } = useFeedback();
  const { data: receipts = [], isLoading, isError, error } = useInventoryReceipts();
  const { data: items = [] } = useInventoryItems();
  const { data: suppliers = [] } = useInventorySuppliers();
  const createReceipt = useCreateReceipt();

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [formOpen, setFormOpen] = useState(false);
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
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("inventory.actions.newReceipt")}
            </Button>
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
        onAddReceipt={() => setFormOpen(true)}
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
            onRowClick={setViewReceipt}
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
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{t("inventory.form.newReceiptTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryReceiptForm
            items={items}
            suppliers={suppliers}
            submitLabel={t("inventory.actions.saveReceipt")}
            isSubmitting={createReceipt.isPending}
            onCancel={() => setFormOpen(false)}
            onSubmit={async (values) => {
              try {
                await createReceipt.mutateAsync(values);
                const item = items.find((entry) => entry.id === values.itemId);
                notifyAdded(t("inventory.references.receipt"), item?.item ?? values.itemId);
                setFormOpen(false);
              } catch (error) {
                window.alert(toErrorMessage(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
