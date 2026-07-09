"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit, Lock, LockOpen, Plus, ScrollText } from "lucide-react";

import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { DailyIncomeStatementForm } from "@/components/accounting/daily-income-statement-form";
import { DataTable } from "@/components/app-shell/data-table";
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
  useDailyIncomeJournals,
  useDeleteDailyIncomeJournal,
  useIncomeStatement,
  useIncomeStatementSummaryTotals,
  useSetIncomeStatementStatus,
  useUpdateDailyIncomeJournal,
  useUpdateIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import { isPaymentReceiptEligible, printPaymentReceipt } from "@/lib/accounting/daily-income/receipt";
import { getTransactionAssigneeDisplayName } from "@/lib/accounting/daily-income/assignee";
import { journalToFormValues, transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import {
  dailyIncomeCurrencyDescription,
  formatDailyIncomeMoney,
  getDailyIncomeCurrencyIcon,
} from "@/lib/accounting/daily-income/display";
import { normalizeApiError } from "@/lib/api/axios";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { useTranslation } from "@/lib/i18n";
import {
  buildTableSelectionResetKey,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 20;

const toolbarFieldControlClassName =
  "h-10 w-auto rounded-lg border-2 border-foreground/60 bg-card shadow-none focus-visible:border-foreground focus-visible:ring-0";

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailyIncomeWorkspace() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const [branchCode, setBranchCode] = useState("");
  const [requestedBranchId, setRequestedBranchId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statementDialog, setStatementDialog] = useState(false);
  const [transactionDialog, setTransactionDialog] = useState(false);
  const [editingJournal, setEditingJournal] = useState<DailyIncomeJournal | null>(null);
  const [deleteJournal, setDeleteJournal] = useState<DailyIncomeJournal | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? [];
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get("date")?.slice(0, 10);
    const branchId = Number(params.get("branchId"));
    if (requestedDate) setDate(requestedDate);
    if (Number.isInteger(branchId) && branchId > 0) setRequestedBranchId(branchId);
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
  const summaryTotalsQuery = useIncomeStatementSummaryTotals(statement?.id ?? 0);
  const journalsQuery = useDailyIncomeJournals({ incomeStatementId: statement?.id ?? 0, page, limit: PAGE_SIZE, query: deferredQuery });
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const invoicesQuery = useInvoices({ page: 1, limit: 200, sort: "number:desc" });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, transactionDialog);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, transactionDialog);
  const paymentMethodsQuery = useAccountingPaymentMethods(transactionDialog);
  const createStatement = useCreateIncomeStatement();
  const updateStatement = useUpdateIncomeStatement();
  const statusMutation = useSetIncomeStatementStatus();
  const createJournal = useCreateDailyIncomeJournal();
  const updateJournal = useUpdateDailyIncomeJournal();
  const deleteMutation = useDeleteDailyIncomeJournal();
  const rows = journalsQuery.data?.items ?? [];
  const total = journalsQuery.data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
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

    return summary.totals.map((total) => ({
      label: total.header,
      value: summaryTotalsQuery.isFetching && !summaryTotalsQuery.isLoading ? "…" : formatAmount(total.value),
      description,
      icon,
      details: total.details?.map((detail) => ({
        label: detail.header,
        value: formatAmount(detail.value),
      })),
    }));
  }, [summaryTotalsQuery.data, summaryTotalsQuery.isFetching, summaryTotalsQuery.isLoading, t]);

  const columns: DataTableColumn<DailyIncomeJournal>[] = useMemo(() => [
    { id: "date", label: t("accounting.dailyIncome.columns.date"), renderCell: (row) => row.date || t("common.empty.dash") },
    { id: "invoice", label: t("accounting.dailyIncome.columns.accountInvoice"), renderCell: (row) => row.invoice?.number ?? row.account?.displayName ?? row.account?.name ?? t("common.empty.dash") },
    { id: "employee", label: t("accounting.dailyIncome.columns.employee"), renderCell: (row) => getTransactionAssigneeDisplayName(row.employee?.name, row.employeeGroup?.name) || t("common.empty.dash") },
    { id: "type", label: t("accounting.dailyIncome.columns.type"), truncateCell: false, renderCell: (row) => <TableTagText>{transactionTypeLabel(row.transactionType, t)}</TableTagText> },
    { id: "reference", label: t("accounting.dailyIncome.columns.reference"), renderCell: (row) => row.refNumber || t("common.empty.dash") },
    { id: "paymentMethod", label: t("accounting.dailyIncome.columns.paymentMethod"), renderCell: (row) => row.paymentMethod?.name ?? t("common.empty.dash") },
    { id: "amount", label: t("accounting.dailyIncome.columns.amount"), cellClassName: "font-medium tabular-nums", renderCell: (row) => formatDailyIncomeMoney(row.amount, displayCurrency) },
  ], [displayCurrency, t]);
  const columnLayout = useColumnVisibility("daily-income-v1", columns);
  const statementValues: DailyIncomeStatementValues = { date, branchId: selectedBranch?.id ?? 0, branchCode, branchName: selectedBranch?.name ?? "", currency: statement?.currency ?? "USD", rate: statement?.rate ?? 1 };
  const mutationPending = createStatement.isPending || updateStatement.isPending;

  function saveStatement(values: DailyIncomeStatementValues) {
    setFormError(null);
    const action = statement ? updateStatement.mutateAsync({ id: statement.id, values }) : createStatement.mutateAsync(values);
    action.then(() => { setStatementDialog(false); setBranchCode(values.branchCode); setDate(values.date); feedback.notifySuccess(statement ? t("accounting.dailyIncome.toasts.statementUpdated") : t("accounting.dailyIncome.toasts.statementCreated")); }).catch((error) => setFormError(normalizeApiError(error).message));
  }
  function saveJournal(values: DailyIncomeJournalValues): Promise<void> {
    if (!statement) return Promise.reject(new Error(t("accounting.dailyIncome.errors.noCloseoutLoaded")));
    setFormError(null);
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

        feedback.notifySuccess(t("accounting.dailyIncome.toasts.transactionCreated"));
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

  return <div>
    <PageHeader title={t("accounting.dailyIncome.title")} description={t("accounting.dailyIncome.description")} actions={<>
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
      {journalsQuery.isError ? <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(journalsQuery.error).message}</div> : journalsQuery.isLoading ? <DirectoryTableLoader icon={ScrollText} title={t("accounting.dailyIncome.transactions.loadingTitle")} description={t("accounting.dailyIncome.transactions.loadingDescription")} columns={[t("accounting.dailyIncome.columns.date"), t("accounting.dailyIncome.columns.accountInvoice"), t("accounting.dailyIncome.columns.employee"), t("accounting.dailyIncome.columns.type"), t("accounting.dailyIncome.columns.reference"), t("accounting.dailyIncome.columns.amount")]} /> : <>
        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={rows.map((row) => row.id)}
          totalCount={total}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            if (selectedJournal) openEditTransactionForm(selectedJournal);
          }}
          onDelete={() => {
            if (selectedJournal) setDeleteJournal(selectedJournal);
          }}
          canEdit={statementOpen}
          canDelete={statementOpen}
          deleteDisabled={deleteMutation.isPending}
        />
        <DataTable columns={columnLayout.columns} rows={rows} page={page} isPageDataPending={journalsQuery.isFetching} rowKey={(row) => row.id} rowLabel={(row) => transactionTypeLabel(row.transactionType, t)} columnLayout={columnLayout} minWidth={1100} selectable selectedIds={selectedIds} allPageSelected={allPageSelected} onToggleSelectAll={toggleSelectAll} onToggleSelect={toggleSelect} emptyState={<p className="text-muted-foreground">{t("accounting.dailyIncome.transactions.empty")}</p>} />
      </>}
      {!journalsQuery.isLoading && !journalsQuery.isError ? <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{formatPaginatedListSummary({ itemCountOnPage: rows.length, page, pageSize: PAGE_SIZE, total, noun: t("accounting.dailyIncome.noun"), isLoading: journalsQuery.isFetching }, t)}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /> {t("common.actions.previous")}</Button><span className="px-2 text-sm text-muted-foreground">{t("common.pagination.pageOf", { current: page, total: totalPages })}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{t("common.actions.next")} <ChevronRight className="h-4 w-4" /></Button></div></div> : null}
    </Card>
    </> : null}

    <Dialog open={statementDialog} onOpenChange={(open) => { setStatementDialog(open); if (!open) setFormError(null); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{statement ? t("accounting.dailyIncome.statement.editTitle") : t("accounting.dailyIncome.statement.createTitle")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.statement.description")}</DialogDescription></DialogHeader><DailyIncomeStatementForm branches={branches} initialValues={statementValues} isSubmitting={mutationPending} error={formError} onSubmit={saveStatement} onCancel={() => setStatementDialog(false)} /></DialogContent></Dialog>
    <Dialog open={transactionDialog} onOpenChange={(open) => { setTransactionDialog(open); if (!open) { setEditingJournal(null); setFormError(null); } }}><DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">{editingJournal ? <AddTransactionWizard open={transactionDialog} mode="edit" initialValues={journalToFormValues(editingJournal)} employees={employees} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} /> : <AddTransactionWizard open={transactionDialog} mode="add" employees={employees} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} />}</DialogContent></Dialog>
    <Dialog open={Boolean(deleteJournal)} onOpenChange={(open) => !open && setDeleteJournal(null)}><DialogContent><DialogHeader><DialogTitle>{t("accounting.dailyIncome.delete.title")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.delete.description")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteJournal(null)}>{t("common.actions.cancel")}</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (!deleteJournal) return; deleteMutation.mutateAsync(deleteJournal.id).then(() => { setDeleteJournal(null); feedback.notifyDeleted(t("accounting.dailyIncome.transactionNoun"), 1); }).catch((error) => feedback.notifyError(normalizeApiError(error).message)); }}>{t("common.actions.delete")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
