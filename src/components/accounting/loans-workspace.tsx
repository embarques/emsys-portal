"use client";

import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Plus,
  ReceiptText,
} from "lucide-react";
import { useMemo, useState } from "react";

import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import {
  DirectoryInsightsFlip,
  DirectoryInsightsToggle,
} from "@/components/app-shell/directory-insights-flip";
import type { LoanRecordAction } from "@/components/accounting/loan-record-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLoans, useLoanTransactions } from "@/lib/accounting/loans/hooks";
import {
  formatLoanDate,
  formatLoanMoney,
  getLoanBalanceMoneyClass,
  loanStatusLabel,
} from "@/lib/accounting/loans/display";
import { LOAN_TABLE_FILTER_FIELDS } from "@/lib/accounting/loans/filter-fields";
import {
  DEFAULT_LOAN_LIST_PARAMS,
  EMPTY_LOAN_SUMMARY,
  type Loan,
} from "@/lib/accounting/loans/types";
import { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { normalizeApiError } from "@/lib/api/axios";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useGenerateLoanReport } from "@/lib/reports/hooks/use-reports";
import {
  buildSelectedLoansReportRequest,
  downloadLoanExcelReport,
  openLoanReportUrl,
} from "@/lib/accounting/loans/print-loan-report";
import { LoanViewSheet } from "@/components/accounting/loan-view-sheet";
import {
  LoanWorkflowDialog,
  type LoanWorkflowKind,
} from "@/components/accounting/loan-workflow-dialog";
import { useTranslation } from "@/lib/i18n";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { useLocalizedFilterFields } from "@/lib/table/hooks/use-localized-filter-fields";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const LOANS_TABLE_COLUMN_STORAGE_KEY = "accounting-loans-v1";

type LoanFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

const defaultFilters: LoanFilterState = {
  query: "",
  rows: [],
};

