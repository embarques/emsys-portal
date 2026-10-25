"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlert,
  Ellipsis,
  FileText,
  Plus,
  Printer,
  Receipt,
  SlidersHorizontal,
  RefreshCw,
  Search,
  Tags,
} from "lucide-react";

import { InvoiceCreateWizard, InvoiceEditWizard } from "@/components/invoices/invoice-form-workspace";
import { InvoiceDocumentsButton } from "@/components/invoices/invoice-documents-button";
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
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { INVOICE_API_TABLE_FIELDS } from "@/lib/invoices/table-fields";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatInvoiceCount,
  formatInvoiceMoney,
  formatInvoiceItemCount,
  formatInvoicePartyAddressLines,
  formatInvoiceTabLabel,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoiceBalanceMoneyClass,
  getInvoiceDiscountMoneyClass,
  getInvoicePaidMoneyClass,
  getInvoicePaidStatusBadgeClass,
  getInvoiceSubtotal,
  getInvoiceTotalMoneyClass,
  getPaymentLocationLabel,
  formatInvoicePickupAssignmentLabel,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import { buildInvoiceCommentActivity } from "@/lib/invoices/activity";
import {
  useDeleteInvoices,
  useInvoice,
  useInvoiceJournals,
  useInvoiceStats,
  useInvoices,
  usePreviewLegacyInvoiceSync,
  useSyncLegacyInvoices,
} from "@/lib/invoices/hooks/use-invoices";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
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
import { buildInvoiceBarcodesHref } from "@/lib/barcodes/invoice-search";
import { mapInvoiceJournalsToPayments } from "@/lib/invoices/invoice-journals";
import {
  buildInvoiceListParams,
  createInvoiceComment,
  DEFAULT_INVOICE_LIST_PARAMS,
  getInvoiceRecordId,
  getInvoicePrimaryReceiver,
  type Invoice,
  type InvoiceFilterState,
} from "@/lib/invoices/types";
import { useLegacyLastSynced } from "@/lib/legacy-sync/use-legacy-last-synced";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import { useSyncWorkspaceTabTitle } from "@/lib/layout/hooks/use-sync-workspace-tab-title";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { getBranchBadgeClass } from "@/lib/vehicles/display";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { resolvePhoneDisplayValue } from "@/lib/utils/phone";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { OrderParty } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { useTranslation } from "@/lib/i18n";

import { MobileInvoiceRow } from "@/components/invoices/mobile-invoice-row";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { useMobileInvoices } from "@/lib/invoices/hooks/use-mobile-invoices";
import { mobileInvoiceParams, uniqueMobileInvoices, type MobileInvoiceView } from "@/lib/invoices/mobile-list";

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
  const lines = formatInvoicePartyAddressLines(party);

  return (
    <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME)}>
      {lines.length ? lines.map((line, index) => (
        <p key={index} className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")}>
          {line}
        </p>
      )) : t("common.empty.dash")}
    </div>
  );
}

function InvoicePartyPhoneCell({ party }: { party: OrderParty | null | undefined }) {
  const { t } = useTranslation();
  const phones = (party?.phones ?? []).map((phone) => ({
    ...phone,
    display: resolvePhoneDisplayValue(phone.number, phone.displayNumber),
  })).filter((phone) => phone.display)
    .sort((a, b) => Number(b.isPrimary === true) - Number(a.isPrimary === true));

  return (
    <div className="flex flex-col gap-1 tabular-nums">
      {phones.length ? phones.map((phone, index) => (
        <span key={`${phone.id}-${index}`} className="flex items-center gap-2 whitespace-nowrap leading-snug">
          <span title={phone.label}>{phone.display}</span>
          {phone.isPrimary ? (
            <Badge variant="outline"
              className="border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
              {t("invoices.columns.primaryPhone")}
            </Badge>
          ) : null}
        </span>
      )) : t("common.empty.dash")}
    </div>
  );
}

function formatInvoiceLineItemsSummary(
  invoice: Invoice,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const lineItemCount = invoice.lineItems.length;
  if (lineItemCount === 0) return t("common.empty.dash");

  const labelCount = invoice.lineItems.reduce((total, item) => total + item.labelCount, 0);
  const firstItemName = invoice.lineItems.find((item) => item.itemName.trim())?.itemName.trim();
  const itemLabel = t(
    lineItemCount === 1 ? "invoices.columns.itemSingular" : "invoices.columns.itemPlural",
  );
  const labelLabel = t(
    labelCount === 1 ? "invoices.columns.labelSingular" : "invoices.columns.labelPlural",
  );
  const countSummary = `${lineItemCount} ${itemLabel} · ${labelCount} ${labelLabel}`;

  if (!firstItemName) return countSummary;
  if (lineItemCount === 1) return `${countSummary} · ${firstItemName}`;
  return `${countSummary} · ${firstItemName} +${lineItemCount - 1}`;
}

