"use client";
import {JournalTransactionsTable} from "@/components/accounting/journal-transactions-table";


import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronUp, Plus, Printer } from "lucide-react";

import { TransactionCloseoutSetup } from "@/components/accounting/transaction-closeout-setup";
import { useStartTransaction } from "@/lib/accounting/daily-income/use-start-transaction";
import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { DailyIncomePrintDialog, type DailyIncomePrintSelection } from "@/components/accounting/daily-income-print-dialog";
import { DailyIncomeTransactionViewSheet } from "@/components/accounting/daily-income-transaction-view-sheet";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards, type StatCardItem } from "@/components/app-shell/stat-cards-carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloseoutDateNavigation } from "@/components/accounting/closeout-date-navigation";
import { CloseoutRolloverDialog } from "@/components/accounting/closeout-rollover-dialog";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useChartAccounts,
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
  useDailyIncomeJournal,
  useDeleteDailyIncomeJournal,
  useIncomeStatement,
  useCurrentIncomeStatement,
  useIncomeStatementSummaryTotals,
  useCloseoutCalendar,
  useUpdateDailyIncomeJournal,

} from "@/lib/accounting/daily-income/hooks";
import { journalToFormValues, areDailyIncomeJournalValuesEquivalent, journalCreatedToastMessage, transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import { buildIncomeReportRequest, openIncomeReportUrl } from "@/lib/accounting/daily-income/print-income-report";
import { fetchIncomeStatement } from "@/lib/accounting/daily-income/api";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement } from "@/lib/accounting/daily-income/types";
import {
  dailyIncomeCurrencyDescription,
  formatDailyIncomeMoney,
  getDailyIncomeCurrencyIcon,
} from "@/lib/accounting/daily-income/display";
import { formatAccountingDate } from "@/lib/accounting/display";
import { isDuplicatePaymentWarning, type JournalWriteOptions } from "@/lib/accounting/daily-income/duplicate-payment";
import { normalizeApiError } from "@/lib/api/axios";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useTranslation } from "@/lib/i18n";
import { useGenerateReport, useGenerateIncomeReport } from "@/lib/reports/hooks/use-reports";
import { cn } from "@/lib/utils";

import { buildPaymentReceiptRequest, } from "@/lib/accounting/daily-income/print-payment-receipt";

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