function loanStatusClassName(status: Loan["status"]) {
  switch (status) {
    case "ACTIVE":
      return "border-transparent bg-emerald-100 text-emerald-700";
    case "PAID":
      return "border-transparent bg-slate-100 text-slate-700";
    case "VOID":
      return "border-transparent bg-rose-100 text-rose-700";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

function localizeLoanFilterOption(field: string, option: { value: string; label: string }, t: (key: string) => string) {
  return field === "status" ? { ...option, label: t(`accounting.loans.status.${option.value}`) } : option;
}

function accountLabel(account: { displayName?: string; name: string }) {
  return account.displayName ?? account.name;
}

function LoanMobileCard({
  loan,
  selected,
  onSelect,
}: {
  loan: Loan;
  selected: boolean;
  onSelect: (loan: Loan) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors",
        selected && "border-primary bg-primary/5",
      )}
      onClick={() => onSelect(loan)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{loan.employee.name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {loan.description || t("accounting.loans.fallbackDescription")}
          </p>
        </div>
        <Badge className={loanStatusClassName(loan.status)}>{loanStatusLabel(loan.status, t)}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("accounting.loans.details.balance")}</p>
          <p className={getLoanBalanceMoneyClass(loan.balance)}>{formatLoanMoney(loan.balance)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("accounting.loans.details.principal")}</p>
          <p className="font-semibold">{formatLoanMoney(loan.principalAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("accounting.loans.details.loanAccount")}</p>
          <p className="truncate font-medium">
            {loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("accounting.loans.details.lastActivity")}</p>
          <p className="font-medium">{formatLoanDate(loan.lastActivityAt) || "-"}</p>
        </div>
      </div>
    </button>
  );
}

export function LoansWorkspace() {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const [filters, setFilters] = useState<LoanFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [viewLoan, setViewLoan] = useState<Loan | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowKind, setWorkflowKind] = useState<LoanWorkflowKind | null>(null);
  const [paymentInitialLoan, setPaymentInitialLoan] = useState<Loan | null>(null);
  const [principalInitialLoan, setPrincipalInitialLoan] = useState<Loan | null>(null);
  const loanEntry = useLoanEntry();
  const debouncedQuery = useDebouncedValue(filters.query);
  const { sort, onSortChange } = useTableSort(DEFAULT_LOAN_LIST_PARAMS.sort, () => setPage(1));
  const loanFilterFields = useLocalizedFilterFields(
    LOAN_TABLE_FILTER_FIELDS,
    "accounting.loans.filters.fields",
    localizeLoanFilterOption,
  );
  const search = createApiListTextSearch(debouncedQuery);
  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort,
      search,
      filterRows: filters.rows,
    }),
    [filters.rows, page, search, sort],
  );
  const loansQuery = useLoans(listParams);
  const loanTransactionsQuery = useLoanTransactions(viewLoan?.id ?? null, Boolean(viewLoan));
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc", active: true });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500, sort: "displayName:asc" });
  const generateLoanReportMutation = useGenerateLoanReport();
  const loans = useMemo(() => loansQuery.data?.items ?? [], [loansQuery.data?.items]);
  const summary = loansQuery.data?.summary ?? EMPTY_LOAN_SUMMARY;
  const totalLoans = loansQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLoans / PAGE_SIZE));
  const pageRowIds = useMemo(() => loans.map((loan) => loan.id), [loans]);
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id));
  useTableSelectionReset(buildTableSelectionResetKey(debouncedQuery, filters.rows, sort), setSelectedIds);
  const paymentTransactions = useMemo(
    () =>
      (loanTransactionsQuery.data ?? [])
        .filter((transaction) => transaction.type === "PAYMENT")
        .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)),
    [loanTransactionsQuery.data],
  );
  const paymentHistoryError = loanTransactionsQuery.isError
    ? loanTransactionsQuery.error instanceof Error
      ? loanTransactionsQuery.error.message
      : t("accounting.loans.payments.loadError")
    : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, loanFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const employees = employeesQuery.data?.items ?? [];
  const accounts = accountsQuery.data?.items ?? [];
  const loanAccountFilterOptions = accounts
    .filter((account) => account.type === "LOAN")
    .map((account) => ({
      value: String(account.id),
      label: accountLabel(account),
    }));
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: loans.length,
      page,
      pageSize: PAGE_SIZE,
      total: totalLoans,
      noun: t("accounting.loans.noun"),
      isFiltered: hasActiveFilters,
      isLoading: loansQuery.isFetching,
    },
    t,
  );
  const stats = [
    {
      label: t("accounting.loans.stats.outstandingBalance"),
      value: formatLoanMoney(summary.outstandingBalance),
      description: t("accounting.loans.stats.outstandingBalanceDescription"),
      icon: Banknote,
    },
    {
      label: t("accounting.loans.stats.loanedInRange"),
      value: formatLoanMoney(summary.loanedInRange),
      description: t("accounting.loans.stats.loanedInRangeDescription"),
      icon: CreditCard,
    },
    {
      label: t("accounting.loans.stats.paidInRange"),
      value: formatLoanMoney(summary.paidInRange),
      description: t("accounting.loans.stats.paidInRangeDescription"),
      icon: ReceiptText,
    },
    {
      label: t("accounting.loans.stats.activeLoans"),
      value: summary.activeLoans.toLocaleString(),
      description: t("accounting.loans.stats.activeLoansDescription"),
      icon: FileText,
    },
  ];

  const insightMetrics = stats;

  const tableColumns: DataTableColumn<Loan>[] = useMemo(
    () => [
      {
        id: "employee.name",
        label: t("accounting.loans.columns.employee"),
        renderCell: (loan) => <span className="font-medium">{loan.employee.name}</span>,
      },
      {
        id: "loanAccount.name",
        label: t("accounting.loans.columns.loanAccount"),
        renderCell: (loan) => loan.loanAccount?.displayName ?? loan.loanAccount?.name ?? "-",
      },
      {
        id: "description",
        label: t("accounting.loans.columns.description"),
        renderCell: (loan) => loan.description || "-",
      },
      {
        id: "openedAt",
        label: t("accounting.loans.columns.opened"),
        renderCell: (loan) => formatLoanDate(loan.openedAt) || "-",
      },
      {
        id: "principalAmount",
        label: t("accounting.loans.columns.principalAmount"),
        renderCell: (loan) => formatLoanMoney(loan.principalAmount),
      },
      {
        id: "paidAmount",
        label: t("accounting.loans.columns.paid"),
        renderCell: (loan) => formatLoanMoney(loan.paidAmount),
      },
      {
        id: "balance",
        label: t("accounting.loans.columns.balance"),
        renderCell: (loan) => (
          <span className={getLoanBalanceMoneyClass(loan.balance)}>{formatLoanMoney(loan.balance)}</span>
        ),
      },
      {
        id: "status",
        label: t("accounting.loans.columns.status"),
        renderCell: (loan) => (
          <Badge className={loanStatusClassName(loan.status)}>{loanStatusLabel(loan.status, t)}</Badge>
        ),
      },
      {
        id: "lastActivityAt",
        label: t("accounting.loans.columns.lastActivity"),
        renderCell: (loan) => formatLoanDate(loan.lastActivityAt) || "-",
      },
    ],
    [t],
  );
  const columnVisibility = useColumnVisibility(LOANS_TABLE_COLUMN_STORAGE_KEY, tableColumns);

  function clearWorkflowSeeds() {
    setPaymentInitialLoan(null);
    setPrincipalInitialLoan(null);
  }

  function openNewLoan() {
    if (!loanEntry.openCreate) return;
    clearWorkflowSeeds();
    setWorkflowKind("issue");
    setWorkflowOpen(true);
  }

  function openLoanAction(loan: Loan, action: LoanRecordAction) {
    if (action === "payment") {
      if (!loanEntry.openPayment) return;
      setPaymentInitialLoan(loan);
      setPrincipalInitialLoan(null);
      setWorkflowKind("payment");
      setWorkflowOpen(true);
      return;
    }
    if (action === "increase") {
      // TODO(backend): loan increase API / NEXT_PUBLIC_LOAN_INCREASE_ENABLED gate.
      if (!loanEntry.openIncrease) {
        notifyError(t("accounting.loans.recordActions.increaseTodo"));
        return;
      }
      setPaymentInitialLoan(null);
      setPrincipalInitialLoan(loan);
      setWorkflowKind("increase");
      setWorkflowOpen(true);
      return;
    }
    if (action === "decrease") {
      if (!loanEntry.openDecrease || loan.status !== "ACTIVE" || loan.balance <= 0) return;
      setPaymentInitialLoan(null);
      setPrincipalInitialLoan(loan);
      setWorkflowKind("decrease");
      setWorkflowOpen(true);
    }
  }

  async function handlePrintLoan(loan: Loan) {
    try {
      const report = await generateLoanReportMutation.mutateAsync(
        buildSelectedLoansReportRequest([loan], "pdf"),
      );
      openLoanReportUrl(report.url);
      notifySuccess(t("accounting.loans.payments.printSuccess"));
    } catch (error) {
      notifyError(normalizeApiError(error).message || t("accounting.loans.payments.printError"));
    }
  }

  async function handleExportExcelLoan(loan: Loan) {
    try {
      const report = await generateLoanReportMutation.mutateAsync(
        buildSelectedLoansReportRequest([loan], "excel"),
      );
      await downloadLoanExcelReport(report);
      notifySuccess(t("accounting.loans.payments.excelSuccess"));
    } catch (error) {
      notifyError(normalizeApiError(error).message || t("accounting.loans.payments.excelError"));
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageRowIds])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageRowIds.includes(id)));
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id),
    );
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
  }

  return (
    <div>
      <div className="hidden md:block">
        <PageHeader
          title={t("accounting.loans.page.title")}
          description={t("accounting.loans.page.description")}
          actions={
            <Button disabled={!loanEntry.openCreate} onClick={openNewLoan}>
              <Plus className="h-4 w-4" />
              {t("accounting.loans.actions.newLoan")}
            </Button>
          }
        />

        <StatCards items={stats} />

        <DirectoryInsightsFlip
          open={insightsOpen}
          onOpenChange={setInsightsOpen}
          metrics={insightMetrics}
          title={t("accounting.loans.page.title")}
          className="mt-6"
        >
        <Card className="gap-0">
          <CardHeader className="gap-3 border-b py-4 pb-3">
            <TableDirectoryToolbar
              filtersOpen={filtersOpen}
              onFiltersOpenChange={setFiltersOpen}
              activeFilterCount={activeFilterCount}
              columnLayout={columnVisibility}
              actions={
                <DirectoryInsightsToggle open={insightsOpen} onOpenChange={setInsightsOpen} />
              }
              search={
                <TableSearchInput
                  value={filters.query}
                  onChange={(query) => {
                    setFilters((current) => ({ ...current, query }));
                    setPage(1);
                  }}
                  placeholder={t("accounting.loans.table.searchPlaceholder")}
                />
              }
              filterPanel={
                <TableFilterPanel
                  isLoading={loansQuery.isFetching || filters.query.trim() !== debouncedQuery.trim()}
                  resultSummary={listSummary}
                  presets={{
                    storageKey: "accounting-loans",
                    rows: filters.rows,
                    fields: loanFilterFields,
                    onApply: (rows) => {
                      setFilters((current) => ({ ...current, rows }));
                      setPage(1);
                    },
                  }}
                  onClearAll={hasActiveFilters ? resetFilters : undefined}
                >
                  <TableAdvancedFilterBuilder
                    open={filtersOpen}
                    rows={filters.rows}
                    fields={loanFilterFields}
                    dynamicOptions={{ loanAccounts: loanAccountFilterOptions }}
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
            pageRowIds={pageRowIds}
            totalCount={totalLoans}
            onSelectedIdsChange={setSelectedIds}
            canEdit={false}
            canDelete={false}
          />

          {loansQuery.isError ? (
            <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
              {loansQuery.error instanceof Error
                ? loansQuery.error.message
                : t("accounting.loans.table.loadError")}
            </div>
          ) : null}

          {loansQuery.isPending && loans.length === 0 ? (
            <DirectoryTableLoader
              icon={Banknote}
              title={t("accounting.loans.table.loadingTitle")}
              description={t("accounting.loans.table.loadingDescription")}
              columns={[
                t("accounting.loans.columns.employee"),
                t("accounting.loans.columns.loanAccount"),
                t("accounting.loans.columns.balance"),
                t("accounting.loans.columns.status"),
              ]}
            />
          ) : (
            <DataTable
              columns={columnVisibility.columns}
              rows={loans}
              page={page}
              isPageDataPending={
                loansQuery.isFetching || filters.query.trim() !== debouncedQuery.trim()
              }
              rowKey={(loan) => loan.id}
              rowLabel={(loan) => loan.employee.name}
              columnLayout={columnVisibility}
              minWidth={1320}
              sort={sort}
              onSortChange={onSortChange}
              selectable
              selectedIds={selectedIds}
              allPageSelected={allPageSelected}
              onToggleSelectAll={toggleSelectAll}
              onToggleSelect={toggleSelect}
              onRowClick={setViewLoan}
              activeRowId={viewLoan?.id}
              emptyState={
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? t("accounting.loans.table.empty")
                      : t("accounting.loans.table.emptyNone")}
                  </p>
                  <Button className="mt-4" disabled={!loanEntry.openCreate} onClick={openNewLoan}>
                    <Plus className="h-4 w-4" />
                    {t("accounting.loans.actions.newLoan")}
                  </Button>
                </div>
              }
            />
          )}

          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{listSummary}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common.actions.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.pagination.pageOf", { current: page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
        </DirectoryInsightsFlip>
      </div>

      <div className="space-y-5 md:hidden">
        <div className="rounded-b-3xl bg-primary px-4 pb-6 pt-5 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-normal">{t("accounting.loans.page.title")}</h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {t("accounting.loans.page.mobileSubtitle")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                disabled={!loanEntry.openCreate}
                onClick={openNewLoan}
                aria-label={t("accounting.loans.actions.newLoan")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4">
          <TableSearchInput
            isLoading={loansQuery.isFetching || filters.query.trim() !== debouncedQuery.trim()}
            value={filters.query}
            onChange={(query) => {
              setFilters((current) => ({ ...current, query }));
              setPage(1);
            }}
            placeholder={t("accounting.loans.table.searchPlaceholder")}
            inputClassName="h-12 rounded-2xl border-border bg-background text-base text-foreground shadow-none"
          />
          <div className="mt-3">
            <TableDirectoryToolbar
              search={<div />}
              filtersOpen={filtersOpen}
              onFiltersOpenChange={setFiltersOpen}
              activeFilterCount={activeFilterCount}
              filterPanel={
                <TableFilterPanel
                  isLoading={loansQuery.isFetching || filters.query.trim() !== debouncedQuery.trim()}
                  resultSummary={listSummary}
                  onClearAll={hasActiveFilters ? resetFilters : undefined}
                >
                  <TableAdvancedFilterBuilder
                    open={filtersOpen}
                    rows={filters.rows}
                    fields={loanFilterFields}
                    dynamicOptions={{ loanAccounts: loanAccountFilterOptions }}
                    onChange={(rows) => {
                      setFilters((current) => ({ ...current, rows }));
                      setPage(1);
                    }}
                  />
                </TableFilterPanel>
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-4">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.actions.previous")}
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {t("common.pagination.pageOf", { current: page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            {t("common.actions.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 px-4 pb-8">
          {loansQuery.isPending && loans.length === 0 ? (
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              {t("accounting.loans.table.loading")}
            </div>
          ) : loans.length === 0 ? (
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              {hasActiveFilters
                ? t("accounting.loans.table.empty")
                : t("accounting.loans.table.emptyNone")}
            </div>
          ) : (
            loans.map((loan) => (
              <LoanMobileCard
                key={loan.id}
                loan={loan}
                selected={viewLoan?.id === loan.id}
                onSelect={setViewLoan}
              />
            ))
          )}
        </div>
      </div>

      <LoanViewSheet
        loan={viewLoan}
        open={Boolean(viewLoan)}
        onOpenChange={(open) => {
          if (!open) setViewLoan(null);
        }}
        payments={paymentTransactions}
        paymentsLoading={loanTransactionsQuery.isPending}
        paymentsError={paymentHistoryError}
        canPay={Boolean(loanEntry.openPayment)}
        canIncrease={Boolean(loanEntry.openIncrease)}
        canDecrease={Boolean(loanEntry.openDecrease)}
        showIncreaseTodo={
          Boolean(loanEntry.openPayment || loanEntry.openDecrease) && !loanEntry.openIncrease
        }
        isPrinting={generateLoanReportMutation.isPending}
        onPrint={handlePrintLoan}
        onExportExcel={handleExportExcelLoan}
        onAction={openLoanAction}
      />

      <LoanWorkflowDialog
        open={workflowOpen}
        kind={workflowKind}
        entry={loanEntry}
        initialLoan={
          workflowKind === "increase" || workflowKind === "decrease"
            ? principalInitialLoan
            : workflowKind === "payment"
              ? paymentInitialLoan
              : null
        }
        employees={employees}
        accounts={accounts}
        onConsumedInitialLoan={clearWorkflowSeeds}
        onOpenChange={(open) => {
          setWorkflowOpen(open);
          if (!open) {
            setWorkflowKind(null);
            clearWorkflowSeeds();
          }
        }}
      />
    </div>
  );
}
