"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  DollarSign,
  FileText,
  Filter,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Tags,
  Trash2,
} from "lucide-react";

import { InvoiceStagingDialog } from "@/components/invoices/invoice-staging-dialog";
import { InvoiceCreateWizard, InvoiceEditWizard } from "@/components/invoices/invoice-form-workspace";
import { InvoiceViewSheet } from "@/components/invoices/invoice-view-sheet";
import { NewInvoicesStatCard } from "@/components/invoices/new-invoices-stat-card";
import { DataTable } from "@/components/app-shell/data-table";
import { FlippableStatCard } from "@/components/app-shell/flippable-stat-card";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { LegacyLastSynced } from "@/components/app-shell/legacy-last-synced";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsCarousel } from "@/components/app-shell/stat-cards-carousel";

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
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  computeInvoiceKpis,
  formatInvoiceDate,
  formatInvoiceMoney,
  formatInvoicePartyAddressLine,
  formatInvoiceTabLabel,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoiceBalanceMoneyClass,
  getInvoiceDiscountMoneyClass,
  getInvoicePaidMoneyClass,
  getInvoicePaidStatusBadgeClass,
  getInvoicePaidStatusLabel,
  getInvoicePartyDisplayPhone,
  getInvoiceSubtotal,
  getInvoiceTotalMoneyClass,
  getPaymentLocationLabel,
  formatInvoicePickupAssignmentLabel,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import {
  buildInvoiceCommentActivity,
  buildPaymentRecordedActivity,
} from "@/lib/invoices/activity";
import {
  useDeleteInvoices,
  useInvoice,
  useInvoiceJournals,
  useInvoiceStats,
  useInvoices,
  usePreviewLegacyInvoiceSync,
  useSyncLegacyInvoices,
} from "@/lib/invoices/hooks/use-invoices";
import { usePrintInvoices } from "@/lib/invoices/hooks/use-print-invoices";
import { useRoutePicker } from "@/lib/route-manager/hooks/use-route-manager";
import { formatRouteCopyLabel } from "@/lib/route-manager/display";
import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { useInvoiceFilterFields } from "@/lib/invoices/hooks/use-invoice-filter-fields";
import { buildOrderCreatedByFilterOptions } from "@/lib/orders/display";
import { useUsers } from "@/lib/users/hooks/use-users";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { encodeStagingInvoiceIds } from "@/lib/invoices/staging";
import { mapInvoiceJournalsToPayments } from "@/lib/invoices/invoice-journals";
import {
  buildInvoiceListParams,
  createInvoiceComment,
  createInvoicePayment,
  computeTotalPayments,
  DEFAULT_INVOICE_LIST_PARAMS,
  getInvoiceRecordId,
  getInvoicePrimaryReceiver,
  type Invoice,
  type InvoiceFilterState,
  type InvoicePaymentInput,
} from "@/lib/invoices/types";
import { useLegacyLastSynced } from "@/lib/legacy-sync/use-legacy-last-synced";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import { useSyncWorkspaceTabTitle } from "@/lib/layout/hooks/use-sync-workspace-tab-title";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { getBranchBadgeClass } from "@/lib/vehicles/display";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { OrderParty } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const LEGACY_SYNC_PERMISSION_ERROR_NAMES = ["canSyncLegacyInvoices"] as const;
const LEGACY_SYNC_FALLBACK_TOTAL = 1;
const LEGACY_INVOICE_SYNC_BATCH_SIZE = 100;
const invoiceWizardDialogClassName =
  "left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden overflow-x-hidden rounded-none border-0 p-0 max-sm:[&>button:last-child]:hidden sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border";

function LegacyInvoiceSyncLoader({
  current,
  total,
  title,
  description,
}: {
  current: number;
  total: number;
  title: string;
  description: string;
}) {
  return (
    <div
      className="relative overflow-hidden border-y bg-gradient-to-b from-primary/[0.06] via-background to-background px-6 py-8"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 grid h-16 w-16 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <RefreshCw
            className="absolute inset-0 h-16 w-16 animate-spin text-primary drop-shadow-sm"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div className="relative grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-card shadow-lg shadow-primary/10">
            <Receipt className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
        </div>

        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, (current / total) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function isLegacySyncPermissionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return LEGACY_SYNC_PERMISSION_ERROR_NAMES.some((name) =>
    normalized.includes(name.toLowerCase()),
  );
}

function InvoicePartyAddressCell({ party }: { party: OrderParty | null | undefined }) {
  const { t } = useTranslation();
  const addressLine = formatInvoicePartyAddressLine(party);
  const displayLine = addressLine === "—" ? t("common.empty.dash") : addressLine;

  return (
    <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME)}>
      <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")} title={displayLine}>
        {displayLine}
      </p>
    </div>
  );
}