/** Keep deposits separate and put the primary daily-income totals first. */
function ensureDepositStatAndOrder(
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

  const isZelle = (label: string) => label.toLowerCase().includes("zelle");
  const zelleSource = stats.find((stat) => isZelle(stat.label)) ?? stats.flatMap((stat) =>
    (stat.details ?? []).filter((detail) => isZelle(detail.label)).map((detail) => ({ ...detail, description: stat.description, icon: stat.icon })),
  )[0];
  const zelleStat: StatCardItem = {
    label: "Zelle",
    value: zelleSource?.value ?? options.zeroValue,
    description: zelleSource?.description ?? template?.description,
    icon: zelleSource?.icon ?? template?.icon,
  };
  const remainingStats = cleanedStats.filter((stat) => !isZelle(stat.label)).map((stat) => {
    const details = stat.details?.filter((detail) => !isZelle(detail.label));
    return { ...stat, details: details?.length ? details : undefined };
  });

  const priority = (stat: StatCardItem) => {
    const label = stat.label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    if (isTotalCashSummaryLabel(stat.label)) return 0;
    if (label === "total ingresos" || label === "total income") return 1;
    if (isExpenseSummaryLabel(stat.label)) return 2;
    if (label === "otros ingresos" || label === "other income" || label === "other incomes") return 3;
    if (isDepositSummaryLabel(stat.label)) return 4;
    if (isZelle(stat.label)) return 5;
    return 6;
  };
  return [...remainingStats, depositStat, zelleStat].sort((left, right) => priority(left) - priority(right));
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (error) {
    return <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  }

  if (loading) {
    return <p className="rounded-2xl border bg-card px-4 py-5 text-sm text-muted-foreground">{t("accounting.dailyIncome.summary.loadingTotals")}</p>;
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

export function DailyIncomeWorkspace() {
  const currentUser = useCurrentUser();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();
  const feedback = useFeedback();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const [branchCode, setBranchCode] = useState("");
  const [requestedBranchId, setRequestedBranchId] = useState<number | null>(null);
  const [selectedDate, setDate] = useState("");
  const [statementDialog, setStatementDialog] = useState(false);
  const [printDialog, setPrintDialog] = useState(false);
  const [transactionDialog, setTransactionDialog] = useState(false);
  const [editingJournal, setEditingJournal] = useState<DailyIncomeJournal | null>(null);
  const [viewJournal, setViewJournal] = useState<DailyIncomeJournal | null>(null);
  const [deleteJournal, setDeleteJournal] = useState<DailyIncomeJournal | null>(null);
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
    if (branchCode || (!requestedBranchId && currentUser.isLoading)) return;
    const requestedBranch = branches.find((branch) => branch.id === requestedBranchId);
    const nextBranchCode = requestedBranch?.code ?? branches.find(branch=>branch.id===currentUser.data?.branch.id)?.code ?? branches[0]?.code;
    if (nextBranchCode) setBranchCode(nextBranchCode);
  }, [branchCode, branches, requestedBranchId,branches.find(branch=>branch.id===currentUser.data?.branch.id)?.code,currentUser.isLoading]);
  const selectedBranch = branches.find((branch) => branch.code === branchCode);
  const calendar = useCloseoutCalendar(selectedBranch?.id ?? 0);
  const serverToday = calendar.data?.today ?? "";
  const currentStatementQuery = useCurrentIncomeStatement(selectedBranch?.id ?? 0);
  const transactionStatement = currentStatementQuery.data ?? null;
  const historicalStatementQuery = useIncomeStatement(selectedBranch?.id ?? 0, selectedDate);
  const statementQuery = selectedDate ? historicalStatementQuery : currentStatementQuery;
  const currentDate = currentStatementQuery.data?.date.slice(0, 10) ?? "";
  const date = selectedDate || currentDate || serverToday;
  const statement = statementQuery.data ?? null;
  useEffect(() => {
    if (!openCreateOnLoad) return;
    if (statementQuery.isLoading) return;
    if (!branchCode) return;
    if (!statement) setStatementDialog(true);
    setOpenCreateOnLoad(false);
  }, [branchCode, openCreateOnLoad, statement, statementQuery.isLoading]);
  const summaryTotalsQuery = useIncomeStatementSummaryTotals(statement?.id ?? 0);

  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const dailyRoutesQuery = useDailyRoutePicker(200);
  const dailyRoutes = dailyRoutesQuery.data?.items ?? [];
  // Only invoices with an outstanding balance can receive a payment. The API search
  // allowlist has no `balance` field, so filter by paidStatus != CLOSED (OPEN or PARTIAL).
  const invoicesQuery = useInvoices({
    page: 1,
    limit: 200,
    sort: "number:desc",
    filterRows: [{ id: "payment-outstanding", join: "and", field: "paidStatus", operator: "neq", value: "CLOSED" }],
  });
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

  const createJournal = useCreateDailyIncomeJournal();
  const updateJournal = useUpdateDailyIncomeJournal();
  const deleteMutation = useDeleteDailyIncomeJournal();
  const generateIncomeReportMutation = useGenerateIncomeReport();
  const generateReceiptMutation = useGenerateReport();
  const startTransaction = useStartTransaction(selectedBranch, openAddTransactionForm);
  const displayCurrency = statement?.currency || "USD";
  const statementOpen = statement?.id === calendar.data?.current?.id && statement?.status === "OPEN" && selectedBranch?.id === currentUser.data?.branch.id;

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

    return ensureDepositStatAndOrder(nextStats, {
      label: t("accounting.dailyIncome.summary.totalDeposited"),
      zeroValue: formatAmount(0),
    });
  }, [summaryTotalsQuery.data, summaryTotalsQuery.isFetching, summaryTotalsQuery.isLoading, t]);


  function saveJournal(values: DailyIncomeJournalValues, options?: JournalWriteOptions): Promise<void> {
    const saveStatement = editingJournal ? statement : transactionStatement;
    if (!saveStatement) return Promise.reject(new Error(t("accounting.dailyIncome.errors.noCloseoutLoaded")));
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
      ? updateJournal.mutateAsync({ id: editingJournal.id, statement: saveStatement, values, options })
      : createJournal.mutateAsync({ statement: saveStatement, values, options })
    )
      .then(async (journal) => {
        if (editingJournal) {
          feedback.notifySuccess(t("accounting.dailyIncome.toasts.transactionUpdated"));
          setTransactionDialog(false);
          setEditingJournal(null);
          return;
        }

        if (journal?.incomeStatementId && journal.incomeStatementId !== saveStatement.id) {
          const [current] = await Promise.all([calendar.refetch(), currentStatementQuery.refetch()]);
          if (current.data?.current?.id === journal.incomeStatementId) setDate("");
        }
        feedback.notifySuccess(journalCreatedToastMessage({ ...values, invoiceNumber: journal?.invoice?.number || values.invoiceNumber }, t));
      })
      .catch((error) => {
        if (isDuplicatePaymentWarning(error) && !options?.allowDuplicatePayment) throw error;
        setFormError(normalizeApiError(error).message);
        return Promise.reject(error);
      });
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

  async function printReceipt(journal: DailyIncomeJournal) {
    if (generateReceiptMutation.isPending) return;
    try {
      const receipt = await generateReceiptMutation.mutateAsync(buildPaymentReceiptRequest(journal));
      openIncomeReportUrl(receipt.url);
      feedback.notifySuccess(t("accounting.dailyIncome.toasts.reportReady"));
    } catch (error) {
      feedback.notifyError(normalizeApiError(error).message);
    }
  }

  function openAddTransactionForm(nextStatement: DailyIncomeStatement) {
    setDate("");
    if (isDesktopTabs) {
      openFormTab({
        feature: "daily-income-transactions",
        baseHref: "/accounting/daily-income",
        mode: "add",
        entityId: String(nextStatement.id),
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
    {startTransaction.error && !startTransaction.setupOpen && <p role="alert" className="mb-4 text-sm text-destructive">{startTransaction.error}</p>}
    {startTransaction.setupOpen && <TransactionCloseoutSetup pending={startTransaction.isPending} error={startTransaction.error} onSubmit={(values) => void startTransaction.start(values)} onCancel={startTransaction.cancel} />}
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
            <CloseoutDateNavigation id="daily-date-mobile" date={date} today={serverToday || date} onChange={(next) => { setDate(next);  }} />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span>{calendar.data?.serverTimezone}</span>{[calendar.data?.previous,calendar.data?.current].filter((item):item is DailyIncomeStatement=>Boolean(item)).map(item=><Button key={item.id} variant="outline" disabled={date===item.date} onClick={()=>{setDate(item.date);}}>#{item.id} · {item.date} · {item.timezone}</Button>)}</div>

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

          {hasPermission("canCreateIncomeStatement", "income_statement") && selectedBranch?.id === currentUser.data?.branch.id ? (
            <Button className="mt-5 h-12 w-full rounded-xl text-base" onClick={() => setStatementDialog(true)} disabled={!serverToday}>
              <Plus className="size-5" />
              {t("accounting.dailyIncome.actions.createCloseout")}
            </Button>
          ) : null}
        </div>
      )}


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
      {!calendar.data?.current && hasPermission("canCreateIncomeStatement","income_statement") && selectedBranch?.id === currentUser.data?.branch?.id ? <Button onClick={() => setStatementDialog(true)} disabled={!serverToday}><Plus className="h-4 w-4" />{t("accounting.dailyIncome.actions.createCloseout")}</Button> : null}
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
          <CloseoutDateNavigation id="daily-date" date={date} today={serverToday || date} onChange={(next) => { setDate(next);  }} />
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

    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span>{calendar.data?.serverTimezone}</span>{[calendar.data?.previous,calendar.data?.current].filter((item):item is DailyIncomeStatement=>Boolean(item)).map(item=><Button key={item.id} variant="outline" disabled={date===item.date} onClick={()=>{setDate(item.date);}}>#{item.id} · {item.date} · {item.timezone}</Button>)}</div>

    <div className="mt-6 mb-3 flex items-center justify-between gap-3"><CardTitle>{t("accounting.dailyIncome.transactions.title")}</CardTitle><Button onClick={() => void startTransaction.start()} disabled={!startTransaction.canStart || startTransaction.isPending}><Plus className="h-4 w-4" /> {t("accounting.dailyIncome.actions.addTransaction")}</Button></div>
    </div>

    <div className="flex items-center justify-between gap-3 md:hidden"><h2 className="text-xl font-semibold">{t("accounting.dailyIncome.transactions.title")}</h2><Button onClick={() => void startTransaction.start()} disabled={!startTransaction.canStart || startTransaction.isPending}><Plus className="size-4"/>{t("accounting.dailyIncome.actions.addTransaction")}</Button></div>
    {statement ? <JournalTransactionsTable key={`${currentUser.data?.id}:${statement.id}`} incomeStatementId={statement.id} isPrintingReceipt={generateReceiptMutation.isPending} onView={setViewJournal} onPrintReceipt={journal => void printReceipt(journal)} /> : null}

    {statementDialog ? <CloseoutRolloverDialog open={statementDialog} onOpenChange={setStatementDialog} onReady={async created=>{setBranchCode(created.branch?.code??branchCode);setDate(created.date);await calendar.refetch();}} /> : null}
    <DailyIncomePrintDialog
      open={printDialog}
      onOpenChange={setPrintDialog}
      date={date}
      employees={employees}
      isPending={generateIncomeReportMutation.isPending}
      onConfirm={handlePrintReport}
    />
    <Dialog open={transactionDialog} onOpenChange={(open) => { setTransactionDialog(open); if (!open) { setEditingJournal(null); setFormError(null); } }}><DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">{editingJournal && editInitialValues ? <AddTransactionWizard open={transactionDialog} mode="edit" appearance="phone" initialValues={editInitialValues} employees={employees} dailyRoutes={dailyRoutes} statementDate={(editingJournal ? statement : transactionStatement)?.date ?? date} statementBranchId={(editingJournal ? statement : transactionStatement)?.branch?.id ?? selectedBranch?.id} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} /> : <AddTransactionWizard open={transactionDialog} mode="add" appearance="phone" employees={employees} dailyRoutes={dailyRoutes} statementDate={(editingJournal ? statement : transactionStatement)?.date ?? date} statementBranchId={(editingJournal ? statement : transactionStatement)?.branch?.id ?? selectedBranch?.id} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} />}</DialogContent></Dialog>
    <DailyIncomeTransactionViewSheet
      journal={viewJournal}
      currency={displayCurrency}
      open={Boolean(viewJournal)}
      onOpenChange={(open) => {
        if (!open) setViewJournal(null);
      }}
      onEdit={openEditTransactionForm}
      onDelete={openDeleteTransaction}
      onPrintReceipt={(journal) => void printReceipt(journal)}
      isPrintingReceipt={generateReceiptMutation.isPending}
      canEdit={false}
      canDelete={false}
    />
    <Dialog open={Boolean(deleteJournal)} onOpenChange={(open) => !open && setDeleteJournal(null)}><DialogContent><DialogHeader><DialogTitle>{t("accounting.dailyIncome.delete.title")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.delete.description")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteJournal(null)}>{t("common.actions.cancel")}</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (!deleteJournal) return; deleteMutation.mutateAsync(deleteJournal.id).then(() => { setViewJournal((current) => current?.id === deleteJournal.id ? null : current); setDeleteJournal(null); feedback.notifyDeleted(t("accounting.dailyIncome.transactionNoun"), 1); }).catch((error) => feedback.notifyError(normalizeApiError(error).message)); }}>{t("common.actions.delete")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
