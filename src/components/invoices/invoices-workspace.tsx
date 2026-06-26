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
  Trash2,
} from "lucide-react";

import { InvoiceViewSheet } from "@/components/invoices/invoice-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeApiError } from "@/lib/api/axios";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranches } from "@/lib/branches/hooks/use-branches";
import {
  computeInvoiceKpis,
  formatInvoiceDate,
  formatInvoiceMoney,
  formatInvoicePartySummary,
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
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { buildOrderCreatedByFilterOptions } from "@/lib/orders/display";
import { useUsers } from "@/lib/users/hooks/use-users";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import {
  INVOICE_PAYMENT_LOCATIONS,
  buildInvoiceListParams,
  createInvoiceComment,
  createInvoicePayment,
  computeTotalPayments,
  DEFAULT_INVOICE_LIST_PARAMS,
  type Invoice,
  type InvoiceFilterState,
  type InvoicePaymentInput,
} from "@/lib/invoices/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import { getBranchBadgeClass } from "@/lib/vehicles/display";

const PAGE_SIZE = DEFAULT_INVOICE_LIST_PARAMS.limit;

const defaultFilters: InvoiceFilterState = {
  query: "",
  rows: [],
  paymentLocation: "all",
};

export function InvoicesWorkspace() {
  const { notifyAdded, notifyDeleted, notifyError, notifySuccess } = useFeedback();
  const [filters, setFilters] = useState<InvoiceFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_INVOICE_LIST_PARAMS.sort, () => setPage(1));
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewOverlay, setViewOverlay] = useState<Partial<Invoice> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | Invoice[] | null>(null);

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
    sort: "fullName:asc",
  });
  const { data: branchesData, isLoading: branchesLoading } = useBranches({
    page: 1,
    limit: 100,
    sort: "name:asc",
  });
  const deleteInvoicesMutation = useDeleteInvoices();
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

  const kpis = useMemo(() => computeInvoiceKpis(invoices), [invoices]);

  const userFilterOptions = useMemo(
    () => buildOrderCreatedByFilterOptions(usersData?.items ?? []),
    [usersData?.items],
  );

  const branchFilterOptions = useMemo(() => {
    return (branchesData?.items ?? []).map((branch) => ({
      value: String(branch.id),
      label: formatBranchFilterLabel(branch),
    }));
  }, [branchesData?.items]);

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

  // TODO: implement print for selected invoices.
  function handleComingSoon(label: string) {
    notifySuccess(`${label} is coming soon.`);
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

  const stats = [
    {
      label: "Total invoices",
      value: isLoading ? "…" : totalInvoices.toString(),
      description: "Invoices on record",
      icon: FileText,
    },
    {
      label: "Outstanding invoices",
      value: invoiceStats.isLoading ? "…" : invoiceStats.outstanding.toString(),
      description: "Invoices with open balance",
      icon: CircleAlert,
    },
    {
      label: "Outstanding",
      value: isLoading ? "…" : formatInvoiceMoney(kpis.outstanding),
      description: "Balance on this page",
      icon: Receipt,
    },
    {
      label: "Collected",
      value: isLoading ? "…" : formatInvoiceMoney(kpis.collected),
      description: "Paid on this page",
      icon: DollarSign,
    },
  ];

  const paymentFilters: { value: InvoiceFilterState["paymentLocation"]; label: string }[] = [
    { value: "all", label: "All" },
    ...INVOICE_PAYMENT_LOCATIONS,
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
  const activeFilterCount = advancedFilterCount + (filters.paymentLocation !== "all" ? 1 : 0);
  const hasActiveFilters =
    Boolean(filters.query.trim()) || advancedFilterCount > 0 || filters.paymentLocation !== "all";
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
          <Button disabled title="Invoice create via API is not available yet.">
            <Plus className="h-4 w-4" />
            Add invoice
          </Button>
        }
      />

      <StatCardsGrid>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </StatCardsGrid>

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
                    branches: branchesLoading ? [] : branchFilterOptions,
                  }}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
                <TableFilterSection label="Paid at">
                  {paymentFilters.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={filters.paymentLocation === option.value ? "default" : "outline"}
                      onClick={() => {
                        setFilters((current) => ({ ...current, paymentLocation: option.value }));
                        setPage(1);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={invoices.map((invoice) => invoice.invoiceId)}
          onSelectedIdsChange={setSelectedIds}
          onDelete={() =>
            setDeleteTarget(invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)))
          }
          deleteDisabled={isDeleting}
          actions={
            <Button variant="outline" size="sm" onClick={() => handleComingSoon("Print")}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
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

      <InvoiceViewSheet
        invoice={viewInvoice}
        open={Boolean(viewInvoiceId)}
        onOpenChange={(open) => {
          if (!open) closeView();
        }}
        onEdit={() => undefined}
        onDelete={(invoice) => {
          closeView();
          setDeleteTarget(invoice);
        }}
        onAddComment={addInvoiceComment}
        onRecordPayment={recordInvoicePayment}
      />

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
