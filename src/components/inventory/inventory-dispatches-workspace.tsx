"use client";

import { useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";

import { InventoryDispatchForm } from "@/components/inventory/inventory-dispatch-form";
import { InventoryDispatchMobileList } from "@/components/inventory/inventory-dispatch-mobile-list";
import { InventoryDispatchViewSheet } from "@/components/inventory/inventory-dispatch-view-sheet";
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
import { formatInventoryDate, formatInventoryMoney, getInventoryDispatchToLabel, getDispatchItemLabel, dispatchMatchesQuery } from "@/lib/inventory/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateDispatch,
  useInventoryDispatches,
  useInventoryItems,
} from "@/lib/inventory/hooks/use-inventory";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";

export function InventoryDispatchesWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded } = useFeedback();
  const { data: dispatches = [], isLoading, isError, error } = useInventoryDispatches();
  const { data: items = [] } = useInventoryItems();
  const createDispatch = useCreateDispatch();

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [formOpen, setFormOpen] = useState(false);
  const [viewDispatch, setViewDispatch] = useState<InventoryDispatch | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return dispatches;
    return dispatches.filter((dispatch) => {
      return dispatchMatchesQuery(dispatch, getDispatchItemLabel(dispatch, items), normalized);
    });
  }, [dispatches, items, query]);

  const pageLimit = resolveClientTablePageLimit(pageSize, filtered.length);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  const listErrorMessage = isError ? toErrorMessage(error) : null;

  const columns: DataTableColumn<InventoryDispatch>[] = [
    {
      id: "item",
      label: t("inventory.columns.item"),
      renderCell: (row) => getDispatchItemLabel(row, items),
    },
    { id: "quantity", label: t("inventory.form.fields.quantityDispatched"), renderCell: (row) => row.quantity },
    {
      id: "dispatchedTo",
      label: t("inventory.columns.dispatchedTo"),
      renderCell: (row) => getInventoryDispatchToLabel(row.dispatchedTo),
    },
    { id: "incomeGained", label: t("inventory.columns.incomeGained"), renderCell: (row) => formatInventoryMoney(row.incomeGained) },
    { id: "date", label: t("inventory.columns.date"), renderCell: (row) => formatInventoryDate(row.dispatchedAt) },
  ];

  const columnVisibility = useColumnVisibility("inventory-dispatches", columns);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: Boolean(query.trim()),
    query,
    matched: filtered.length,
    catalogTotal: dispatches.length,
    noun: t("inventory.submenus.dispatches").toLowerCase(),
  });

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader
          title={t("inventory.submenus.dispatches")}
          description={t("inventory.pages.dispatches")}
          actions={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("inventory.actions.newDispatch")}
            </Button>
          }
        />
      </div>

      <InventoryDispatchMobileList
        query={query}
        pageRows={pageRows}
        items={items}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onOpen={setViewDispatch}
        onAddDispatch={() => setFormOpen(true)}
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
                placeholder={t("inventory.search.dispatches")}
              />
            }
          />
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Truck}
            title={t("inventory.loading.dispatches.title")}
            description={t("inventory.loading.dispatches.description")}
            columns={[t("inventory.columns.item"), t("inventory.form.fields.quantityDispatched"), t("inventory.columns.date")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => getDispatchItemLabel(row, items)}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={800}
            onRowClick={setViewDispatch}
            activeRowId={viewDispatch?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.dispatches")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: pageRows.length,
                total: filtered.length,
                noun: t("inventory.submenus.dispatches").toLowerCase(),
              })}
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

      <InventoryDispatchViewSheet
        dispatch={viewDispatch}
        items={items}
        open={Boolean(viewDispatch)}
        onOpenChange={(open) => !open && setViewDispatch(null)}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{t("inventory.form.newDispatchTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryDispatchForm
            items={items}
            submitLabel={t("inventory.actions.saveDispatch")}
            isSubmitting={createDispatch.isPending}
            onCancel={() => setFormOpen(false)}
            onSubmit={async (values) => {
              try {
                await createDispatch.mutateAsync(values);
                const item = items.find((entry) => entry.id === values.itemId);
                notifyAdded(t("inventory.references.dispatch"), item?.item ?? values.itemId);
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
