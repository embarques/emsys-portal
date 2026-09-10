"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronUp, Edit, Lock, LockOpen, Plus, Printer, ScrollText, Trash2 } from "lucide-react";

import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { DailyIncomePrintDialog, type DailyIncomePrintSelection } from "@/components/accounting/daily-income-print-dialog";
import { DailyIncomeStatementForm } from "@/components/accounting/daily-income-statement-form";
import { DailyIncomeTransactionViewSheet } from "@/components/accounting/daily-income-transaction-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards, type StatCardItem } from "@/components/app-shell/stat-cards-carousel";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useChartAccounts,
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
  useCreateIncomeStatement,
  useDailyIncomeJournal,
  useDailyIncomeJournals,
  useDeleteDailyIncomeJournal,
  useIncomeStatement,
  useIncomeStatementSummaryTotals,
  useSetIncomeStatementStatus,
  useUpdateDailyIncomeJournal,
  useUpdateIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import { getTransactionAssigneeDisplayName } from "@/lib/accounting/daily-income/assignee";
import { journalToFormValues, areDailyIncomeJournalValuesEquivalent, transactionCreatedToastMessage, transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import { buildIncomeReportRequest, openIncomeReportUrl } from "@/lib/accounting/daily-income/print-income-report";
import { fetchIncomeStatement } from "@/lib/accounting/daily-income/api";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import {
  dailyIncomeCurrencyDescription,
  formatDailyIncomeMoney,
  getDailyIncomeCurrencyIcon,
} from "@/lib/accounting/daily-income/display";
import { formatAccountingDate } from "@/lib/accounting/display";
import { normalizeApiError } from "@/lib/api/axios";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useTranslation } from "@/lib/i18n";
import { useGenerateIncomeReport } from "@/lib/reports/hooks/use-reports";
import {
  buildTableSelectionResetKey,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

const toolbarFieldControlClassName =
  "h-10 w-auto rounded-lg border-2 border-foreground/60 bg-card shadow-none focus-visible:border-foreground focus-visible:ring-0";

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function transactionTitle(row: DailyIncomeJournal, fallback: string) {
  return (row.invoice?.number ?? row.account?.displayName ?? row.account?.name ?? row.refNumber) || fallback;
}

function transactionParty(row: DailyIncomeJournal, fallback: string) {
  return row.invoice?.receiver?.name ?? row.invoice?.sender?.name ?? row.account?.name ?? fallback;
}

function transactionAmountClassName(row: DailyIncomeJournal) {
  if (row.amount === 0) return "text-emerald-700";
  if (row.transactionType === "EXPENSE" || row.transactionType === "DISCOUNT") return "text-rose-600";
  return "text-emerald-700";
}

function isTotalCashSummaryLabel(label: string) {
  const normalized = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return normalized.includes("total") && (normalized.includes("efectivo") || normalized.includes("cash"));
}

function isDepositSummaryLabel(label: string) {
  const normalized = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return normalized.includes("deposit");
}

function isExpenseSummaryLabel(label: string) {
  const normalized = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return normalized.includes("gasto") || normalized.includes("expense");
}

function isDiscountSummaryLabel(label: string) {
  const normalized = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return normalized.includes("descuento") || normalized.includes("discount");
}

function prioritizeTotalCashStat(stats: StatCardItem[]) {
  const totalCashIndex = stats.findIndex((stat) => isTotalCashSummaryLabel(stat.label));
  if (totalCashIndex <= 0) return stats;
  const nextStats = [...stats];
  const [totalCashStat] = nextStats.splice(totalCashIndex, 1);
  if (totalCashStat) nextStats.unshift(totalCashStat);
  return nextStats;
}

/** Ensure Total Depositado is its own card, placed immediately after Total Efectivo. */
function ensureDepositStatAfterTotalCash(
  stats: StatCardItem[],
  options: { label: string; zeroValue: string },
): StatCardItem[] {
  const template = stats[0];
  let depositValue: string | undefined;
  let depositDescription = template?.description;
  let depositIcon = template?.icon;

  const hasDepositCard = stats.some((stat) => isDepositSummaryLabel(stat.label));

  const cleanedStats = stats.map((stat) => {
    if (isDepositSummaryLabel(stat.label)) {
      depositValue = stat.value;
      depositDescription = stat.description;
      depositIcon = stat.icon;
      return null;
    }

    if (!stat.details?.length) return stat;

    const remainingDetails = stat.details.filter((detail) => {
      if (!isDepositSummaryLabel(detail.label)) return true;
      depositValue = detail.value;
      depositDescription = stat.description;
      depositIcon = stat.icon;
      return false;
    });

    return {
      ...stat,
      details: remainingDetails.length > 0 ? remainingDetails : undefined,
    };
  }).filter((stat): stat is StatCardItem => stat != null);

  if (!hasDepositCard && depositValue == null && !template) {
    return stats;
  }

  const depositStat: StatCardItem = {
    label: options.label,
    value: depositValue ?? options.zeroValue,
    description: depositDescription,
    icon: depositIcon,
  };

  const withDeposit = [...cleanedStats, depositStat];
  const cashFirst = prioritizeTotalCashStat(withDeposit);
  const depositIndex = cashFirst.findIndex((stat) => isDepositSummaryLabel(stat.label));
  if (depositIndex < 0) return cashFirst;

  const nextStats = [...cashFirst];
  const [deposit] = nextStats.splice(depositIndex, 1);
  if (!deposit) return cashFirst;

  const insertAt = nextStats.findIndex((stat) => isTotalCashSummaryLabel(stat.label)) === 0 ? 1 : 0;
  nextStats.splice(insertAt, 0, deposit);
  return nextStats;
}

function promoteExpenseAndDiscountDetails(stats: StatCardItem[]) {
  const hasExpenseCard = stats.some((stat) => isExpenseSummaryLabel(stat.label));
  const hasDiscountCard = stats.some((stat) => isDiscountSummaryLabel(stat.label));
  const promoted: StatCardItem[] = [];

  const cleanedStats = stats.map((stat) => {
    if (!stat.details?.length) return stat;

    const remainingDetails = stat.details.filter((detail) => {
      const shouldPromoteExpense = !hasExpenseCard && isExpenseSummaryLabel(detail.label);
      const shouldPromoteDiscount = !hasDiscountCard && isDiscountSummaryLabel(detail.label);

      if (shouldPromoteExpense || shouldPromoteDiscount) {
        promoted.push({
          label: detail.label,
          value: detail.value,
          description: stat.description,
          icon: stat.icon,
        });
        return false;
      }

      return true;
    });

    return { ...stat, details: remainingDetails.length > 0 ? remainingDetails : undefined };
  });

  return [...cleanedStats, ...promoted];
}

function DailyIncomeMobileSummary({
  stats,
  loading,
  error,
}: {
  stats: StatCardItem[];
  loading: boolean;
  error?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (error) {
    return <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  }

  if (loading) {
    return <p className="rounded-2xl border bg-card px-4 py-5 text-sm text-muted-foreground">Loading summary totals…</p>;
  }

  if (stats.length === 0) return null;

  const primary = stats[0];
  const secondary = stats.slice(1);

  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-foreground shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-muted-foreground">{primary.label}</span>
          <span className="mt-2 block text-4xl font-bold tracking-normal">{primary.value}</span>
          {primary.description ? <span className="mt-1 block text-xs text-muted-foreground">{primary.description}</span> : null}
        </span>
        <ChevronUp className={cn("mt-1 size-5 shrink-0 transition-transform", !expanded && "rotate-180")} />
      </button>
      {expanded && secondary.length > 0 ? (
        <div className="border-t px-5 py-2">
          {secondary.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
              <span className="min-w-0 text-base text-muted-foreground">{item.label}</span>
              <span className="shrink-0 text-lg font-semibold tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DailyIncomeMobileTransactionRow({
  row,
  currency,
  canModify,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  row: DailyIncomeJournal;
  currency: string;
  canModify: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const title = transactionTitle(row, t("common.empty.dash"));
  const party = transactionParty(row, t("common.empty.dash"));
  const employee = getTransactionAssigneeDisplayName(
    row.employee,
    row.route,
    row.employeeGroup,
  );

  return (
    <div className="border-b border-border/80 py-4 last:border-b-0">
      <button
        type="button"
        onClick={onView}
        className="grid w-full grid-cols-[1fr_auto] gap-4 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold leading-tight text-foreground">{title}</span>
          <span className="mt-1 block truncate text-base text-foreground/80">{party}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{formatAccountingDate(row.date)}</span>
          <span className="mt-2 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{transactionTypeLabel(row.transactionType, t)}</span>
            {row.paymentMethod?.name ? <span>- {row.paymentMethod.name}</span> : null}
            {employee ? <span>- {employee}</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block text-xl font-bold tabular-nums", transactionAmountClassName(row))}>
            {formatDailyIncomeMoney(row.amount, currency)}
          </span>
          {row.refNumber ? <span className="mt-1 block text-xs text-muted-foreground">#{row.refNumber}</span> : null}
        </span>
      </button>
      {canModify ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Edit className="size-4" />
            {t("common.actions.edit")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4" />
            {t("common.actions.delete")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DailyIncomeWorkspace() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const [branchCode, setBranchCode] = useState("");
  const [requestedBranchId, setRequestedBranchId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statementDialog, setStatementDialog] = useState(false);
  const [printDialog, setPrintDialog] = useState(false);
  const [transactionDialog, setTransactionDialog] = useState(false);
  const [editingJournal, setEditingJournal] = useState<DailyIncomeJournal | null>(null);
  const [viewJournal, setViewJournal] = useState<DailyIncomeJournal | null>(null);
  const [deleteJournal, setDeleteJournal] = useState<DailyIncomeJournal | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [openCreateOnLoad, setOpenCreateOnLoad] = useState(false);

  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get("date")?.slice(0, 10);
    const branchId = Number(params.get("branchId"));
    if (requestedDate) setDate(requestedDate);
    if (Number.isInteger(branchId) && branchId > 0) setRequestedBranchId(branchId);
    if (params.get("create") === "1") setOpenCreateOnLoad(true);
  }, []);
  useEffect(() => {
    if (branchCode) return;
    const requestedBranch = branches.find((branch) => branch.id === requestedBranchId);
    const nextBranchCode = requestedBranch?.code ?? branches[0]?.code;
    if (nextBranchCode) setBranchCode(nextBranchCode);
  }, [branchCode, branches, requestedBranchId]);
  const selectedBranch = branches.find((branch) => branch.code === branchCode);
  const statementQuery = useIncomeStatement(selectedBranch?.id ?? 0, date);
  const statement = statementQuery.data ?? null;
  useEffect(() => {
    if (!openCreateOnLoad) return;
    if (statementQuery.isLoading) return;
    if (!branchCode) return;
    if (!statement) setStatementDialog(true);
    setOpenCreateOnLoad(false);
  }, [branchCode, openCreateOnLoad, statement, statementQuery.isLoading]);
  const summaryTotalsQuery = useIncomeStatementSummaryTotals(statement?.id ?? 0);
  const journalsQuery = useDailyIncomeJournals({ incomeStatementId: statement?.id ?? 0, page, limit: pageLimit, query: deferredQuery });
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const dailyRoutesQuery = useDailyRoutePicker(200);
  const dailyRoutes = dailyRoutesQuery.data?.items ?? [];
  const invoicesQuery = useInvoices({ page: 1, limit: 200, sort: "number:desc" });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, transactionDialog);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, transactionDialog);
  const paymentMethodsQuery = useAccountingPaymentMethods(transactionDialog);
  const editingJournalQuery = useDailyIncomeJournal(
    transactionDialog && editingJournal ? editingJournal.id : null,
  );
  const journalForForm = editingJournalQuery.data ?? editingJournal;
  const editInitialValues = useMemo(
    () => (journalForForm ? journalToFormValues(journalForForm) : undefined),
    [journalForForm],
  );
  const createStatement = useCreateIncomeStatement();
  const updateStatement = useUpdateIncomeStatement();
  const statusMutation = useSetIncomeStatementStatus();
  const createJournal = useCreateDailyIncomeJournal();
  const updateJournal = useUpdateDailyIncomeJournal();
  const deleteMutation = useDeleteDailyIncomeJournal();
  const generateIncomeReportMutation = useGenerateIncomeReport();
  const rows = journalsQuery.data?.items ?? [];
  const total = journalsQuery.data?.total ?? rows.length;
  rememberTotal(total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const displayCurrency = summaryTotalsQuery.data?.currency ?? statement?.currency ?? "USD";

  useTableSelectionReset(
    buildTableSelectionResetKey(deferredQuery, page, statement?.id),
    setSelectedIds,
  );

  const allPageSelected =
    rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...rows.map((row) => row.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !rows.some((row) => row.id === id)));
  }

  function toggleSelect(journalId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, journalId] : current.filter((entry) => entry !== journalId),
    );
  }

  const selectedJournal = rows.find((row) => row.id === selectedIds[0]);
  const statementOpen = statement?.status === "OPEN";

  const stats = useMemo((): StatCardItem[] => {
    const summary = summaryTotalsQuery.data;
    if (!summary) return [];

    const icon = getDailyIncomeCurrencyIcon(summary.currency);
    const description = dailyIncomeCurrencyDescription(summary.currency, summary.rate, t);
    const formatAmount = (value: number) => formatDailyIncomeMoney(value, summary.currency);

    const nextStats = promoteExpenseAndDiscountDetails(summary.totals.map((total) => ({
      label: total.header,
      value: summaryTotalsQuery.isFetching && !summaryTotalsQuery.isLoading ? "…" : formatAmount(total.value),
      description,
      icon,
      details: total.details?.map((detail) => ({
        label: detail.header,
        value: formatAmount(detail.value),
      })),
    })));

    return ensureDepositStatAfterTotalCash(nextStats, {
      label: t("accounting.dailyIncome.summary.totalDeposited"),
      zeroValue: formatAmount(0),
    });
  }, [summaryTotalsQuery.data, summaryTotalsQuery.isFetching, summaryTotalsQuery.isLoading, t]);

  const columns: DataTableColumn<DailyIncomeJournal>[] = useMemo(() => [
    { id: "date", label: t("accounting.dailyIncome.columns.date"), renderCell: (row) => row.date || t("common.empty.dash") },
    { id: "invoice", label: t("accounting.dailyIncome.columns.accountInvoice"), renderCell: (row) => row.invoice?.number ?? row.account?.displayName ?? row.account?.name ?? t("common.empty.dash") },
    { id: "employee", label: t("accounting.dailyIncome.columns.assignedTo"), renderCell: (row) => getTransactionAssigneeDisplayName(row.employee, row.route, row.employeeGroup) || t("common.empty.dash") },
    { id: "type", label: t("accounting.dailyIncome.columns.type"), truncateCell: false, renderCell: (row) => <TableTagText>{transactionTypeLabel(row.transactionType, t)}</TableTagText> },
    { id: "reference", label: t("accounting.dailyIncome.columns.reference"), renderCell: (row) => row.refNumber || t("common.empty.dash") },
    { id: "paymentMethod", label: t("accounting.dailyIncome.columns.paymentMethod"), renderCell: (row) => row.paymentMethod?.name ?? t("common.empty.dash") },
    { id: "amount", label: t("accounting.dailyIncome.columns.amount"), cellClassName: "font-medium tabular-nums", renderCell: (row) => formatDailyIncomeMoney(row.amount, displayCurrency) },
  ], [displayCurrency, t]);
  const columnLayout = useColumnVisibility("daily-income-v1", columns);
  const statementValues: DailyIncomeStatementValues = {
    date: statement?.date ?? date,
    branchId: statement?.branch?.id ?? selectedBranch?.id ?? 0,
    branchCode: statement?.branch?.code ?? branchCode,
    branchName: statement?.branch?.name ?? selectedBranch?.name ?? "",
    currency: statement?.currency ?? "USD",
    rate: statement?.rate ?? 1,
  };
  const mutationPending = createStatement.isPending || updateStatement.isPending;

  function saveStatement(values: DailyIncomeStatementValues) {
    setFormError(null);
    if (statement && areFormValuesEquivalent(values, statementValues)) {
      feedback.notifySuccess(t("common.form.noChanges"));
      setStatementDialog(false);
      return;
    }
    const action = statement ? updateStatement.mutateAsync({ id: statement.id, values }) : createStatement.mutateAsync(values);
    action.then(() => { setStatementDialog(false); setBranchCode(values.branchCode); setDate(values.date); feedback.notifySuccess(statement ? t("accounting.dailyIncome.toasts.statementUpdated") : t("accounting.dailyIncome.toasts.statementCreated")); }).catch((error) => setFormError(normalizeApiError(error).message));
  }
  function saveJournal(values: DailyIncomeJournalValues): Promise<void> {
    if (!statement) return Promise.reject(new Error(t("accounting.dailyIncome.errors.noCloseoutLoaded")));
    setFormError(null);
    if (
      journalForForm &&
      areDailyIncomeJournalValuesEquivalent(values, journalToFormValues(journalForForm))
    ) {
      feedback.notifySuccess(t("common.form.noChanges"));
      setTransactionDialog(false);
      setEditingJournal(null);
      return Promise.resolve();
    }
    return (editingJournal
      ? updateJournal.mutateAsync({ id: editingJournal.id, statement, values })
      : createJournal.mutateAsync({ statement, values })
    )
      .then(() => {
        if (editingJournal) {
          feedback.notifySuccess(t("accounting.dailyIncome.toasts.transactionUpdated"));
          setTransactionDialog(false);
          setEditingJournal(null);
          return;
        }

        if (values.transactionType === "INITIAL-PAYMENT") {
          const invoiceNumber = values.invoiceNumber?.trim() || "invoice";
          feedback.notifySuccess(t("accounting.dailyIncome.toasts.invoiceRegistered", { invoiceNumber }));
          return;
        }

        feedback.notifySuccess(transactionCreatedToastMessage(values, t));
      })
      .catch((error) => {
        setFormError(normalizeApiError(error).message);
        return Promise.reject(error);
      });
  }
  function changeStatus(open: boolean) {
    if (!statement) return;
    statusMutation.mutateAsync({ statement, open }).then(() => feedback.notifySuccess(open ? t("accounting.dailyIncome.toasts.statementOpened") : t("accounting.dailyIncome.toasts.statementClosed"))).catch((error) => feedback.notifyError(normalizeApiError(error).message));
  }

  async function handlePrintReport(selection: DailyIncomePrintSelection) {
    const printDate = selection.date.slice(0, 10);
    if (!printDate) {
      feedback.notifyError(t("accounting.dailyIncome.errors.noCloseoutLoaded"));
      return;
    }

    const branchId = selectedBranch?.id ?? 0;
    if (!branchId) {
      feedback.notifyError(t("accounting.dailyIncome.errors.noCloseoutLoaded"));
      return;
    }

    try {
      const printStatement =
        statement && statement.date.slice(0, 10) === printDate
          ? statement
          : await fetchIncomeStatement(branchId, printDate);

      if (!printStatement) {
        feedback.notifyError(t("accounting.dailyIncome.errors.closeoutNotFound"));
        return;
      }

      const report = await generateIncomeReportMutation.mutateAsync(
        buildIncomeReportRequest(printStatement.id, {
          employeeId: selection.employeeId,
        }),
      );
      openIncomeReportUrl(report.url);
      setPrintDialog(false);
      feedback.notifySuccess(t("accounting.dailyIncome.toasts.reportReady"));
    } catch (error) {
      feedback.notifyError(normalizeApiError(error).message);
    }
  }

  function openAddTransactionForm() {
    if (!statement) return;
    if (isDesktopTabs) {
      openFormTab({
        feature: "daily-income-transactions",
        baseHref: "/accounting/daily-income",
        mode: "add",
        entityId: String(statement.id),
        label: t("accounting.dailyIncome.actions.addTransaction"),
      });
      return;
    }
    setEditingJournal(null);
    setFormError(null);
    setTransactionDialog(true);
  }

  function openEditTransactionForm(row: DailyIncomeJournal) {
    setViewJournal(null);
    if (isDesktopTabs) {
      openFormTab({
        feature: "daily-income-transactions",
        baseHref: "/accounting/daily-income",
        mode: "edit",
        entityId: row.id,
        label: t("accounting.dailyIncome.tabs.editType", { type: transactionTypeLabel(row.transactionType, t) }),
      });
      return;
    }
    setEditingJournal(row);
    setFormError(null);
    setTransactionDialog(true);
  }

  function openDeleteTransaction(row: DailyIncomeJournal) {
    setViewJournal(null);
    setDeleteJournal(row);
  }

  return <div className="overflow-x-hidden">
    <div className="space-y-5 md:hidden">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-4xl font-bold tracking-normal">{t("accounting.dailyIncome.title")}</h1>
            <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" />
              <span className="truncate">{formatAccountingDate(date)}</span>
              {selectedBranch ? <span className="truncate">- {selectedBranch.code}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge
              className={cn(
                "mt-1 rounded-full px-3 py-1 text-xs font-semibold",
                statement?.status === "OPEN"
                  ? "border-transparent bg-emerald-100 text-emerald-700"
                  : statement
                    ? "border-transparent bg-slate-100 text-slate-700"
                    : "border-transparent bg-amber-100 text-amber-700",
              )}
            >
              {statement
                ? statement.status === "OPEN"
                  ? t("accounting.dailyIncome.status.open")
                  : t("accounting.dailyIncome.status.closed")
                : t("accounting.dailyIncome.filters.noCloseout")}
            </Badge>
            {statement ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full bg-card"
                  onClick={() => setPrintDialog(true)}
                  disabled={generateIncomeReportMutation.isPending}
                  aria-label={t("accounting.dailyIncome.actions.printReport")}
                  title={t("accounting.dailyIncome.actions.printReport")}
                >
                  <Printer className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full bg-card"
                  onClick={() => setStatementDialog(true)}
                  aria-label={t("accounting.dailyIncome.actions.editCloseout")}
                  title={t("accounting.dailyIncome.actions.editCloseout")}
                >
                  <Edit className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={statement.status === "OPEN" ? "destructive" : "default"}
                  size="icon"
                  className="size-9 rounded-full"
                  onClick={() => changeStatus(statement.status !== "OPEN")}
                  disabled={statusMutation.isPending}
                  aria-label={statement.status === "OPEN" ? t("accounting.dailyIncome.actions.closeDay") : t("accounting.dailyIncome.actions.reopenDay")}
                  title={statement.status === "OPEN" ? t("accounting.dailyIncome.actions.closeDay") : t("accounting.dailyIncome.actions.reopenDay")}
                >
                  {statement.status === "OPEN" ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="daily-branch-mobile">{t("accounting.dailyIncome.filters.branch")}</Label>
            <SearchableSelect
              id="daily-branch-mobile"
              className="min-h-12 rounded-xl border-border bg-card text-base"
              value={branchCode}
              onValueChange={(next) => {
                setBranchCode(next);
                setPage(1);
              }}
              options={branches.map((branch) => ({
                value: branch.code,
                label: `${branch.code} — ${branch.name}`,
                keywords: [branch.code, branch.name],
              }))}
              placeholder={t("accounting.dailyIncome.filters.selectBranch")}
              searchPlaceholder={t("accounting.dailyIncome.filters.searchBranches")}
              mobileSheet
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-date-mobile">{t("accounting.dailyIncome.filters.date")}</Label>
            <DateInput
              id="daily-date-mobile"
              className="h-12 min-h-12 w-full max-w-full rounded-xl border-border bg-card text-base"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {statement ? (
        <DailyIncomeMobileSummary
          stats={stats}
          loading={summaryTotalsQuery.isLoading}
          error={summaryTotalsQuery.isError ? normalizeApiError(summaryTotalsQuery.error).message : null}
        />
      ) : (
        <div className="rounded-3xl border bg-card px-5 py-6 shadow-sm">
          <p className="text-lg font-semibold">{t("accounting.dailyIncome.filters.noCloseout")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("accounting.dailyIncome.description")}</p>
          <Button className="mt-5 h-12 w-full rounded-xl text-base" onClick={() => setStatementDialog(true)} disabled={!branchCode}>
            <Plus className="size-5" />
            {t("accounting.dailyIncome.actions.createCloseout")}
          </Button>
        </div>
      )}

      {statement ? (
        <div className="space-y-4">
          <div className="grid gap-3">
            <Button className="h-12 rounded-xl text-base" onClick={openAddTransactionForm} disabled={statement.status !== "OPEN"}>
              <Plus className="size-5" />
              {t("accounting.dailyIncome.actions.addTransaction")}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-normal">{t("accounting.dailyIncome.transactions.title")}</h2>
              <span className="text-sm text-muted-foreground">{formatPaginatedListSummary({ itemCountOnPage: rows.length, page, pageSize: pageLimit, total, noun: t("accounting.dailyIncome.noun"), isLoading: journalsQuery.isFetching }, t)}</span>
            </div>
            <TableSearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder={t("accounting.dailyIncome.transactions.searchPlaceholder")}
              className="min-w-0"
              inputClassName="h-12 rounded-2xl border-0 bg-blue-50 text-base shadow-none"
            />
          </div>

          <TablePaginationControls
            layout="mobile"
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={journalsQuery.isLoading}
          />

          <div className="rounded-3xl bg-card px-4 shadow-sm">
            {journalsQuery.isError ? (
              <div className="py-8 text-sm text-destructive">{normalizeApiError(journalsQuery.error).message}</div>
            ) : journalsQuery.isLoading ? (
              <div className="py-8 text-sm text-muted-foreground">{t("accounting.dailyIncome.transactions.loadingTitle")}</div>
            ) : rows.length === 0 ? (
              <div className="py-8 text-sm text-muted-foreground">{t("accounting.dailyIncome.transactions.empty")}</div>
            ) : (
              rows.map((row) => (
                <DailyIncomeMobileTransactionRow
                  key={row.id}
                  row={row}
                  currency={displayCurrency}
                  canModify={statementOpen}
                  onView={() => setViewJournal(row)}
                  onEdit={() => openEditTransactionForm(row)}
                  onDelete={() => openDeleteTransaction(row)}
                  t={t}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>

    <div className="hidden md:block">
    <PageHeader title={t("accounting.dailyIncome.title")} description={t("accounting.dailyIncome.description")} actions={<>
      {statement ? (
        <Button
          variant="outline"
          onClick={() => setPrintDialog(true)}
          disabled={generateIncomeReportMutation.isPending}
        >
          <Printer className="h-4 w-4" />
          {t("accounting.dailyIncome.actions.printReport")}
        </Button>
      ) : null}
      {statement ? <Button variant="outline" onClick={() => setStatementDialog(true)}><Edit className="h-4 w-4" /> {t("accounting.dailyIncome.actions.editCloseout")}</Button> : <Button onClick={() => setStatementDialog(true)} disabled={!branchCode}><Plus className="h-4 w-4" /> {t("accounting.dailyIncome.actions.createCloseout")}</Button>}
      {statement ? <Button variant={statement.status === "OPEN" ? "destructive" : "default"} onClick={() => changeStatus(statement.status !== "OPEN")} disabled={statusMutation.isPending}>{statement.status === "OPEN" ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}{statement.status === "OPEN" ? t("accounting.dailyIncome.actions.closeDay") : t("accounting.dailyIncome.actions.reopenDay")}</Button> : null}
    </>} />

    {statement ? (
      summaryTotalsQuery.isError ? (
        <p className="mb-6 text-sm text-destructive">{normalizeApiError(summaryTotalsQuery.error).message}</p>
      ) : summaryTotalsQuery.isLoading ? (
        <p className="mb-6 text-sm text-muted-foreground">{t("accounting.dailyIncome.summary.loadingTotals")}</p>
      ) : stats.length > 0 ? (
        <StatCards items={stats} className="mb-6" />
      ) : null
    ) : null}

    <Card className="mb-6 gap-0 py-0">
      <CardContent className="flex flex-wrap items-start gap-4 py-4">
        <div className="flex w-fit flex-col gap-2">
          <Label htmlFor="daily-branch">{t("accounting.dailyIncome.filters.branch")}</Label>
          <SearchableSelect
            id="daily-branch"
            className="w-auto"
            truncateSelection={false}
            value={branchCode}
            onValueChange={(next) => {
              setBranchCode(next);
              setPage(1);
            }}
            options={branches.map((branch) => ({
              value: branch.code,
              label: `${branch.code} — ${branch.name}`,
              keywords: [branch.code, branch.name],
            }))}
            placeholder={t("accounting.dailyIncome.filters.selectBranch")}
            searchPlaceholder={t("accounting.dailyIncome.filters.searchBranches")}
          />
        </div>
        <div className="flex w-fit flex-col gap-2">
          <Label htmlFor="daily-date">{t("accounting.dailyIncome.filters.date")}</Label>
          <DateInput
            id="daily-date"
            className={toolbarFieldControlClassName}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex w-fit flex-col gap-2">
          <Label>{t("accounting.dailyIncome.filters.status")}</Label>
          <Badge
            className={
              statement?.status === "OPEN"
                ? "h-10 min-h-10 whitespace-nowrap rounded-lg border-2 border-transparent px-3 text-sm font-medium text-white hover:bg-emerald-600 bg-emerald-600"
                : statement
                  ? "h-10 min-h-10 whitespace-nowrap rounded-lg border-2 border-transparent px-3 text-sm font-medium text-white hover:bg-slate-600 bg-slate-600"
                  : "h-10 min-h-10 whitespace-nowrap rounded-lg border-2 border-transparent px-3 text-sm font-medium text-white hover:bg-amber-600 bg-amber-600"
            }
          >
            {statement
              ? t("accounting.dailyIncome.status.badge", {
                  status: statement.status === "OPEN" ? t("accounting.dailyIncome.status.open") : t("accounting.dailyIncome.status.closed"),
                  id: String(statement.id).padStart(5, "0"),
                })
              : t("accounting.dailyIncome.filters.noCloseout")}
          </Badge>
        </div>
      </CardContent>
    </Card>

    {statement ? <>
    <div className="mt-6 mb-3 flex items-center justify-between gap-3"><CardTitle>{t("accounting.dailyIncome.transactions.title")}</CardTitle><Button onClick={openAddTransactionForm} disabled={statement.status !== "OPEN"}><Plus className="h-4 w-4" /> {t("accounting.dailyIncome.actions.addTransaction")}</Button></div>

    <Card className="gap-0"><CardHeader className="gap-3 border-b py-4 pb-3"><TableDirectoryToolbar showFilterToggle={false} columnLayout={columnLayout} searchSummary={buildToolbarSearchSummary({ isFiltered: Boolean(deferredQuery.trim()), query: deferredQuery, isSearchPending: query !== deferredQuery, matched: total, catalogTotal: total, noun: t("accounting.dailyIncome.noun"), isLoading: journalsQuery.isLoading, catalogLoading: journalsQuery.isLoading }, t)} search={<TableSearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder={t("accounting.dailyIncome.transactions.searchPlaceholder")} />} /></CardHeader>
      {journalsQuery.isError ? <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(journalsQuery.error).message}</div> : journalsQuery.isLoading ? <DirectoryTableLoader icon={ScrollText} title={t("accounting.dailyIncome.transactions.loadingTitle")} description={t("accounting.dailyIncome.transactions.loadingDescription")} columns={[t("accounting.dailyIncome.columns.date"), t("accounting.dailyIncome.columns.accountInvoice"), t("accounting.dailyIncome.columns.assignedTo"), t("accounting.dailyIncome.columns.type"), t("accounting.dailyIncome.columns.reference"), t("accounting.dailyIncome.columns.amount")]} /> : <>
        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={rows.map((row) => row.id)}
          totalCount={total}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            if (selectedJournal) openEditTransactionForm(selectedJournal);
          }}
          onDelete={() => {
            if (selectedJournal) openDeleteTransaction(selectedJournal);
          }}
          canEdit={statementOpen}
          canDelete={statementOpen}
          deleteDisabled={deleteMutation.isPending}
        />
        <DataTable columns={columnLayout.columns} rows={rows} page={page} isPageDataPending={journalsQuery.isFetching} rowKey={(row) => row.id} rowLabel={(row) => transactionTypeLabel(row.transactionType, t)} columnLayout={columnLayout} minWidth={1100} selectable selectedIds={selectedIds} allPageSelected={allPageSelected} onToggleSelectAll={toggleSelectAll} onToggleSelect={toggleSelect} onRowClick={setViewJournal} onRowDoubleClick={statementOpen ? openEditTransactionForm : undefined} activeRowId={viewJournal?.id} emptyState={<p className="text-muted-foreground">{t("accounting.dailyIncome.transactions.empty")}</p>} />
      </>}
      {!journalsQuery.isLoading && !journalsQuery.isError ? <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{formatPaginatedListSummary({ itemCountOnPage: rows.length, page, pageSize: pageLimit, total, noun: t("accounting.dailyIncome.noun"), isLoading: journalsQuery.isFetching }, t)}</p><TablePaginationControls page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize} disabled={journalsQuery.isFetching} /></div> : null}
    </Card>
    </> : null}
    </div>

    <Dialog open={statementDialog} onOpenChange={(open) => { setStatementDialog(open); if (!open) setFormError(null); }}><DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90dvh] sm:w-[calc(100vw-2rem)] sm:max-w-xl sm:overflow-visible sm:rounded-xl sm:p-6"><DialogHeader className="shrink-0 border-b border-primary/20 bg-primary px-4 pb-4 pt-5 text-primary-foreground sm:border-0 sm:bg-transparent sm:p-0 sm:text-foreground"><div className="flex items-center justify-between gap-4"><DialogTitle className="text-2xl font-bold text-primary-foreground sm:text-lg sm:text-foreground">{statement ? t("accounting.dailyIncome.statement.editTitle") : t("accounting.dailyIncome.statement.createTitle")}</DialogTitle><button type="button" className="font-semibold text-primary-foreground sm:hidden" onClick={() => setStatementDialog(false)}>{t("common.actions.cancel")}</button></div><DialogDescription className="break-words text-primary-foreground/85 sm:text-muted-foreground">{statement ? t("accounting.dailyIncome.statement.editDescription") : t("accounting.dailyIncome.statement.description")}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:overflow-visible sm:p-0"><DailyIncomeStatementForm branches={branches} initialValues={statementValues} lockBranch={Boolean(statement)} isSubmitting={mutationPending} error={formError} onSubmit={saveStatement} onCancel={() => setStatementDialog(false)} /></div></DialogContent></Dialog>
    <DailyIncomePrintDialog
      open={printDialog}
      onOpenChange={setPrintDialog}
      date={date}
      employees={employees}
      isPending={generateIncomeReportMutation.isPending}
      onConfirm={handlePrintReport}
    />
    <Dialog open={transactionDialog} onOpenChange={(open) => { setTransactionDialog(open); if (!open) { setEditingJournal(null); setFormError(null); } }}><DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">{editingJournal && editInitialValues ? <AddTransactionWizard open={transactionDialog} mode="edit" appearance="phone" initialValues={editInitialValues} employees={employees} dailyRoutes={dailyRoutes} statementDate={statement?.date ?? date} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} /> : <AddTransactionWizard open={transactionDialog} mode="add" appearance="phone" employees={employees} dailyRoutes={dailyRoutes} statementDate={statement?.date ?? date} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} />}</DialogContent></Dialog>
    <DailyIncomeTransactionViewSheet
      journal={viewJournal}
      currency={displayCurrency}
      open={Boolean(viewJournal)}
      onOpenChange={(open) => {
        if (!open) setViewJournal(null);
      }}
      onEdit={openEditTransactionForm}
      onDelete={openDeleteTransaction}
      canEdit={statementOpen}
      canDelete={statementOpen}
    />
    <Dialog open={Boolean(deleteJournal)} onOpenChange={(open) => !open && setDeleteJournal(null)}><DialogContent><DialogHeader><DialogTitle>{t("accounting.dailyIncome.delete.title")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.delete.description")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteJournal(null)}>{t("common.actions.cancel")}</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (!deleteJournal) return; deleteMutation.mutateAsync(deleteJournal.id).then(() => { setDeleteJournal(null); feedback.notifyDeleted(t("accounting.dailyIncome.transactionNoun"), 1); }).catch((error) => feedback.notifyError(normalizeApiError(error).message)); }}>{t("common.actions.delete")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
