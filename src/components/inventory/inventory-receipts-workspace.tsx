"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PackageCheck, Plus } from "lucide-react";

import { InventoryReceiptForm } from "@/components/inventory/inventory-receipt-form";
import { InventoryReceiptViewSheet } from "@/components/inventory/inventory-receipt-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateReceipt,
  useInventoryItems,
  useInventoryReceipts,
  useInventorySnapshotData,
} from "@/lib/inventory/hooks/use-inventory";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = 50;

export function InventoryReceiptsWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded } = useFeedback();
  const { data: receipts = [], isLoading } = useInventoryReceipts();
  const { data: items = [] } = useInventoryItems();
  const snapshot = useInventorySnapshotData();
  const createReceipt = useCreateReceipt();

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<InventoryReceipt | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return receipts;
    return receipts.filter((receipt) =>
      [receipt.source, receipt.receivedBy, receipt.notes ?? ""].join(" ").toLowerCase().includes(normalized),
    );
  }, [query, receipts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: DataTableColumn<InventoryReceipt>[] = [
    { id: "date", label: t("inventory.columns.date"), renderCell: (row) => formatAuditDateTime(row.receiptDate) },
    { id: "source", label: t("inventory.columns.source"), renderCell: (row) => row.source },
    { id: "receivedBy", label: t("inventory.columns.receivedBy"), renderCell: (row) => row.receivedBy },
    {
      id: "lines",
      label: t("inventory.view.lines"),
      renderCell: (row) => snapshot.receiptLines.filter((line) => line.receiptId === row.id).length,
    },
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
    <div>
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

      <Card className="mt-6 gap-0">
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

        {isLoading ? (
          <DirectoryTableLoader
            icon={PackageCheck}
            title={t("inventory.loading.receipts.title")}
            description={t("inventory.loading.receipts.description")}
            columns={[t("inventory.columns.date"), t("inventory.columns.source"), t("inventory.columns.receivedBy")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => row.source}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={800}
            onRowClick={setViewReceipt}
            activeRowId={viewReceipt?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.receipts")}</p>}
          />
        )}

        {!isLoading ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", { count: pageRows.length, total: filtered.length, noun: t("inventory.submenus.receipts").toLowerCase() })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft className="h-4 w-4" />
                {t("common.actions.previous")}
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                {t("common.pagination.pageOf", { current: currentPage, total: totalPages })}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)}>
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <InventoryReceiptViewSheet
        receipt={viewReceipt}
        snapshot={snapshot}
        items={items}
        open={Boolean(viewReceipt)}
        onOpenChange={(open) => !open && setViewReceipt(null)}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.newReceiptTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryReceiptForm
            items={items}
            submitLabel={t("inventory.actions.saveReceipt")}
            isSubmitting={createReceipt.isPending}
            onCancel={() => setFormOpen(false)}
            onSubmit={async (values) => {
              try {
                await createReceipt.mutateAsync(values);
                notifyAdded(t("inventory.references.receipt"), values.source);
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
