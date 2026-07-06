"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  DollarSign,
  FileText,
  Plus,
  Printer,
  Receipt,
  Tags,
  Trash2,
} from "lucide-react";

import { InvoiceStagingDialog } from "@/components/invoices/invoice-staging-dialog";
import { InvoiceCreateWizard, InvoiceEditWizard } from "@/components/invoices/invoice-form-workspace";
import { InvoiceViewSheet } from "@/components/invoices/invoice-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { DirectoryTableRowActions } from "@/components/app-shell/directory-table-row-actions";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeApiError } from "@/lib/api/axios";
import {
  computeInvoiceKpis,
  formatInvoiceDate,
  formatInvoiceMoney,
  formatInvoicePartySummary,
  formatInvoiceTabLabel,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoiceBalanceMoneyClass,
  getInvoiceDiscountMoneyClass,
  getInvoicePaidMoneyClass,
  getInvoicePaidStatusBadgeClass,
  getInvoicePaidStatusLabel,
  getInvoiceSubtotal,
  getInvoiceTotalMoneyClass,
  getPaymentLocationLabel,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import {
  buildInvoiceCommentActivity,
  buildPaymentRecordedActivity,
} from "@/lib/invoices/activity";
import {
  useDeleteInvoices,
  useInvoice,
  useInvoiceStats,
  useInvoices,
} from "@/lib/invoices/hooks/use-invoices";
import { usePrintInvoices } from "@/lib/invoices/hooks/use-print-invoices";
import { useRoutePicker } from "@/lib/route-manager/hooks/use-route-manager";
import { formatRouteCopyLabel } from "@/lib/route-manager/display";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { buildOrderCreatedByFilterOptions } from "@/lib/orders/display";
import { useUsers } from "@/lib/users/hooks/use-users";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { encodeStagingInvoiceIds } from "@/lib/invoices/staging";
import {
  buildInvoiceListParams,
  createInvoiceComment,
  createInvoicePayment,
  computeTotalPayments,
  DEFAULT_INVOICE_LIST_PARAMS,
  getInvoiceRecordId,
  type Invoice,
  type InvoiceFilterState,
  type InvoicePaymentInput,
} from "@/lib/invoices/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import { useSyncWorkspaceTabTitle } from "@/lib/layout/hooks/use-sync-workspace-tab-title";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { getBranchBadgeClass } from "@/lib/vehicles/display";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = DEFAULT_INVOICE_LIST_PARAMS.limit;

const defaultFilters: InvoiceFilterState = {
  query: "",
  rows: [],
  paymentLocation: "all",
};

export function InvoicesWorkspace() {
  const { t } = useTranslation();
  const { notifyAdded, notifyDeleted, notifyError } = useFeedback();
  const [filters, setFilters] = useState<InvoiceFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_INVOICE_LIST_PARAMS.sort, () => setPage(1));
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewOverlay, setViewOverlay] = useState<Partial<Invoice> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | Invoice[] | null>(null);
  const [stagingOpen, setStagingOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openManageInvoiceItems() {
    if (selectedInvoices.length === 0) {
      notifyError("Select at least one invoice to manage items.");
      return;
    }

    if (isDesktopTabs) {
      openFormTab({
        feature: "invoice-item-staging",
        baseHref: "/invoices",
        mode: "stage",
        entityId: encodeStagingInvoiceIds(selectedInvoices.map((invoice) => invoice.invoiceId)),
        label: t("invoices.staging.tableAction"),
      });
      return;
    }

    setStagingOpen(true);
  }

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "invoices", baseHref: "/invoices", mode: "add", label: "Add invoice" });
      return;
    }
    setAddFormOpen(true);
  }

  function openEditForm(invoice: Invoice) {
    closeView();
    if (isDesktopTabs) {
      openFormTab({
        feature: "invoices",
        baseHref: "/invoices",
        mode: "edit",
        entityId: getInvoiceRecordId(invoice),
        label: formatInvoiceTabLabel(invoice),
      });
      return;
    }
    setEditInvoiceId(getInvoiceRecordId(invoice));
  }

  function openDeleteInvoice(invoice: Invoice) {
    closeView();
    setDeleteTarget(invoice);
  }

  const listParams = useMemo(
    () =>
      buildInvoiceListParams({
        page,
        limit: PAGE_SIZE,
        query: deferredQuery,
        rows: filters.rows,
        paymentLocation: filters.paymentLocation,
        sort,
      }),
    [deferredQuery, filters.paymentLocation, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useInvoices(listParams);
  const invoiceStats = useInvoiceStats();
  const { data: usersData, isLoading: usersLoading } = useUsers({
    page: 1,
    limit: 100,
    sort: "name:asc",
  });
  const deleteInvoicesMutation = useDeleteInvoices();
  const { printInvoiceIds, isPrinting } = usePrintInvoices();
  const { data: routesData } = useRoutePicker(undefined, { enabled: filtersOpen });
  const { data: detailInvoice } = useInvoice(viewInvoiceId, Boolean(viewInvoiceId));

  const invoices = data?.items ?? [];
  const totalInvoices = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    invoices.length > 0 && invoices.every((invoice) => selectedIds.includes(invoice.invoiceId));
  const isDeleting = deleteInvoicesMutation.isPending;

  const viewInvoice = useMemo(() => {
    if (!viewInvoiceId) return null;
    const base =
      detailInvoice ?? invoices.find((invoice) => invoice.invoiceId === viewInvoiceId) ?? null;
    if (!base) return null;
    if (!viewOverlay) return base;

    return {
      ...base,
      comments: [...base.comments, ...(viewOverlay.comments ?? [])],
      activity: [...base.activity, ...(viewOverlay.activity ?? [])],
      payments: [...base.payments, ...(viewOverlay.payments ?? [])],
      amountPaid: viewOverlay.amountPaid ?? base.amountPaid,
      updatedAt: viewOverlay.updatedAt ?? base.updatedAt,
    };
  }, [detailInvoice, invoices, viewInvoiceId, viewOverlay]);

  useSyncWorkspaceTabTitle(
    viewInvoice ? `Invoice #${viewInvoice.invoiceNumber}` : null,
    "Invoices",
  );

  const kpis = useMemo(() => computeInvoiceKpis(invoices), [invoices]);

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)),
    [invoices, selectedIds],
  );

  const routes = useMemo(
    () => routesData?.items ?? [],
    [routesData?.items],
  );
  const routeOptions = useMemo(
    () =>
      routes.map((assignment) => ({
        value: assignment.id,
        label: formatRouteCopyLabel(assignment),
      })),
    [routes],
  );
  const userFilterOptions = useMemo(
    () => buildOrderCreatedByFilterOptions(usersData?.items ?? []),
    [usersData?.items],
  );

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...invoices.map((invoice) => invoice.invoiceId)])),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !invoices.some((invoice) => invoice.invoiceId === id)),
    );
  }

  function toggleSelect(invoiceId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, invoiceId] : current.filter((entry) => entry !== invoiceId)));
  }

  function openView(invoice: Invoice) {
    setViewInvoiceId(invoice.invoiceId);
    setViewOverlay(null);
  }

  function closeView() {
    setViewInvoiceId(null);
    setViewOverlay(null);
  }

  function addInvoiceComment(invoiceId: string, description: string) {
    const comment = createInvoiceComment(description);
    const timestamp = comment.createdAt;
    const activityEntry = buildInvoiceCommentActivity(
      invoiceId,
      description,
      comment.createdBy,
      timestamp,
    );

    setViewOverlay((current) => ({
      ...current,
      comments: [...(current?.comments ?? []), comment],
      activity: [...(current?.activity ?? []), activityEntry],
      updatedAt: timestamp,
    }));

    notifyAdded("Comment");
  }

  function recordInvoicePayment(invoiceId: string, input: InvoicePaymentInput) {
    const payment = createInvoicePayment(invoiceId, input);

    setViewOverlay((current) => {
      const payments = [...(current?.payments ?? []), payment];
      const amountPaid = computeTotalPayments(payments);
      return {
        ...current,
        payments,
        amountPaid,
        activity: [...(current?.activity ?? []), buildPaymentRecordedActivity(payment, amountPaid)],
        updatedAt: payment.createdAt,
      };
    });

    notifyAdded("Payment", formatInvoiceMoney(payment.amount));
  }

  async function printSelectedInvoices() {
    const invoiceIds = selectedInvoices.map((invoice) => invoice.invoiceId).filter(Boolean);
    await printInvoiceIds(invoiceIds);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((invoice) => invoice.invoiceId)
      : [deleteTarget.invoiceId];

    try {
      await deleteInvoicesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      closeView();
      notifyDeleted("Invoice", ids.length);
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  const editingInvoice = useMemo(
    () => invoices.find((invoice) => invoice.invoiceId === editInvoiceId) ?? null,
    [editInvoiceId, invoices],
  );

  const stats = [
    {
      label: "Total invoices",
      value: isLoading ? "…" : totalInvoices.toString(),
      description: "Invoices on record",
      icon: FileText,
      details: [
        { label: "Current page", value: isLoading ? "…" : invoices.length.toString() },
        { label: "Page", value: isLoading ? "…" : `${currentPage} of ${totalPages}` },
        { label: "Page size", value: PAGE_SIZE.toString() },
      ],
    },
    {
      label: "Outstanding invoices",
      value: invoiceStats.isLoading ? "…" : invoiceStats.outstanding.toString(),
      description: "Invoices with open balance",
      icon: CircleAlert,
      details: [
        {
          label: "Open invoices",
          value: invoiceStats.isLoading ? "…" : invoiceStats.outstanding.toString(),
        },
        {
          label: "Share of total",
          value:
            invoiceStats.isLoading || isLoading || totalInvoices === 0
              ? "…"
              : `${Math.round((invoiceStats.outstanding / totalInvoices) * 100)}%`,
        },
        { label: "Statuses", value: "Open / partial" },
      ],
    },
    {
      label: "Outstanding",
      value: invoiceStats.isBalanceLoading
        ? "…"
        : formatInvoiceMoney(invoiceStats.outstandingBalance),
      description: "Balance across all invoices",
      icon: Receipt,
      details: [
        {
          label: "Open invoices",
          value: invoiceStats.isLoading ? "…" : invoiceStats.outstanding.toString(),
        },
        {
          label: "Average balance",
          value:
            invoiceStats.isBalanceLoading || invoiceStats.outstanding === 0
              ? "…"
              : formatInvoiceMoney(
                  invoiceStats.outstandingBalance / invoiceStats.outstanding,
                ),
        },
        { label: "Scope", value: "All invoices" },
      ],
    },
    {
      label: "Collected",
      value: isLoading ? "…" : formatInvoiceMoney(kpis.collected),
      description: "Paid on this page",
      icon: DollarSign,
      details: [
        {
          label: "Paid invoices",
          value: isLoading
            ? "…"
            : invoices.filter((invoice) => invoice.amountPaid > 0).length.toString(),
        },
        {
          label: "Average paid",
          value:
            isLoading || invoices.every((invoice) => invoice.amountPaid <= 0)
              ? "…"
              : formatInvoiceMoney(
                  kpis.collected /
                    invoices.filter((invoice) => invoice.amountPaid > 0).length,
                ),
        },
        { label: "Scope", value: "Current page" },
      ],
    },
  ];

  const tableColumns: DataTableColumn<Invoice>[] = [
    {
      id: "invoiceNumber",
      label: "Invoice number",
      sortField: "number",
      cellClassName: "font-medium",
      renderCell: (invoice) => invoice.invoiceNumber,
    },
    {
      id: "date",
      label: "Date",
      renderCell: (invoice) => formatInvoiceDate(invoice.date),
    },
    {
      id: "container",
      label: "Container",
      sortField: "container.name",
      renderCell: (invoice) => getContainerLabelForInvoice(invoice),
    },
    {
      id: "paidStatus",
      label: "Status",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (invoice) => {
        const status = resolveInvoicePaidStatus(invoice);
        return (
          <TableTagText className={getInvoicePaidStatusBadgeClass(status)}>
            {getInvoicePaidStatusLabel(status)}
          </TableTagText>
        );
      },
    },
    {
      id: "paymentLocation",
      label: "Paid at",
      sortField: "paidRegion",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (invoice) => (
        <TableTagText className={getBranchBadgeClass(invoice.paymentLocation)}>
          {getPaymentLocationLabel(invoice.paymentLocation)}
        </TableTagText>
      ),
    },
    {
      id: "sender",
      label: "Sender",
      sortField: "sender.name",
      renderCell: (invoice) => formatInvoicePartySummary(invoice.sender),
    },
    {
      id: "receiver",
      label: "Receiver",
      sortField: "receiver.name",
      renderCell: (invoice) => formatInvoicePartySummary(invoice.receiver),
    },
    {
      id: "total",
      label: "Invoice total",
      sortField: "cost",
      truncateCell: false,
      renderCell: (invoice) => {
        const amount = getInvoiceSubtotal(invoice);
        return <span className={getInvoiceTotalMoneyClass()}>{formatInvoiceMoney(amount)}</span>;
      },
    },
    {
      id: "discount",
      label: "Discount",
      truncateCell: false,
      renderCell: (invoice) => (
        <span className={getInvoiceDiscountMoneyClass(invoice.discount)}>
          {formatInvoiceMoney(invoice.discount)}
        </span>
      ),
    },
    {
      id: "amountPaid",
      label: "Paid",
      sortField: "payment",
      truncateCell: false,
      renderCell: (invoice) => (
        <span className={getInvoicePaidMoneyClass(invoice.amountPaid)}>
          {formatInvoiceMoney(invoice.amountPaid)}
        </span>
      ),
    },
    {
      id: "balance",
      label: "Balance",
      truncateCell: false,
      renderCell: (invoice) => {
        const amount = getInvoiceBalance(invoice);
        return <span className={getInvoiceBalanceMoneyClass(amount)}>{formatInvoiceMoney(amount)}</span>;
      },
    },
  ];

  const columnVisibility = useColumnVisibility("invoices-v4", tableColumns);
  const advancedFilterCount = countCompleteFilterRows(filters.rows, INVOICE_TABLE_FILTER_FIELDS);
  const activeFilterCount = advancedFilterCount;
  const hasActiveFilters = Boolean(filters.query.trim()) || advancedFilterCount > 0;
  const isSearchPending = filters.query.trim() !== deferredQuery.trim();
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalInvoices,
    noun: "invoices",
    isLoading: isFetching && invoices.length === 0,
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add invoice
          </Button>
        }
      />

      <StatCards items={stats} />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search by invoice number, sender, receiver, or container…"
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${invoices.length} of ${totalInvoices} invoices`}
                presets={{
                  storageKey: "invoices",
                  rows: filters.rows,
                  fields: INVOICE_TABLE_FILTER_FIELDS,
                  onApply: (rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  },
                }}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={filters.rows}
                  fields={INVOICE_TABLE_FILTER_FIELDS}
                  dynamicOptions={{
                    users: usersLoading ? [] : userFilterOptions,
                    routes: routeOptions,
                  }}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={invoices.map((invoice) => invoice.invoiceId)}
          totalCount={totalInvoices}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const invoice = selectedInvoices[0];
            if (invoice) openEditForm(invoice);
          }}
          onDelete={() =>
            setDeleteTarget(invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)))
          }
          deleteDisabled={isDeleting}
          actions={
            <>
              <Button size="sm" onClick={openManageInvoiceItems}>
                <Tags className="h-4 w-4" />
                {t("invoices.staging.tableAction")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={printSelectedInvoices}
                disabled={isPrinting}
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? "Preparing…" : "Print"}
              </Button>
            </>
          }
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">
            {normalizeApiError(error).message}
          </div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Receipt}
            title="Loading invoices"
            description="Syncing customers, balances, and payment status…"
            columns={["Invoice", "Date", "Customer", "Status", "Balance"]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={invoices}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(invoice) => invoice.invoiceId}
            rowLabel={(invoice) => invoice.invoiceNumber}
            columnLayout={columnVisibility}
            minWidth={1500}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={openView}
            onRowDoubleClick={openEditForm}
            renderSelectCellActions={(invoice) => (
              <DirectoryTableRowActions
                row={invoice}
                onEdit={openEditForm}
                onDelete={openDeleteInvoice}
                deleteDisabled={isDeleting}
              />
            )}
            emptyState={
              <p className="text-muted-foreground">No invoices match your search or filters.</p>
            }
          />
        )}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isFetching
                ? "Refreshing invoices…"
                : `Showing ${invoices.length} of ${totalInvoices} invoices`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <InvoiceStagingDialog
        open={stagingOpen}
        onOpenChange={setStagingOpen}
        invoices={selectedInvoices}
      />

      <InvoiceViewSheet
        invoice={viewInvoice}
        open={Boolean(viewInvoiceId)}
        onOpenChange={(open) => {
          if (!open) closeView();
        }}
        onEdit={(invoice) => openEditForm(invoice)}
        onDelete={(invoice) => openDeleteInvoice(invoice)}
        onAddComment={addInvoiceComment}
        onRecordPayment={recordInvoicePayment}
      />

      <Dialog
        open={addFormOpen}
        onOpenChange={(open) => {
          if (!open) setAddFormOpen(false);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Add invoice</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <InvoiceCreateWizard onCancel={() => setAddFormOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) setEditInvoiceId(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingInvoice
                ? `Edit invoice ${formatInvoiceTabLabel(editingInvoice)}`
                : "Edit invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {editInvoiceId ? (
              <InvoiceEditWizard
                invoiceId={editInvoiceId}
                onCancel={() => setEditInvoiceId(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete invoice{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected invoices. This action cannot be undone.`
                : `This will permanently remove invoice ${deleteTarget?.invoiceNumber ?? ""}. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