function hasPendingRegistration(invoice: Invoice): boolean {
  return String(invoice.apiTableValues?.registration ?? "").trim().toUpperCase() === "PENDING";
}

function getInvoiceTableStatusLabel(
  invoice: Invoice,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const status = resolveInvoicePaidStatus(invoice);
  return t(status === "closed" ? "invoices.columns.statusClosed" : "invoices.columns.statusOpen");
}

function getInvoicePendingLabel(
  invoice: Invoice,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return getInvoiceBalance(invoice) <= 0
    ? t("invoices.columns.pendingPaid")
    : t("invoices.columns.pendingOpen");
}

function formatInvoiceTableDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
    .format(new Date(`${date}T12:00:00`))
    .replaceAll("/", "-");
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
  for (const invoice of invoices) {
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


const defaultFilters: InvoiceFilterState = {
  query: "",
  rows: [],
  paymentLocation: "all",
};

export function InvoicesWorkspace() {
  const { t } = useTranslation();
  const invoiceFilterFields = useInvoiceFilterFields();
  const { notifyAdded, notifyDeleted, notifyError, notifySuccess } = useFeedback();
  const { hasPermission, companyId } = useAuth();
  const canSyncLegacyInvoices = hasPermission(
    PERMISSIONS.invoicesSyncLegacy.name,
    PERMISSIONS.invoicesSyncLegacy.resourceType,
  );
  const [filters, setFilters] = useState<InvoiceFilterState>(defaultFilters);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isMobileViewport = useIsMobileViewport();
  const [mobileView, setMobileView] = useState<MobileInvoiceView>("all");
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  const continuationRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_INVOICE_LIST_PARAMS.sort, () => setPage(1));
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewDocuments, setViewDocuments] = useState(false);
  const [viewOverlay, setViewOverlay] = useState<Partial<Invoice> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | Invoice[] | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [legacySyncStageIndex, setLegacySyncStageIndex] = useState<number | null>(null);
  const [legacySyncTotal, setLegacySyncTotal] = useState<number | null>(null);
  const legacySyncResetTimerRef = useRef<number | null>(null);

  const { openTab, openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const canViewBarcodes = hasPermission(
    PERMISSIONS.packagesView.name,
    PERMISSIONS.packagesView.resourceType,
  );

  function openManageInvoiceItems() {
    if (selectedInvoices.length === 0) {
      notifyError("Select at least one invoice to manage items.");
      return;
    }

    if (!canViewBarcodes) return;
    openTab(
      buildInvoiceBarcodesHref(selectedInvoices.map((invoice) => invoice.invoiceNumber)),
      undefined,
      { forceNew: true },
    );
  }

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "invoices", baseHref: "/invoices", mode: "add", label: t("invoices.workspace.addInvoice") });
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
        label: formatInvoiceTabLabel(invoice, t("invoices.workspace.untitledTab")),
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

  const desktopQuery = useInvoices(listParams, { enabled: !isMobileViewport });
  const mobileParams = useMemo(() => mobileInvoiceParams(listParams, mobileView), [listParams, mobileView]);
  const mobileQuery = useMobileInvoices(mobileParams, isMobileViewport);
  const mobileItems = useMemo(() => uniqueMobileInvoices(mobileQuery.data?.pages ?? []), [mobileQuery.data]);
  const { isLoading, isError, error, isFetching } = isMobileViewport ? mobileQuery : desktopQuery;
  const data = isMobileViewport ? { items: mobileItems, total: mobileQuery.data?.pages[0]?.total ?? 0 } : desktopQuery.data;
  const { hasNextPage, isFetching: mobileFetching, isFetchNextPageError, fetchNextPage } = mobileQuery;
  useEffect(() => {
    const target = continuationRef.current;
    if (!isMobileViewport || !target || !hasNextPage || mobileFetching || isFetchNextPageError) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void fetchNextPage({ cancelRefetch: false });
    }, { rootMargin: "180px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [isMobileViewport, hasNextPage, mobileFetching, isFetchNextPageError, fetchNextPage]);
  const invoiceStats = useInvoiceStats();
  const { data: usersData, isLoading: usersLoading } = useUsers({
    page: 1,
    limit: 100,
    sort: "name:asc",
  });
  const deleteInvoicesMutation = useDeleteInvoices();
  const previewLegacyInvoiceSyncMutation = usePreviewLegacyInvoiceSync();
  const syncLegacyInvoicesMutation = useSyncLegacyInvoices();
  const [printInvoiceIds, setPrintInvoiceIds] = useState<string[]>([]);
  const isPrinting = printInvoiceIds.length > 0;
  const canPrintInvoices = hasPermission(PERMISSIONS.invoicesPrint.name, PERMISSIONS.invoicesPrint.resourceType);
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
    buildTableSelectionResetKey(deferredQuery, filters.rows, filters.paymentLocation, mobileView, companyId),
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
      payments: journalPayments.length > 0 ? journalPayments : base.payments,
      updatedAt: viewOverlay?.updatedAt ?? base.updatedAt,
    };
  }, [detailInvoice, invoices, invoiceJournals, viewInvoiceId, viewOverlay]);

  useSyncWorkspaceTabTitle(
    viewInvoice ? `Invoice #${viewInvoice.invoiceNumber}` : null,
    "Invoices",
  );


  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)),
    [invoices, selectedIds],
  );
  const selectedCount = selectedInvoices.length;
  const mobileInvoiceGroups = useMemo(() => groupInvoicesByMonth(invoices), [invoices]);

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

  const documentsButton = (
    <InvoiceDocumentsButton
      invoice={selectedInvoices[0]}
      selectedCount={selectedCount}
      onOpenMobile={(invoice) => {
        openView(invoice);
        setViewDocuments(true);
      }}
    />
  );

  function openView(invoice: Invoice) {
    setViewDocuments(false);
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

  async function printSelectedInvoices() {
    const invoiceIds = selectedInvoices.map((invoice) => invoice.invoiceId).filter(Boolean);
    if (canPrintInvoices && invoiceIds.length) setPrintInvoiceIds(invoiceIds);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((invoice) => invoice.invoiceId)
      : [deleteTarget.invoiceId];

    try {
      const result = await deleteInvoicesMutation.mutateAsync(ids);

      reportBulkSettled({
        result,
        t,
        entityLabel: "Invoice",
        notifyDeleted,
        notifyError,
        onAllFailed: (message) => {
          notifyError(message);
        },
        onDone: () => {
          setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
          setDeleteTarget(null);
          closeView();
        },
      });
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
      value: isLoading ? "…" : formatInvoiceCount(totalInvoices),
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
      value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
      description: "Invoices with open balance",
      icon: CircleAlert,
      details: [
        {
          label: "Open invoices",
          value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
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
          value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
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
  ];

  const tableColumns: DataTableColumn<Invoice>[] = useMemo(
    () => [
    {
      id: "invoiceNumber",
      label: t("invoices.columns.invoiceNumber"),
      sortField: "number",
      cellClassName: "font-medium",
      defaultWidth: 130,
      renderCell: (invoice) => (
        <span className={hasPendingRegistration(invoice) ? "text-red-600 dark:text-red-400" : undefined}>
          {hasPendingRegistration(invoice) ? "*" : ""}
          {invoice.invoiceNumber}
        </span>
      ),
    },
    {
      id: "registration",
      label: t("common.apiColumns.registration"),
      defaultVisible: false,
      defaultWidth: 150,
      sortable: false,
      renderCell: (invoice) => {
        const registration = String(invoice.apiTableValues?.registration ?? "").trim();
        switch (registration.toUpperCase()) {
          case "PENDING":
            return t("invoices.registrationStatus.pending");
          case "COMPLETED":
            return t("invoices.registrationStatus.completed");
          default:
            return registration || t("common.empty.dash");
        }
      },
    },
    {
      id: "date",
      label: t("invoices.columns.date"),
      defaultWidth: 130,
      renderCell: (invoice) => formatInvoiceTableDate(invoice.date),
    },
    {
      id: "container",
      label: t("invoices.columns.container"),
      sortField: "container.name",
      defaultWidth: 120,
      renderCell: (invoice) => getContainerLabelForInvoice(invoice),
    },
    {
      id: "invoiceDetails",
      label: t("invoices.columns.invoiceDetails"),
      defaultVisible: false,
      defaultWidth: 240,
      renderCell: (invoice) => formatInvoiceLineItemsSummary(invoice, t),
    },
    {
      id: "paidStatus",
      label: t("invoices.columns.paidStatus"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      defaultWidth: 120,
      renderCell: (invoice) => {
        const status = resolveInvoicePaidStatus(invoice);
        return (
          <TableTagText className={getInvoicePaidStatusBadgeClass(status)}>
            {getInvoiceTableStatusLabel(invoice, t)}
          </TableTagText>
        );
      },
    },
    {
      id: "pendingStatus",
      label: t("invoices.columns.pendingStatus"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      defaultWidth: 120,
      sortable: false,
      renderCell: (invoice) => {
        const isPaid = getInvoiceBalance(invoice) <= 0;
        return (
          <TableTagText
            className={
              isPaid
                ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300"
            }
          >
            {getInvoicePendingLabel(invoice, t)}
          </TableTagText>
        );
      },
    },
    {
      id: "sender.name",
      label: t("invoices.columns.senderName"),
      sortField: "sender.name",
      defaultWidth: 280,
      renderCell: (invoice) => invoice.sender.name.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.phones",
      label: t("invoices.columns.senderPhone"),
      defaultWidth: 260,
      truncateCell: false,
      cellClassName: "align-top",
      renderCell: (invoice) => <InvoicePartyPhoneCell party={invoice.sender} />,
    },
    {
      id: "sender.address",
      label: t("invoices.columns.senderAddress"),
      sortField: "sender.address.address1",
      defaultWidth: 340,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (invoice) => <InvoicePartyAddressCell party={invoice.sender} />,
    },
    {
      id: "receiver.name",
      label: t("invoices.columns.receiverName"),
      sortField: "receiver.name",
      defaultWidth: 340,
      renderCell: (invoice) => {
        const receiver = getInvoicePrimaryReceiver(invoice);
        return receiver?.name?.trim() || t("common.empty.dash");
      },
    },
    {
      id: "receiver.phones",
      label: t("invoices.columns.receiverPhone"),
      defaultWidth: 260,
      truncateCell: false,
      cellClassName: "align-top",
      renderCell: (invoice) => <InvoicePartyPhoneCell party={getInvoicePrimaryReceiver(invoice)} />,
    },
    {
      id: "receiver.address",
      label: t("invoices.columns.receiverAddress"),
      sortField: "receiver.address.address1",
      defaultWidth: 340,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (invoice) => (
        <InvoicePartyAddressCell party={getInvoicePrimaryReceiver(invoice)} />
      ),
    },
    {
      id: "itemCount",
      defaultBefore: "total",
      label: t("invoices.columns.itemCount"),
      sortable: false,
      defaultWidth: 110,
      renderCell: (invoice) => formatInvoiceItemCount(invoice.itemCount ?? 0),
    },
    {
      id: "total",
      label: t("invoices.columns.total"),
      sortField: "cost",
      truncateCell: false,
      defaultWidth: 120,
      renderCell: (invoice) => {
        const amount = getInvoiceSubtotal(invoice);
        return <span className={getInvoiceTotalMoneyClass()}>{formatInvoiceMoney(amount)}</span>;
      },
    },
    {
      id: "discount",
      label: t("invoices.columns.discount"),
      truncateCell: false,
      defaultWidth: 120,
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
      defaultWidth: 120,
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
      defaultWidth: 120,
      renderCell: (invoice) => {
        const amount = getInvoiceBalance(invoice);
        return <span className={getInvoiceBalanceMoneyClass(amount)}>{formatInvoiceMoney(amount)}</span>;
      },
    },
    {
      id: "paymentLocation",
      label: t("invoices.columns.paymentLocation"),
      sortField: "paidRegion",
      defaultVisible: false,
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (invoice) => (
        <TableTagText className={getBranchBadgeClass(invoice.paymentLocation)}>
          {getPaymentLocationLabel(invoice.paymentLocation)}
        </TableTagText>
      ),
    },
    {
      id: "pickupAssignment",
      label: t("invoices.columns.pickupAssignment"),
      defaultVisible: false,
      renderCell: (invoice) =>
        formatInvoicePickupAssignmentLabel(invoice, t, t("common.empty.dash")),
    },
    {
      id: "createdBy",
      label: t("invoices.columns.createdBy"),
      sortField: "createdBy.name",
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (invoice) => invoice.createdBy.trim() || t("common.empty.dash"),
    },
    {
      id: "createdAt",
      label: t("invoices.columns.createdAt"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (invoice) =>
        invoice.createdAt ? formatAuditDateTime(invoice.createdAt) : t("common.empty.dash"),
    },
  ],
    [t],
  );

  const columnVisibility = useApiTableColumns("invoices-v12", tableColumns, INVOICE_API_TABLE_FIELDS);
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
      <div className="[&>div>div>p]:max-md:hidden [&>div]:max-md:flex-row [&>div]:max-md:items-center [&>div]:max-md:justify-between">
        <PageHeader
          title={t("invoices.title")}
          description={t("invoices.pages.description")}
          actions={
            <div className="flex items-center gap-2">
              {canSyncLegacyInvoices ? (
                <Button
                  type="button"
                  variant="outline"
                  className="hidden md:inline-flex"
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
              {canSyncLegacyInvoices ? <div className="md:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-11" aria-label={t("invoices.mobile.more")}><Ellipsis className="size-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={isSaving} onSelect={() => void handleSyncLegacyInvoices()}><RefreshCw className="mr-2 size-4" />{t("invoices.actions.syncLegacy")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div> : null}
              <Button onClick={openAddForm} disabled={isSaving} aria-label={t("invoices.workspace.addInvoice")} className="max-md:size-11 max-md:rounded-full max-md:p-0">
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">{t("invoices.workspace.addInvoice")}</span>
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
              placeholder={t("invoices.mobile.search")}
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
            <SlidersHorizontal className="size-5" />
          </Button>

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
              }}
              onChange={(rows) => {
                setFilters((current) => ({ ...current, rows }));
                setPage(1);
              }}
            />
          </TableFilterPanel>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-primary/10 px-4 py-[17px]">
          <div><p className="text-[13px] font-medium">{t("invoices.mobile.outstanding")}</p><p className="mt-1 text-[11px] text-muted-foreground">{t("invoices.mobile.acrossAll")}</p></div>
          <div className="shrink-0 text-right"><strong className="text-2xl font-semibold tracking-tight tabular-nums">{invoiceStats.isBalanceLoading ? "…" : invoiceStats.isError ? "—" : formatInvoiceMoney(invoiceStats.outstandingBalance)}</strong><span className="mt-0.5 block text-[10px] tracking-widest text-muted-foreground">USD</span></div>
        </div>
        <div className="flex rounded-xl border border-border/70 bg-card p-1" aria-label={t("invoices.mobile.views")}>
          {(["all", "due", "paid", "incomplete"] as const).map(view => <button type="button" key={view} aria-pressed={mobileView === view} className={cn("min-h-11 flex-1 rounded-lg px-1 text-[11px]", mobileView === view ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground")} onClick={() => { setMobileView(view); setSelectedIds([]); }}>{t(`invoices.mobile.${view}`)}</button>)}
        </div>
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground"><span>{t("invoices.mobile.count", { count: totalInvoices })}</span><button type="button" className="min-h-10 px-2 text-primary" onClick={() => { setMobileSelectMode(value => !value); setSelectedIds([]); }}>{t(mobileSelectMode ? "invoices.mobile.done" : "invoices.mobile.select")}</button></div>

        {!isLoading && !isError && invoices.length > 0 && selectedCount > 0 ? (
          <TableSelectionToolbar
            selectedIds={selectedIds}
            pageRowIds={invoices.map((invoice) => invoice.invoiceId)}
            totalCount={totalInvoices}
            onSelectedIdsChange={setSelectedIds}
            onView={() => { if (selectedInvoices[0]) openView(selectedInvoices[0]); }}
            onEdit={() => { if (selectedInvoices[0]) openEditForm(selectedInvoices[0]); }}
            onDelete={() => setDeleteTarget(selectedInvoices)}
            deleteDisabled={isDeleting}
            actions={
              <>
                {documentsButton}
                <Button variant="outline" size="sm" className={tableSelectionActionStyles.print} onClick={printSelectedInvoices} disabled={isPrinting || !canPrintInvoices}>
                  <Printer className="h-4 w-4" />
                  {isPrinting ? "Preparing…" : "Print"}
                </Button>
              </>
            }
          />
        ) : null}

        <div className="rounded-xl bg-background">
          {isError && invoices.length === 0 ? (
            <div className="px-4 py-8 text-sm text-destructive">
              <p role="alert">{normalizeApiError(error).message}</p>
              <Button variant="ghost" onClick={() => void mobileQuery.refetch()}>{t("invoices.mobile.retry")}</Button>
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
            <div className="space-y-4">
              {mobileInvoiceGroups.map((group, groupIndex) => (
                <section
                  key={group.month}
                  aria-label={group.month}
                  className="space-y-2"
                >
                  <h2
                    className={cn(
                      "px-1 pb-1 text-xs font-semibold text-foreground",
                      groupIndex === 0 ? "pt-0" : "pt-4",
                    )}
                  >
                    {group.month}
                  </h2>
                  <div className="overflow-hidden rounded-[18px] border border-border/70">
                    {group.invoices.map((invoice) => (
                      <MobileInvoiceRow
                        key={invoice.invoiceId}
                        invoice={invoice}
                        onOpen={openView}
                        onPrint={canPrintInvoices ? invoice => setPrintInvoiceIds([invoice.invoiceId]) : undefined}
                        selected={selectedIds.includes(invoice.invoiceId)}
                        selectionMode={mobileSelectMode || selectedCount > 0}
                        onToggleSelected={toggleSelect}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        <div ref={continuationRef} className="flex min-h-16 flex-col items-center justify-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {mobileQuery.isFetchingNextPage ? <><RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t("invoices.mobile.loadingOlder")}</> : mobileQuery.isFetchNextPageError ? <><p role="alert">{normalizeApiError(mobileQuery.error).message}</p><Button variant="ghost" onClick={() => void mobileQuery.fetchNextPage()}>{t("invoices.mobile.retry")}</Button></> : mobileQuery.hasNextPage ? <Button variant="ghost" className="text-primary" onClick={() => void mobileQuery.fetchNextPage({ cancelRefetch: false })}>{t("invoices.mobile.older")}</Button> : !isLoading && !isError && invoices.length > 0 ? <span>{t("invoices.mobile.end")}</span> : null}
        </div>
        {canSyncLegacyInvoices ? (
          <div className="px-1">
            <LegacyLastSynced at={lastSyncedAt} />
          </div>
        ) : null}
      </section>

      <div className="hidden md:block">
      <StatCardsCarousel mobileLayout="stack">
        <NewInvoicesStatCard />
        {stats.map((stat) => (
          <FlippableStatCard key={stat.label} {...stat} />
        ))}
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
              <div className="min-w-0 flex-1 space-y-2">
                <TableSearchInput
                  value={filters.query}
                  onChange={(query) => {
                    setFilters((current) => ({ ...current, query }));
                    setPage(1);
                  }}
                  placeholder={t("invoices.search.placeholder")}
                />
              </div>
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
              <Button size="sm" onClick={openManageInvoiceItems} disabled={!canViewBarcodes}>
                <Tags className="h-4 w-4" />
                {t("invoices.staging.tableAction")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={printSelectedInvoices}
                disabled={isPrinting || !canPrintInvoices}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? "Preparing…" : "Print"}
              </Button>
              {documentsButton}
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

      {printInvoiceIds.length > 0 && <InvoicePrintSignaturesDialog invoiceIds={printInvoiceIds} onClose={() => setPrintInvoiceIds([])} />}

      <InvoiceViewSheet
        key={`${viewInvoiceId}-${viewDocuments}`}
        initialTab={viewDocuments ? "documents" : "overview"}
        invoice={viewInvoice}
        open={Boolean(viewInvoiceId)}
        onOpenChange={(open) => {
          if (!open) closeView();
        }}
        onEdit={(invoice) => openEditForm(invoice)}
        onDelete={(invoice) => openDeleteInvoice(invoice)}
        onAddComment={addInvoiceComment}
      />

      <Dialog
        open={addFormOpen}
        onOpenChange={(open) => {
          if (!open) setAddFormOpen(false);
        }}
      >
        <DialogContent className={invoiceWizardDialogClassName}>
          <DialogHeader className="hidden shrink-0 border-b border-border px-5 py-4 sm:block sm:px-6">
            <DialogTitle>{t("invoices.workspace.addInvoice")}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <InvoiceCreateWizard inDialog onCancel={() => setAddFormOpen(false)} />
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
                ? t("invoices.workspace.editInvoiceNamed", {
                    number: formatInvoiceTabLabel(
                      editingInvoice,
                      t("invoices.workspace.untitledTab"),
                    ),
                  })
                : t("invoices.workspace.editInvoice")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {editInvoiceId ? (
              <InvoiceEditWizard
                inDialog
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