function getInvoiceMobileInitials(invoice: Invoice): string {
  const name =
    invoice.sender?.name?.trim() ||
    getInvoicePrimaryReceiver(invoice)?.name?.trim() ||
    invoice.invoiceNumber;
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "IN";
}

function getInvoiceMobilePartyName(invoice: Invoice, emptyLabel: string): string {
  return invoice.sender?.name?.trim() || getInvoicePrimaryReceiver(invoice)?.name?.trim() || emptyLabel;
}

function getInvoiceMobilePhone(invoice: Invoice, emptyLabel: string): string {
  const senderPhone = getInvoicePartyDisplayPhone(invoice.sender);
  if (senderPhone !== "—") return senderPhone;

  const phone = invoice.sender.phones.find((entry) => entry.number?.trim());
  return phone?.number?.trim() || emptyLabel;
}

function getInvoiceMobileAddress(invoice: Invoice, emptyLabel: string): string {
  const addressLine = formatInvoicePartyAddressLine(invoice.sender);
  return addressLine === "—" ? emptyLabel : addressLine;
}

function formatInvoiceMonth(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function groupInvoicesByMonth(invoices: Invoice[]): Array<{ month: string; invoices: Invoice[] }> {
  const groups: Array<{ month: string; invoices: Invoice[] }> = [];
  const groupIndexByMonth = new Map<string, number>();
  const sortedInvoices = [...invoices].sort((left, right) => {
    const leftTime = new Date(`${left.date}T12:00:00`).getTime();
    const rightTime = new Date(`${right.date}T12:00:00`).getTime();

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.invoiceNumber.localeCompare(left.invoiceNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  for (const invoice of sortedInvoices) {
    const month = formatInvoiceMonth(invoice.date);
    const existingIndex = groupIndexByMonth.get(month);

    if (existingIndex === undefined) {
      groupIndexByMonth.set(month, groups.length);
      groups.push({ month, invoices: [invoice] });
      continue;
    }

    groups[existingIndex]?.invoices.push(invoice);
  }

  return groups;
}

function getInvoiceMobileAvatarClass(invoice: Invoice): string {
  const avatarClasses = [
    "bg-blue-500 text-white",
    "bg-fuchsia-500 text-white",
    "bg-violet-500 text-white",
    "bg-cyan-600 text-white",
    "bg-emerald-600 text-white",
  ];
  const seed = Array.from(invoice.invoiceId || invoice.invoiceNumber).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return avatarClasses[seed % avatarClasses.length] ?? avatarClasses[0];
}

function MobileInvoiceRow({
  invoice,
  onOpen,
  selected,
  selectionMode,
  onToggleSelected,
}: {
  invoice: Invoice;
  onOpen: (invoice: Invoice) => void;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelected: (invoiceId: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const status = resolveInvoicePaidStatus(invoice);
  const balance = getInvoiceBalance(invoice);
  const emptyLabel = t("common.empty.dash");
  const isClosed = status === "closed";
  const invoiceId = invoice.invoiceId;

  return (
    <div
      className={cn(
        "grid w-full items-start gap-3 border-b border-border/70 px-1 py-4 text-left transition-colors active:bg-muted/50 last:border-b-0",
        "grid-cols-[2.25rem_3.75rem_minmax(0,1fr)_auto]",
        selected && "bg-primary/5",
      )}
    >
      <button
        type="button"
        className={cn(
          "mt-1 flex size-7 items-center justify-center rounded-full border text-primary",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
        onClick={() => onToggleSelected(invoiceId, !selected)}
        aria-label={selected ? "Deselect invoice" : "Select invoice"}
      >
        {selected ? <Check className="size-4" /> : null}
      </button>
      <button
        type="button"
        className={cn(
          "text-left",
          "flex size-12 items-center justify-center rounded-full text-sm font-semibold shadow-xs",
          getInvoiceMobileAvatarClass(invoice),
        )}
        onClick={() => {
          if (selectionMode) {
            onToggleSelected(invoiceId, !selected);
            return;
          }
          onOpen(invoice);
        }}
      >
        {getInvoiceMobileInitials(invoice)}
      </button>
      <button
        type="button"
        className="min-w-0 text-left"
        onClick={() => {
          if (selectionMode) {
            onToggleSelected(invoiceId, !selected);
            return;
          }
          onOpen(invoice);
        }}
      >
        <span className="block truncate text-lg font-bold leading-tight text-foreground">
          {invoice.invoiceNumber || emptyLabel}
        </span>
        <span className="mt-1 block truncate text-base font-medium uppercase leading-tight text-foreground/80">
          {getInvoiceMobilePartyName(invoice, emptyLabel)}
        </span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">
          {formatInvoiceDate(invoice.date)}
        </span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">
          {getInvoiceMobilePhone(invoice, emptyLabel)}
        </span>
        <span className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
          {getInvoiceMobileAddress(invoice, emptyLabel)}
        </span>
      </button>
      <button
        type="button"
        className="flex flex-col items-end gap-2 pt-1 text-right"
        onClick={() => {
          if (selectionMode) {
            onToggleSelected(invoiceId, !selected);
            return;
          }
          onOpen(invoice);
        }}
      >
        <span
          className={cn(
            "text-lg font-bold leading-none",
            isClosed ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {formatInvoiceMoney(balance)}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            isClosed ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {getInvoicePaidStatusLabel(status)}
        </span>
      </button>
    </div>
  );
}

const defaultFilters: InvoiceFilterState = {
  query: "",
  rows: [],
  paymentLocation: "all",
};

export function InvoicesWorkspace() {
  const { t } = useTranslation();
  const invoiceFilterFields = useInvoiceFilterFields();
  const { notifyAdded, notifyDeleted, notifyError, notifySuccess } = useFeedback();
  const { hasPermission } = useAuth();
  const canSyncLegacyInvoices = hasPermission(
    PERMISSIONS.invoicesSyncLegacy.name,
    PERMISSIONS.invoicesSyncLegacy.resourceType,
  );
  const [filters, setFilters] = useState<InvoiceFilterState>(defaultFilters);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_INVOICE_LIST_PARAMS.sort, () => setPage(1));
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewOverlay, setViewOverlay] = useState<Partial<Invoice> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | Invoice[] | null>(null);
  const [stagingOpen, setStagingOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [legacySyncStageIndex, setLegacySyncStageIndex] = useState<number | null>(null);
  const [legacySyncTotal, setLegacySyncTotal] = useState<number | null>(null);
  const legacySyncResetTimerRef = useRef<number | null>(null);

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
        limit: pageLimit,
        query: deferredQuery,
        rows: filters.rows,
        paymentLocation: filters.paymentLocation,
        sort,
      }),
    [deferredQuery, filters.paymentLocation, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useInvoices(listParams);
  const invoiceStats = useInvoiceStats();
  const { data: usersData, isLoading: usersLoading } = useUsers({
    page: 1,
    limit: 100,
    sort: "name:asc",
  });
  const deleteInvoicesMutation = useDeleteInvoices();
  const previewLegacyInvoiceSyncMutation = usePreviewLegacyInvoiceSync();
  const syncLegacyInvoicesMutation = useSyncLegacyInvoices();
  const { printInvoiceIds, isPrinting } = usePrintInvoices();
  const { data: routesData } = useRoutePicker(undefined, {
    enabled: desktopFiltersOpen || mobileFiltersOpen,
  });
  const { data: detailInvoice } = useInvoice(viewInvoiceId, Boolean(viewInvoiceId));
  const invoices = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const viewedInvoiceNumber =
    detailInvoice?.invoiceNumber ??
    invoices.find((invoice) => invoice.invoiceId === viewInvoiceId)?.invoiceNumber;
  const { data: invoiceJournals } = useInvoiceJournals(
    viewInvoiceId,
    viewedInvoiceNumber,
    Boolean(viewInvoiceId),
  );
  const legacyTimestamps = useMemo(
    () => invoices.map((invoice) => invoice.legacySyncedAt),
    [invoices],
  );
  const { lastSyncedAt, markSynced } = useLegacyLastSynced("invoices", {
    enabled: canSyncLegacyInvoices,
    timestamps: legacyTimestamps,
  });
  const totalInvoices = data?.total ?? 0;
  rememberTotal(totalInvoices);
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    invoices.length > 0 && invoices.every((invoice) => selectedIds.includes(invoice.invoiceId));
  const isDeleting = deleteInvoicesMutation.isPending;
  const isLegacySyncing =
    previewLegacyInvoiceSyncMutation.isPending ||
    syncLegacyInvoicesMutation.isPending ||
    legacySyncStageIndex !== null;
  const isSaving = isDeleting || isPrinting || isLegacySyncing;

  useTableSelectionReset(
    buildTableSelectionResetKey(deferredQuery, filters.rows, filters.paymentLocation),
    setSelectedIds,
  );

  useEffect(() => {
    if (!syncLegacyInvoicesMutation.isPending) return;

    const timer = window.setInterval(() => {
      setLegacySyncStageIndex((current) => {
        const total = Math.max(LEGACY_SYNC_FALLBACK_TOTAL, legacySyncTotal ?? LEGACY_SYNC_FALLBACK_TOTAL);
        const maxIndex = Math.max(0, total - 1);
        const next = current == null ? 0 : current + 1;
        return Math.min(next, maxIndex);
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [legacySyncTotal, syncLegacyInvoicesMutation.isPending]);

  useEffect(() => {
    return () => {
      if (legacySyncResetTimerRef.current != null) {
        window.clearTimeout(legacySyncResetTimerRef.current);
      }
    };
  }, []);

  const viewInvoice = useMemo(() => {
    if (!viewInvoiceId) return null;
    const base =
      detailInvoice ?? invoices.find((invoice) => invoice.invoiceId === viewInvoiceId) ?? null;
    if (!base) return null;

    const journalPayments = mapInvoiceJournalsToPayments(invoiceJournals ?? [], base.invoiceId);

    if (!viewOverlay && journalPayments.length === 0) return base;

    return {
      ...base,
      comments: [...base.comments, ...(viewOverlay?.comments ?? [])],
      activity: [...base.activity, ...(viewOverlay?.activity ?? [])],
      payments: [...(journalPayments.length > 0 ? journalPayments : base.payments), ...(viewOverlay?.payments ?? [])],
      amountPaid: viewOverlay?.amountPaid ?? base.amountPaid,
      updatedAt: viewOverlay?.updatedAt ?? base.updatedAt,
    };
  }, [detailInvoice, invoices, invoiceJournals, viewInvoiceId, viewOverlay]);

  useSyncWorkspaceTabTitle(
    viewInvoice ? `Invoice #${viewInvoice.invoiceNumber}` : null,
    "Invoices",
  );

  const kpis = useMemo(() => computeInvoiceKpis(invoices), [invoices]);

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)),
    [invoices, selectedIds],
  );
  const selectedCount = selectedInvoices.length;
  const mobileInvoiceGroups = useMemo(() => groupInvoicesByMonth(invoices), [invoices]);

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

  async function handleSyncLegacyInvoices() {
    if (legacySyncResetTimerRef.current != null) {
      window.clearTimeout(legacySyncResetTimerRef.current);
      legacySyncResetTimerRef.current = null;
    }

    setLegacySyncStageIndex(0);
    setLegacySyncTotal(null);
    try {
      let total = LEGACY_SYNC_FALLBACK_TOTAL;
      try {
        const preview = await previewLegacyInvoiceSyncMutation.mutateAsync();
        total = Math.max(0, preview.total);
        setLegacySyncTotal(total);
      } catch {
        setLegacySyncTotal(LEGACY_SYNC_FALLBACK_TOTAL);
      }

      let start = 0;
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let message = t("invoices.actions.syncingLegacy");
      let syncedAt: string | undefined;

      do {
        setLegacySyncStageIndex(start);
        const result = await syncLegacyInvoicesMutation.mutateAsync({
          start,
          limit: LEGACY_INVOICE_SYNC_BATCH_SIZE,
        });
        const summary = result.summary;
        imported += summary.imported;
        updated += summary.updated;
        skipped += summary.skipped;
        total = Math.max(total, summary.total);
        message = result.message;
        syncedAt = summary.lastSyncedAt ?? syncedAt;
        start = summary.nextStart > start ? summary.nextStart : start + summary.processed;

        setLegacySyncTotal(total);
        setLegacySyncStageIndex(Math.max(0, Math.min(start, total || start) - 1));
        if (summary.processed === 0) break;
      } while (start < total);

      markSynced(syncedAt);
      notifySuccess(
        total === 0 || imported + updated === 0
          ? message
          : `${message}: ${imported} imported, ${updated} updated, ${skipped} skipped.`,
      );
      setPage(1);
    } catch (mutationError) {
      const message = normalizeApiError(mutationError).message;
      notifyError(
        isLegacySyncPermissionError(message)
          ? t("invoices.errors.legacySyncPermissionMissing")
          : message,
      );
      setLegacySyncStageIndex(null);
      setLegacySyncTotal(null);
      return;
    }

    legacySyncResetTimerRef.current = window.setTimeout(() => {
      setLegacySyncStageIndex(null);
      setLegacySyncTotal(null);
      legacySyncResetTimerRef.current = null;
    }, 700);
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
        { label: "Page size", value: pageLimit.toString() },
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

  const tableColumns: DataTableColumn<Invoice>[] = useMemo(
    () => [
    {
      id: "invoiceNumber",
      label: t("invoices.columns.invoiceNumber"),
      sortField: "number",
      cellClassName: "font-medium",
      renderCell: (invoice) => invoice.invoiceNumber,
    },
    {
      id: "date",
      label: t("invoices.columns.date"),
      renderCell: (invoice) => formatInvoiceDate(invoice.date),
    },
    {
      id: "container",
      label: t("invoices.columns.container"),
      sortField: "container.name",
      renderCell: (invoice) => getContainerLabelForInvoice(invoice),
    },
    {
      id: "paidStatus",
      label: t("invoices.columns.paidStatus"),
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
      label: t("invoices.columns.paymentLocation"),
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
      id: "sender.name",
      label: t("invoices.columns.senderName"),
      sortField: "sender.name",
      renderCell: (invoice) => invoice.sender.name.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.address",
      label: t("invoices.columns.senderAddress"),
      sortField: "sender.address.address1",
      defaultWidth: 220,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (invoice) => <InvoicePartyAddressCell party={invoice.sender} />,
    },
    {
      id: "receiver.name",
      label: t("invoices.columns.receiverName"),
      sortField: "receiver.name",
      renderCell: (invoice) => {
        const receiver = getInvoicePrimaryReceiver(invoice);
        return receiver?.name?.trim() || t("common.empty.dash");
      },
    },
    {
      id: "receiver.address",
      label: t("invoices.columns.receiverAddress"),
      sortField: "receiver.address.address1",
      defaultWidth: 220,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (invoice) => (
        <InvoicePartyAddressCell party={getInvoicePrimaryReceiver(invoice)} />
      ),
    },
    {
      id: "total",
      label: t("invoices.columns.total"),
      sortField: "cost",
      truncateCell: false,
      renderCell: (invoice) => {
        const amount = getInvoiceSubtotal(invoice);
        return <span className={getInvoiceTotalMoneyClass()}>{formatInvoiceMoney(amount)}</span>;
      },
    },
    {
      id: "discount",
      label: t("invoices.columns.discount"),
      truncateCell: false,
      renderCell: (invoice) => (
        <span className={getInvoiceDiscountMoneyClass(invoice.discount)}>
          {formatInvoiceMoney(invoice.discount)}
        </span>
      ),
    },
    {
      id: "amountPaid",
      label: t("invoices.columns.amountPaid"),
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
      label: t("invoices.columns.balance"),
      truncateCell: false,
      renderCell: (invoice) => {
        const amount = getInvoiceBalance(invoice);
        return <span className={getInvoiceBalanceMoneyClass(amount)}>{formatInvoiceMoney(amount)}</span>;
      },
    },
    {
      id: "pickupAssignment",
      label: t("invoices.columns.pickupAssignment"),
      renderCell: (invoice) =>
        formatInvoicePickupAssignmentLabel(invoice, t, t("common.empty.dash")),
    },
    {
      id: "createdBy",
      label: t("invoices.columns.createdBy"),
      sortField: "createdBy.name",
      cellClassName: "text-muted-foreground",
      renderCell: (invoice) => invoice.createdBy.trim() || t("common.empty.dash"),
    },
    {
      id: "createdAt",
      label: t("invoices.columns.createdAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (invoice) =>
        invoice.createdAt ? formatAuditDateTime(invoice.createdAt) : t("common.empty.dash"),
    },
  ],
    [t],
  );

  const columnVisibility = useColumnVisibility("invoices-v7", tableColumns);
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
  const legacySyncCurrentStep = Math.max(1, (legacySyncStageIndex ?? 0) + 1);
  const legacySyncDisplayTotal = Math.max(
    LEGACY_SYNC_FALLBACK_TOTAL,
    legacySyncTotal ?? LEGACY_SYNC_FALLBACK_TOTAL,
  );
  const legacySyncDescriptions = [
    t("invoices.loading.legacySyncStages.connecting"),
    t("invoices.loading.legacySyncStages.dependencies"),
    t("invoices.loading.legacySyncStages.invoices"),
    t("invoices.loading.legacySyncStages.refreshing"),
  ];
  const legacySyncLoader = (
    <LegacyInvoiceSyncLoader
      current={legacySyncCurrentStep}
      total={legacySyncDisplayTotal}
      title={t("invoices.loading.legacySyncProgress", {
        current: legacySyncCurrentStep,
        total: legacySyncTotal ?? legacySyncDisplayTotal,
      })}
      description={
        legacySyncDescriptions[
          Math.min(legacySyncDescriptions.length - 1, Math.max(0, legacySyncCurrentStep - 1))
        ] ?? legacySyncDescriptions[0]
      }
    />
  );

  return (
    <div>
      <div className="[&>div>div>p]:max-md:hidden">
        <PageHeader
          title={t("invoices.title")}
          description={t("invoices.pages.description")}
          actions={
            <div className="flex items-center gap-2">
              {canSyncLegacyInvoices ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSyncLegacyInvoices}
                  disabled={isSaving}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isLegacySyncing && "animate-spin")}
                  />
                  {isLegacySyncing
                    ? t("invoices.actions.syncingLegacy")
                    : t("invoices.actions.syncLegacy")}
                </Button>
              ) : null}
              <Button onClick={openAddForm} disabled={isSaving}>
                <Plus className="h-4 w-4" />
                Add invoice
              </Button>
            </div>
          }
        />
      </div>

      <section className="space-y-5 md:hidden">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/80" />
            <input
              value={filters.query}
              onChange={(event) => {
                setFilters((current) => ({ ...current, query: event.target.value }));
                setPage(1);
              }}
              className="h-12 w-full rounded-xl border border-border/70 bg-card pl-12 pr-4 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder={t("invoices.search.placeholder")}
              aria-label="Search invoice"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "size-12 shrink-0 rounded-xl border-primary/30 text-primary shadow-xs",
              mobileFiltersOpen || activeFilterCount > 0 ? "bg-primary/10" : "bg-background",
            )}
            onClick={() => setMobileFiltersOpen((open) => !open)}
            aria-label="Filter invoices"
          >
            <Filter className="size-5" />
          </Button>
          {canSyncLegacyInvoices ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 shrink-0 rounded-xl border-primary/30 text-primary shadow-xs"
              onClick={handleSyncLegacyInvoices}
              disabled={isSaving}
              aria-label={t("invoices.actions.syncLegacy")}
              title={t("invoices.actions.syncLegacy")}
            >
              <RefreshCw className={cn("size-5", isLegacySyncing && "animate-spin")} />
            </Button>
          ) : null}
        </div>

        {mobileFiltersOpen ? (
          <TableFilterPanel
            resultSummary={`Showing ${invoices.length} of ${totalInvoices} invoices`}
            className="rounded-xl shadow-sm"
            presets={{
              storageKey: "invoices",
              rows: filters.rows,
              fields: invoiceFilterFields,
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
              open={mobileFiltersOpen}
              rows={filters.rows}
              fields={invoiceFilterFields}
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
        ) : null}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/15 bg-primary/10 px-4 py-4 text-primary shadow-xs">
          <span className="text-base font-semibold">Outstanding receivables</span>
          <span className="shrink-0 text-xl font-bold">
            {isLoading ? "…" : formatInvoiceMoney(kpis.outstanding)}
          </span>
        </div>

        {!isLoading && !isError ? (
          <TablePaginationControls
            layout="mobile"
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
        ) : null}

        {!isLoading && !isError && invoices.length > 0 && selectedCount > 0 ? (
          <div className="rounded-xl border bg-card px-3 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">
                {selectedCount} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={printSelectedInvoices}
                  disabled={isPrinting}
                >
                  <Printer className="size-4" />
                  {isPrinting ? "Preparing..." : "Print"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl bg-background">
          {isError ? (
            <div className="px-4 py-8 text-sm text-destructive">
              {normalizeApiError(error).message}
            </div>
          ) : isLegacySyncing ? (
            legacySyncLoader
          ) : isLoading ? (
            <div className="space-y-4 px-1 py-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[4rem_minmax(0,1fr)_4.5rem] items-center gap-3 border-b border-border/70 pb-4 last:border-b-0"
                >
                  <div className="size-14 rounded-xl bg-muted" />
                  <div className="space-y-2">
                    <div className="h-5 w-36 rounded bg-muted" />
                    <div className="h-4 w-44 rounded bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <div className="ml-auto h-5 w-16 rounded bg-muted" />
                    <div className="ml-auto h-4 w-12 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No invoices match your search or filters.
            </p>
          ) : (
            <div className="space-y-2">
              {mobileInvoiceGroups.map((group, groupIndex) => (
                <section
                  key={group.month}
                  aria-label={group.month}
                  className="border-b border-border pb-2 last:border-b-0 last:pb-0"
                >
                  <h2
                    className={cn(
                      "px-1 pb-1 text-lg font-semibold text-muted-foreground",
                      groupIndex === 0 ? "pt-0" : "pt-4",
                    )}
                  >
                    {group.month}
                  </h2>
                  <div>
                    {group.invoices.map((invoice) => (
                      <MobileInvoiceRow
                        key={invoice.invoiceId}
                        invoice={invoice}
                        onOpen={openView}
                        selected={selectedIds.includes(invoice.invoiceId)}
                        selectionMode={selectedCount > 0}
                        onToggleSelected={toggleSelect}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        {canSyncLegacyInvoices ? (
          <div className="px-1">
            <LegacyLastSynced at={lastSyncedAt} />
          </div>
        ) : null}
      </section>

      <div className="hidden md:block">
      <StatCardsCarousel mobileLayout="stack">
        {stats.map((stat) => (
          <FlippableStatCard key={stat.label} {...stat} />
        ))}
        <NewInvoicesStatCard />
      </StatCardsCarousel>

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={desktopFiltersOpen}
            onFiltersOpenChange={setDesktopFiltersOpen}
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
                placeholder={t("invoices.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${invoices.length} of ${totalInvoices} invoices`}
                presets={{
                  storageKey: "invoices",
                  rows: filters.rows,
                  fields: invoiceFilterFields,
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
                  open={desktopFiltersOpen}
                  rows={filters.rows}
                  fields={invoiceFilterFields}
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
          onView={() => {
            const invoice = selectedInvoices[0];
            if (invoice) openView(invoice);
          }}
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
        ) : isLegacySyncing ? (
          legacySyncLoader
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
            activeRowId={viewInvoiceId ?? undefined}
            emptyState={
              <p className="text-muted-foreground">No invoices match your search or filters.</p>
            }
          />
        )}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {isFetching
                  ? "Refreshing invoices…"
                  : `Showing ${invoices.length} of ${totalInvoices} invoices`}
              </p>
              {canSyncLegacyInvoices ? <LegacyLastSynced at={lastSyncedAt} /> : null}
            </div>
            <TablePaginationControls
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
              disabled={isLoading}
            />
          </div>
        ) : null}
      </Card>
      </div>

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
        <DialogContent className={invoiceWizardDialogClassName}>
          <DialogHeader className="hidden shrink-0 border-b border-border px-5 py-4 sm:block sm:px-6">
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
        <DialogContent className={invoiceWizardDialogClassName}>
          <DialogHeader className="hidden shrink-0 border-b border-border px-5 py-4 sm:block sm:px-6">
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
            <ConfirmDeleteButton isPending={isDeleting} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
