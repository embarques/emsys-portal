"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  FilePenLine,
  FileText,
  Filter,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Loader2,
  Tags,
  UserRound,
  Wallet,
} from "lucide-react";

import { InvoiceCreateWizard, InvoiceEditWizard } from "@/components/invoices/invoice-form-workspace";
import {
  TableSelectionActionsMenu,
  TableSelectionActionItem,
  TableSelectionActionSeparator,
} from "@/components/app-shell/table-selection-actions-menu";
import { InvoiceLineItemsCell } from "@/components/invoices/invoice-line-items-cell";
import { InvoiceViewSheet } from "@/components/invoices/invoice-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import {
  DirectoryInsightsFlip,
  DirectoryInsightsToggle,
} from "@/components/app-shell/directory-insights-flip";
import { InvoiceHistogramCharts } from "@/components/dashboard/dashboard-histogram-charts";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoicePoliciesButton } from "@/components/invoices/invoice-policies-button";
import { ReservedInvoicesButton } from "@/components/invoices/reserved-invoices-button";

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

import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";
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
  computeInvoiceKpis,
  formatInvoiceCount,
  formatInvoiceDate,
  formatInvoiceMoney,
  formatInvoiceItemCount,
  formatInvoicePartyAddressLine,
  formatInvoicePartyAddressLines,
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
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import { buildInvoiceCommentActivity } from "@/lib/invoices/activity";
import {
  useDeleteInvoices,
  useInvoice,
  useInvoiceJournals,
  useInvoiceStats,
  useInvoices,
  useNewInvoiceStats,
} from "@/lib/invoices/hooks/use-invoices";
import { DEFAULT_NEW_INVOICE_STAT_PERIOD } from "@/lib/invoices/new-invoice-stats";
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
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
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
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import { useSyncWorkspaceTabTitle } from "@/lib/layout/hooks/use-sync-workspace-tab-title";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { getBranchBadgeClass } from "@/lib/vehicles/display";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { TablePhoneCell } from "@/components/phones/table-phone-cell";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { OrderParty } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const invoiceWizardDialogClassName =
  "left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden overflow-x-hidden rounded-none border-0 p-0 max-sm:[&>button:last-child]:hidden sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border";

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
  return <TablePhoneCell phones={party?.phones ?? []} />;
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
        aria-label={
          selected ? t("invoices.workspace.deselectInvoice") : t("invoices.workspace.selectInvoice")
        }
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
        <span className={cn(
          "block truncate text-lg font-bold leading-tight",
          hasPendingRegistration(invoice) ? "text-red-600 dark:text-red-400" : "text-foreground",
        )}>
          {hasPendingRegistration(invoice) ? "*" : ""}
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
        <TableTagText className={cn("text-base", getInvoiceBalanceMoneyClass(balance))}>
          {formatInvoiceMoney(balance)}
        </TableTagText>
        <TableTagText
          className={
            isClosed
              ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300"
          }
        >
          {getInvoicePaidStatusLabel(status, t)}
        </TableTagText>
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
  const { notifyAdded, notifyDeleted, notifyError } = useFeedback();
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState<InvoiceFilterState>(defaultFilters);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_INVOICE_LIST_PARAMS.sort, () => setPage(1));
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewDocuments, setViewDocuments] = useState(false);
  const [viewOverlay, setViewOverlay] = useState<Partial<Invoice> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | Invoice[] | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [editWizardStep, setEditWizardStep] = useState<number | undefined>(undefined);

  const { openTab, openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const canViewBarcodes = hasPermission(
    PERMISSIONS.packagesView.name,
    PERMISSIONS.packagesView.resourceType,
  );

  function openManageItemsFor(targets: Invoice[]) {
    if (!canViewBarcodes) return;
    openTab(
      buildInvoiceBarcodesHref(targets.map((invoice) => invoice.invoiceNumber)),
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

  function openEditForm(
    invoice: Invoice,
    options?: { initialWizardStep?: number },
  ) {
    closeView();
    if (isDesktopTabs) {
      openFormTab({
        feature: "invoices",
        baseHref: "/invoices",
        mode: "edit",
        entityId: getInvoiceRecordId(invoice),
        label: formatInvoiceTabLabel(invoice, t("invoices.workspace.untitledTab")),
        ...(options?.initialWizardStep != null
          ? { initialWizardStep: options.initialWizardStep }
          : {}),
      });
      return;
    }
    setEditWizardStep(options?.initialWizardStep);
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
        query: debouncedQuery,
        rows: filters.rows,
        paymentLocation: filters.paymentLocation,
        sort,
      }),
    [debouncedQuery, filters.paymentLocation, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching, refetch } = useInvoices(listParams);
  const invoiceStats = useInvoiceStats();
  const newInvoiceStats = useNewInvoiceStats(DEFAULT_NEW_INVOICE_STAT_PERIOD);
  const { data: usersData, isLoading: usersLoading } = useUsers({
    page: 1,
    limit: 100,
    sort: "name:asc",
  });
  const deleteInvoicesMutation = useDeleteInvoices();
  const [printInvoiceIds, setPrintInvoiceIds] = useState<string[]>([]);
  const isPrinting = printInvoiceIds.length > 0;
  const canPrintInvoices = hasPermission(PERMISSIONS.invoicesPrint.name, PERMISSIONS.invoicesPrint.resourceType);
  const canCreateInvoices = hasPermission(PERMISSIONS.invoicesCreate.name, PERMISSIONS.invoicesCreate.resourceType);
  const canUpdateInvoices = hasPermission(PERMISSIONS.invoicesUpdate.name, PERMISSIONS.invoicesUpdate.resourceType);
  const canDeleteInvoices = hasPermission(PERMISSIONS.invoicesDelete.name, PERMISSIONS.invoicesDelete.resourceType);
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
  const totalInvoices = data?.total ?? 0;
  rememberTotal(totalInvoices);
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    invoices.length > 0 && invoices.every((invoice) => selectedIds.includes(invoice.invoiceId));
  const isDeleting = deleteInvoicesMutation.isPending;
  const isSaving = isDeleting || isPrinting;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows, filters.paymentLocation),
    setSelectedIds,
  );

  const viewInvoice = useMemo(() => {
    if (!viewInvoiceId) return null;
    const base =
      detailInvoice ?? invoices.find((invoice) => invoice.invoiceId === viewInvoiceId) ?? null;
    if (!base) return null;

    const journalPayments = mapInvoiceJournalsToPayments(invoiceJournals ?? [], base.invoiceId, t);

    if (!viewOverlay && journalPayments.length === 0) return base;

    return {
      ...base,
      comments: [...base.comments, ...(viewOverlay?.comments ?? [])],
      activity: [...base.activity, ...(viewOverlay?.activity ?? [])],
      payments: journalPayments.length > 0 ? journalPayments : base.payments,
      updatedAt: viewOverlay?.updatedAt ?? base.updatedAt,
    };
  }, [detailInvoice, invoices, invoiceJournals, t, viewInvoiceId, viewOverlay]);

  useSyncWorkspaceTabTitle(
    viewInvoice ? t("invoices.workspace.tabTitle", { number: viewInvoice.invoiceNumber }) : null,
    t("invoices.title"),
  );

  const kpis = useMemo(() => computeInvoiceKpis(invoices), [invoices]);

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)),
    [invoices, selectedIds],
  );
  const selectedCount = selectedInvoices.length;
  const deleteBlockedCount = selectedInvoices.filter((invoice) => invoice.hasAccountingEntries).length;
  const deleteBlockedNote =
    canDeleteInvoices && deleteBlockedCount > 0 ? (
      <p className="text-xs text-muted-foreground">
        {t(
          deleteBlockedCount === 1
            ? "invoices.workspace.delete.blockedSelection_one"
            : "invoices.workspace.delete.blockedSelection_other",
          { count: deleteBlockedCount },
        )}
      </p>
    ) : null;
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

  function openView(invoice: Invoice, options?: { documents?: boolean }) {
    setViewDocuments(Boolean(options?.documents));
    setViewInvoiceId(invoice.invoiceId);
    setViewOverlay(null);
  }

  function closeView() {
    setViewInvoiceId(null);
    setViewDocuments(false);
    setViewOverlay(null);
  }

  const canViewInvoices = hasPermission(PERMISSIONS.invoicesView.name, PERMISSIONS.invoicesView.resourceType);
  const allowRequestChange = hasPermission("canCreateChangeRequest", "change_request");
  const selectedInvoice = selectedCount === 1 ? selectedInvoices[0] : undefined;

  /** Fresh tree per toolbar (mobile + desktop); do not reuse one React element. */
  function renderInvoiceSelectionActions() {
    const singleSelected = selectedCount === 1 ? selectedInvoice : undefined;
    const showEditActions = Boolean(singleSelected && canUpdateInvoices);
    const showManageDocuments = Boolean(singleSelected && canViewInvoices);
    const showManageItems =
      canViewBarcodes &&
      selectedCount > 0 &&
      selectedInvoices.length === selectedCount;
    const showRequestChange = Boolean(allowRequestChange && singleSelected);
    const showActionsMenu =
      showEditActions || showManageDocuments || showManageItems || showRequestChange;

    return (
      <>
        {canPrintInvoices ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
            disabled={
              isPrinting ||
              selectedCount === 0 ||
              selectedInvoices.length !== selectedCount
            }
            onClick={() => {
              const ids = selectedInvoices
                .map((invoice) => invoice.invoiceId)
                .filter(Boolean);
              if (ids.length === 0) return;
              setPrintInvoiceIds(ids);
            }}
          >
            <Printer className="size-4" />
            {isPrinting
              ? t("invoices.wizard.actions.preparing")
              : t("invoices.wizard.actions.print")}
          </Button>
        ) : null}
        <TableSelectionActionsMenu hidden={!showActionsMenu}>
          {showEditActions && singleSelected ? (
            <>
              <TableSelectionActionItem
                onSelect={() => openEditForm(singleSelected, { initialWizardStep: 3 })}
                className={tableSelectionActionMenuStyles.edit}
              >
                <Wallet className="size-4" />
                {t("invoices.view.actions.editTotals")}
              </TableSelectionActionItem>
              <TableSelectionActionItem
                onSelect={() => openEditForm(singleSelected, { initialWizardStep: 1 })}
                className={tableSelectionActionMenuStyles.edit}
              >
                <Receipt className="size-4" />
                {t("invoices.view.actions.editInvoiceDetails")}
              </TableSelectionActionItem>
              <TableSelectionActionItem
                onSelect={() => openEditForm(singleSelected, { initialWizardStep: 2 })}
                className={tableSelectionActionMenuStyles.edit}
              >
                <Send className="size-4" />
                {t("invoices.form.partyActions.editSender")}
              </TableSelectionActionItem>
              {singleSelected.receiver ? (
                <TableSelectionActionItem
                  onSelect={() => openEditForm(singleSelected, { initialWizardStep: 2 })}
                  className={tableSelectionActionMenuStyles.edit}
                >
                  <UserRound className="size-4" />
                  {t("invoices.form.partyActions.editReceiver")}
                </TableSelectionActionItem>
              ) : null}
              {showManageDocuments || showManageItems || showRequestChange ? (
                <TableSelectionActionSeparator />
              ) : null}
            </>
          ) : null}
          {showManageDocuments && singleSelected ? (
            <TableSelectionActionItem
              onSelect={() => openView(singleSelected, { documents: true })}
              className={tableSelectionActionMenuStyles.documents}
            >
              <FileText className="size-4" />
              {t("invoices.view.actions.manageDocuments")}
            </TableSelectionActionItem>
          ) : null}
          {showManageItems ? (
            <TableSelectionActionItem
              onSelect={() => openManageItemsFor(selectedInvoices)}
              className={tableSelectionActionMenuStyles.documents}
            >
              <Tags className="size-4" />
              {t("invoices.staging.tableAction")}
            </TableSelectionActionItem>
          ) : null}
          {showRequestChange && singleSelected ? (
            <TableSelectionActionItem
              asChild
              className={tableSelectionActionMenuStyles.request}
            >
              <Link href={changeRequestHref("invoice", singleSelected.invoiceId)}>
                <FilePenLine className="size-4" />
                {t("accounting.journalLifecycle.request")}
              </Link>
            </TableSelectionActionItem>
          ) : null}
        </TableSelectionActionsMenu>
      </>
    );
  }

  function addInvoiceComment(invoiceId: string, description: string) {
    const comment = createInvoiceComment(description);
    const timestamp = comment.createdAt;
    const activityEntry = buildInvoiceCommentActivity(
      invoiceId,
      description,
      comment.createdBy,
      timestamp,
      t,
    );

    setViewOverlay((current) => ({
      ...current,
      comments: [...(current?.comments ?? []), comment],
      activity: [...(current?.activity ?? []), activityEntry],
      updatedAt: timestamp,
    }));

    notifyAdded(t("invoices.view.comments.entity"));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      const records = (Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget]).map(invoice => ({id: invoice.invoiceId, version: invoice.version}));
      const result = await deleteInvoicesMutation.mutateAsync(records);

      reportBulkSettled({
        result,
        t,
        entityLabel: t("invoices.entity"),
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

  const editingInvoice = useMemo(
    () => invoices.find((invoice) => invoice.invoiceId === editInvoiceId) ?? null,
    [editInvoiceId, invoices],
  );

  const stats = [
    {
      label: t("invoices.stats.total.label"),
      value: isLoading ? "…" : formatInvoiceCount(totalInvoices),
      description: t("invoices.stats.total.description"),
      icon: FileText,
      details: [
        {
          label: t("invoices.stats.total.details.currentPage"),
          value: isLoading ? "…" : invoices.length.toString(),
        },
        {
          label: t("invoices.stats.total.details.page"),
          value: isLoading
            ? "…"
            : t("invoices.stats.total.details.pageValue", { current: currentPage, total: totalPages }),
        },
        { label: t("invoices.stats.total.details.pageSize"), value: pageLimit.toString() },
      ],
    },
    {
      label: t("invoices.stats.outstandingCount.label"),
      value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
      description: t("invoices.stats.outstandingCount.description"),
      icon: CircleAlert,
      details: [
        {
          label: t("invoices.stats.outstandingCount.details.openInvoices"),
          value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
        },
        {
          label: t("invoices.stats.outstandingCount.details.shareOfTotal"),
          value:
            invoiceStats.isLoading || isLoading || totalInvoices === 0
              ? "…"
              : `${Math.round((invoiceStats.outstanding / totalInvoices) * 100)}%`,
        },
        {
          label: t("invoices.stats.outstandingCount.details.statuses"),
          value: t("invoices.stats.outstandingCount.details.statusesValue"),
        },
      ],
    },
    {
      label: t("invoices.stats.outstandingBalance.label"),
      value: invoiceStats.isBalanceLoading
        ? "…"
        : formatInvoiceMoney(invoiceStats.outstandingBalance),
      description: t("invoices.stats.outstandingBalance.description"),
      icon: Receipt,
      details: [
        {
          label: t("invoices.stats.outstandingBalance.details.openInvoices"),
          value: invoiceStats.isLoading ? "…" : formatInvoiceCount(invoiceStats.outstanding),
        },
        {
          label: t("invoices.stats.outstandingBalance.details.averageBalance"),
          value:
            invoiceStats.isBalanceLoading || invoiceStats.outstanding === 0
              ? "…"
              : formatInvoiceMoney(
                  invoiceStats.outstandingBalance / invoiceStats.outstanding,
                ),
        },
        {
          label: t("invoices.stats.outstandingBalance.details.scope"),
          value: t("invoices.stats.outstandingBalance.details.scopeValue"),
        },
      ],
    },
  ];

  const insightMetrics = [
    {
      label: t("invoices.stats.new.label"),
      value: newInvoiceStats.isLoading ? "…" : newInvoiceStats.total.toLocaleString(),
      description: t("invoices.stats.new.periods.30d"),
      icon: FileText,
    },
    ...stats.map(({ label, value, description, icon }) => ({
      label,
      value,
      description,
      icon,
    })),
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
      copyable: false,
      defaultVisible: false,
      defaultWidth: 240,
      renderCell: (invoice) => <InvoiceLineItemsCell invoice={invoice} />,
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
      renderCell: (invoice) => <InvoicePartyPhoneCell party={invoice.sender} />,
    },
    {
      id: "sender.address",
      label: t("invoices.columns.senderAddress"),
      sortField: "sender.address.address1",
      defaultWidth: 340,
      truncateCell: false,
      cellClassName: ADDRESS_TEXT_WRAP_CLASSNAME,
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
      renderCell: (invoice) => <InvoicePartyPhoneCell party={getInvoicePrimaryReceiver(invoice)} />,
    },
    {
      id: "receiver.address",
      label: t("invoices.columns.receiverAddress"),
      sortField: "receiver.address.address1",
      defaultWidth: 340,
      truncateCell: false,
      cellClassName: ADDRESS_TEXT_WRAP_CLASSNAME,
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
        return (
          <TableTagText className={getInvoiceBalanceMoneyClass(amount)}>
            {formatInvoiceMoney(amount)}
          </TableTagText>
        );
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
          {invoice.paymentBranchName || getPaymentLocationLabel(invoice.paymentLocation)}
        </TableTagText>
      ),
    },
    {
      id: "pickupAssignment",
      label: t("invoices.columns.pickupAssignment"),
      defaultVisible: false,
      renderCell: (invoice) =>
        invoice.supervisor?.name || invoice.pickupEmployeeName || t("common.empty.dash"),
    },
    {
      id: "dailyRoute",
      label: t("invoices.form.fields.pickupRoute"),
      defaultVisible: false,
      renderCell: (invoice) => invoice.dailyRouteName || (invoice.pickupSource === "route" && invoice.routeName) || t("common.empty.dash"),
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
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: invoices.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalInvoices,
      noun: t("invoices.noun"),
      isFiltered: hasActiveFilters,
      isLoading: isFetching,
    },
    t,
  );

  return (
    <div>
      <div className="[&>div>div>p]:max-md:hidden">
        <PageHeader
          title={t("invoices.title")}
          description={t("invoices.pages.description")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <InvoicePoliciesButton />
              <ReservedInvoicesButton />
              <DirectoryInsightsToggle
                open={insightsOpen}
                onOpenChange={setInsightsOpen}
                className="hidden md:inline-flex"
              />
              {canCreateInvoices ? (
                <Button onClick={openAddForm} disabled={isSaving}>
                  <Plus className="h-4 w-4" />
                  {t("invoices.workspace.addInvoice")}
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <section className="space-y-5 md:hidden">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80" role={isFetching || isSearchPending ? "progressbar" : undefined} aria-label={isFetching || isSearchPending ? t("common.ui.searching") : undefined}>
              {isFetching || isSearchPending ? <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> : <Search aria-hidden="true" className="size-5" />}
            </span>
            <input
              aria-busy={isFetching || isSearchPending}
              value={filters.query}
              onChange={(event) => {
                setFilters((current) => ({ ...current, query: event.target.value }));
                setPage(1);
              }}
              className="h-12 w-full rounded-xl border border-border/70 bg-card pl-12 pr-4 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder={t("invoices.search.placeholder")}
              aria-label={t("invoices.workspace.searchAria")}
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
            aria-label={t("invoices.workspace.filterAria")}
          >
            <Filter className="size-5" />
          </Button>
        </div>

        {mobileFiltersOpen ? (
          <TableFilterPanel isLoading={isFetching || isSearchPending}
            resultSummary={listSummary}
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

        <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/15 bg-primary/10 px-4 py-4 text-primary shadow-xs">
          <span className="text-base font-semibold">
            {t("invoices.workspace.outstandingReceivables")}
          </span>
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
          <TableSelectionToolbar
            selectedIds={selectedIds}
            pageRowIds={invoices.map((invoice) => invoice.invoiceId)}
            totalCount={totalInvoices}
            onSelectedIdsChange={setSelectedIds}
            onEdit={() => { if (selectedInvoices[0]) openEditForm(selectedInvoices[0]); }}
            onDelete={() => setDeleteTarget(selectedInvoices)}
            canEdit={canUpdateInvoices}
            canDelete={canDeleteInvoices}
            deleteDisabled={isDeleting || deleteBlockedCount > 0}
            meta={deleteBlockedNote}
            actions={renderInvoiceSelectionActions()}
          />
        ) : null}

        <div className="rounded-xl bg-background">
          {isError ? (
            <div className="px-4 py-8 text-sm text-destructive">
              {normalizeApiError(error).message}
            </div>
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
              {t("invoices.workspace.empty")}
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
      </section>

      <div className="hidden md:block">
      <DirectoryInsightsFlip
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        metrics={insightMetrics}
        insightsExtra={<InvoiceHistogramCharts />}
        title={t("invoices.title")}
        className="mt-6"
      >
      <Card className="gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={desktopFiltersOpen}
            onFiltersOpenChange={setDesktopFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
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
              <TableFilterPanel isLoading={isFetching || isSearchPending}
                resultSummary={listSummary}
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
          onEdit={() => {
            const invoice = selectedInvoices[0];
            if (invoice) openEditForm(invoice);
          }}
          onDelete={() =>
            setDeleteTarget(invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)))
          }
          canEdit={canUpdateInvoices}
          canDelete={canDeleteInvoices}
          deleteDisabled={isDeleting || deleteBlockedCount > 0}
          meta={deleteBlockedNote}
          actions={renderInvoiceSelectionActions()}
        />

        {isError ? (
          <div role="alert" className="space-y-3 border-b px-6 py-3 text-sm text-destructive">
            <p>{normalizeApiError(error).message}</p>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className="h-4 w-4" />
              {t("common.actions.retry")}
            </Button>
          </div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Receipt}
            title={t("invoices.workspace.loader.title")}
            description={t("invoices.workspace.loader.description")}
            columns={[
              t("invoices.columns.invoiceNumber"),
              t("invoices.columns.date"),
              t("invoices.workspace.loader.customer"),
              t("invoices.columns.paidStatus"),
              t("invoices.columns.balance"),
            ]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={invoices}
            page={currentPage}
            isPageDataPending={isFetching || isSearchPending}
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
            onRowDoubleClick={canUpdateInvoices ? openEditForm : undefined}
            activeRowId={viewInvoiceId ?? undefined}
            emptyState={
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? t("invoices.workspace.empty") : t("invoices.workspace.emptyNone")}
              </p>
            }
          />
        )}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{listSummary}</p>
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
      </DirectoryInsightsFlip>
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
        onEdit={(invoice, options) => openEditForm(invoice, options)}
        onDelete={(invoice) => openDeleteInvoice(invoice)}
        canEdit={canUpdateInvoices}
        canDelete={canDeleteInvoices}
        deleteBlocked={Boolean(viewInvoice?.hasAccountingEntries)}
        onManageItems={(invoice) => openManageItemsFor([invoice])}
        manageItemsDisabled={!canViewBarcodes}
        onPrint={(invoice) => {
          if (canPrintInvoices && invoice.invoiceId) setPrintInvoiceIds([invoice.invoiceId]);
        }}
        printDisabled={!canPrintInvoices}
        isPrinting={isPrinting}
        onAddComment={addInvoiceComment}
      />

      <Dialog
        open={addFormOpen}
        onOpenChange={(open) => {
          if (!open) setAddFormOpen(false);
        }}
      >
        <DialogContent
          className={invoiceWizardDialogClassName}
          onOpenAutoFocus={(event) => {
            // Let the wizard focus the first field without opening SearchableSelect lists
            // (e.g. pickup reference on Edit sender/receiver → parties step).
            event.preventDefault();
          }}
        >
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
          if (!open) {
            setEditInvoiceId(null);
            setEditWizardStep(undefined);
          }
        }}
      >
        <DialogContent
          className={invoiceWizardDialogClassName}
          onOpenAutoFocus={(event) => {
            // Let the wizard focus the first field without opening SearchableSelect lists
            // (e.g. pickup reference on Edit sender/receiver → parties step).
            event.preventDefault();
          }}
        >
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
                key={`${editInvoiceId}-${editWizardStep ?? "default"}`}
                inDialog
                invoiceId={editInvoiceId}
                initialWizardStep={editWizardStep}
                onCancel={() => {
                  setEditInvoiceId(null);
                  setEditWizardStep(undefined);
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("invoices.workspace.delete.titleMany")
                : t("invoices.workspace.delete.titleOne")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("invoices.workspace.delete.descriptionMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("invoices.workspace.delete.descriptionOne", {
                    number: deleteTarget?.invoiceNumber ?? "",
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={isDeleting} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
