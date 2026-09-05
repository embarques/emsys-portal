"use client";

import { useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";

import { InventoryDispatchForm } from "@/components/inventory/inventory-dispatch-form";
import { InventoryDispatchMobileList } from "@/components/inventory/inventory-dispatch-mobile-list";
import { InventoryDispatchViewSheet } from "@/components/inventory/inventory-dispatch-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableTagText } from "@/components/app-shell/table-tag-text";
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
  useCreateDispatch,
  useInventoryDispatches,
  useInventoryItems,
  useInventoryRecipients,
  useInventorySnapshotData,
  useUpdateDispatchStatus,
} from "@/lib/inventory/hooks/use-inventory";
import { getDispatchStatusLabel } from "@/lib/inventory/display";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";

function getDispatchStatusClass(status: InventoryDispatch["status"]): string {
  switch (status) {
    case "pending":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "sent":
      return "border-transparent bg-primary/15 text-primary";
    case "confirmed":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "";
  }
}

export function InventoryDispatchesWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { data: dispatches = [], isLoading } = useInventoryDispatches();
  const { data: items = [] } = useInventoryItems();
  const { data: recipients = [] } = useInventoryRecipients();
  const snapshot = useInventorySnapshotData();
  const createDispatch = useCreateDispatch();
  const updateStatus = useUpdateDispatchStatus();

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [formOpen, setFormOpen] = useState(false);
  const [viewDispatch, setViewDispatch] = useState<InventoryDispatch | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return dispatches;
    return dispatches.filter((dispatch) => {
      const recipient = recipients.find((entry) => entry.id === dispatch.recipientId);
      return [dispatch.dispatchedBy, dispatch.invoiceNumber ?? "", recipient?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [dispatches, query, recipients]);

  const pageLimit = resolveClientTablePageLimit(pageSize, filtered.length);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

  const columns: DataTableColumn<InventoryDispatch>[] = [
    { id: "date", label: t("inventory.columns.date"), renderCell: (row) => formatAuditDateTime(row.dispatchDate) },
    {
      id: "recipient",
      label: t("inventory.columns.recipient"),
      renderCell: (row) => recipients.find((entry) => entry.id === row.recipientId)?.name ?? row.recipientId,
    },
    { id: "dispatchedBy", label: t("inventory.columns.dispatchedBy"), renderCell: (row) => row.dispatchedBy },
    {
      id: "status",
      label: t("inventory.columns.status"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (row) => (
        <TableTagText className={getDispatchStatusClass(row.status)}>
          {getDispatchStatusLabel(row.status, t)}
        </TableTagText>
      ),
    },
    {
      id: "invoice",
      label: t("inventory.columns.invoiceNumber"),
      renderCell: (row) => row.invoiceNumber ?? "—",
    },
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
        recipients={recipients}
        snapshot={snapshot}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onOpen={setViewDispatch}
        onAddDispatch={() => setFormOpen(true)}
      />

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
                placeholder={t("inventory.search.dispatches")}
              />
            }
          />
        </CardHeader>

        {isLoading ? (
          <DirectoryTableLoader
            icon={Truck}
            title={t("inventory.loading.dispatches.title")}
            description={t("inventory.loading.dispatches.description")}
            columns={[t("inventory.columns.date"), t("inventory.columns.recipient"), t("inventory.columns.status")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => row.id}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={900}
            onRowClick={setViewDispatch}
            activeRowId={viewDispatch?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.dispatches")}</p>}
          />
        )}

        {!isLoading ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", { count: pageRows.length, total: filtered.length, noun: t("inventory.submenus.dispatches").toLowerCase() })}
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
        snapshot={snapshot}
        items={items}
        recipients={recipients}
        open={Boolean(viewDispatch)}
        onOpenChange={(open) => !open && setViewDispatch(null)}
        onMarkSent={async (dispatch) => {
          try {
            await updateStatus.mutateAsync({ id: dispatch.id, status: "sent" });
            notifyUpdated(t("inventory.references.dispatch"), dispatch.id);
            setViewDispatch((current) => (current?.id === dispatch.id ? { ...current, status: "sent" } : current));
          } catch (error) {
            window.alert(toErrorMessage(error));
          }
        }}
        onMarkConfirmed={async (dispatch) => {
          await updateStatus.mutateAsync({ id: dispatch.id, status: "confirmed" });
          notifyUpdated(t("inventory.references.dispatch"), dispatch.id);
          setViewDispatch((current) => (current?.id === dispatch.id ? { ...current, status: "confirmed" } : current));
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{t("inventory.form.newDispatchTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryDispatchForm
            items={items}
            recipients={recipients}
            submitLabel={t("inventory.actions.saveDispatch")}
            secondarySubmitLabel={t("inventory.actions.saveAndSend")}
            isSubmitting={createDispatch.isPending}
            onCancel={() => setFormOpen(false)}
            onSubmit={async (values) => {
              try {
                await createDispatch.mutateAsync(values);
                notifyAdded(t("inventory.references.dispatch"), values.invoiceNumber || values.recipientId);
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
