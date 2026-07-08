"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit, Lock, LockOpen, Plus, ScrollText, Trash2 } from "lucide-react";

import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { DailyIncomeStatementForm } from "@/components/accounting/daily-income-statement-form";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards, type StatCardItem } from "@/components/app-shell/stat-cards-carousel";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
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

  const stats = useMemo((): StatCardItem[] => {
    const summary = summaryTotalsQuery.data;
    if (!summary) return [];

    const icon = getDailyIncomeCurrencyIcon(summary.currency);
    const description = dailyIncomeCurrencyDescription(summary.currency, summary.rate);
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
  }, [summaryTotalsQuery.data, summaryTotalsQuery.isFetching, summaryTotalsQuery.isLoading]);

  const columns: DataTableColumn<DailyIncomeJournal>[] = useMemo(() => [
    { id: "date", label: "Date", renderCell: (row) => row.date || "—" },
    { id: "invoice", label: "Account / invoice", renderCell: (row) => row.invoice?.number ?? row.account?.displayName ?? row.account?.name ?? "—" },
    { id: "employee", label: "Employee", renderCell: (row) => getTransactionAssigneeDisplayName(row.employee?.name, row.employeeGroup?.name) || "—" },
    { id: "type", label: "Transaction", truncateCell: false, renderCell: (row) => <Badge variant="outline">{transactionTypeLabel(row.transactionType)}</Badge> },
    { id: "reference", label: "Reference #", renderCell: (row) => row.refNumber || "—" },
    { id: "paymentMethod", label: "Payment method", renderCell: (row) => row.paymentMethod?.name ?? "—" },
    { id: "amount", label: "Amount", cellClassName: "font-medium tabular-nums", renderCell: (row) => formatDailyIncomeMoney(row.amount, displayCurrency) },
    { id: "actions", label: "Actions", hideable: false, stopRowClick: true, truncateCell: false, renderCell: (row) => <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Edit transaction" disabled={statement?.status !== "OPEN"} onClick={() => openEditTransactionForm(row)}><Edit className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete transaction" disabled={statement?.status !== "OPEN"} onClick={() => setDeleteJournal(row)}><Trash2 className="h-4 w-4" /></Button></div> },
  ], [displayCurrency, statement?.status]);
  const columnLayout = useColumnVisibility("daily-income-v1", columns);
  const statementValues: DailyIncomeStatementValues = { date, branchId: selectedBranch?.id ?? 0, branchCode, branchName: selectedBranch?.name ?? "", currency: statement?.currency ?? "USD", rate: statement?.rate ?? 1 };
  const mutationPending = createStatement.isPending || updateStatement.isPending;

  function saveStatement(values: DailyIncomeStatementValues) {
    setFormError(null);
    const action = statement ? updateStatement.mutateAsync({ id: statement.id, values }) : createStatement.mutateAsync(values);
    action.then(() => { setStatementDialog(false); setBranchCode(values.branchCode); setDate(values.date); feedback.notifySuccess(statement ? "Daily income updated." : "Daily income created."); }).catch((error) => setFormError(normalizeApiError(error).message));
  }
  function saveJournal(values: DailyIncomeJournalValues): Promise<void> {
    if (!statement) return Promise.reject(new Error("No closeout loaded."));
    setFormError(null);
    return (editingJournal
      ? updateJournal.mutateAsync({ id: editingJournal.id, statement, values })
      : createJournal.mutateAsync({ statement, values })
    )
      .then(() => {
        if (editingJournal) {
          feedback.notifySuccess("Transaction updated.");
          setTransactionDialog(false);
          setEditingJournal(null);
          return;
        }

        if (values.transactionType === "INITIAL-PAYMENT") {
          const invoiceNumber = values.invoiceNumber?.trim() || "invoice";
          feedback.notifySuccess(`New invoice #${invoiceNumber} created and payment registered.`);
          return;
        }

        feedback.notifySuccess("Transaction created.");
      })
      .catch((error) => {
        setFormError(normalizeApiError(error).message);
        return Promise.reject(error);
      });
  }
  function changeStatus(open: boolean) {
    if (!statement) return;
    statusMutation.mutateAsync({ statement, open }).then(() => feedback.notifySuccess(`Daily income ${open ? "opened" : "closed"}.`)).catch((error) => feedback.notifyError(normalizeApiError(error).message));
  }

  function openAddTransactionForm() {
    if (!statement) return;
    if (isDesktopTabs) {
      openFormTab({
        feature: "daily-income-transactions",
        baseHref: "/accounting/daily-income",
        mode: "add",
        entityId: String(statement.id),
        label: "Add transaction",
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
        label: `Edit ${transactionTypeLabel(row.transactionType)}`,
      });
      return;
    }
    setEditingJournal(row);
    setFormError(null);
    setTransactionDialog(true);
  }

  return <div>
    <PageHeader title="Daily Income" description="Create and reconcile the daily accounting closeout." actions={<>
      {statement ? <Button variant="outline" onClick={() => setStatementDialog(true)}><Edit className="h-4 w-4" /> Edit closeout</Button> : <Button onClick={() => setStatementDialog(true)} disabled={!branchCode}><Plus className="h-4 w-4" /> Create closeout</Button>}
      {statement ? <Button variant={statement.status === "OPEN" ? "destructive" : "default"} onClick={() => changeStatus(statement.status !== "OPEN")} disabled={statusMutation.isPending}>{statement.status === "OPEN" ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}{statement.status === "OPEN" ? "Close day" : "Reopen day"}</Button> : null}
    </>} />

    {statement ? (
      summaryTotalsQuery.isError ? (
        <p className="mb-6 text-sm text-destructive">{normalizeApiError(summaryTotalsQuery.error).message}</p>
      ) : summaryTotalsQuery.isLoading ? (
        <p className="mb-6 text-sm text-muted-foreground">Loading summary totals…</p>
      ) : stats.length > 0 ? (
        <StatCards items={stats} className="mb-6" />
      ) : null
    ) : null}

    <Card className="mb-6 gap-0 py-0">
      <CardContent className="flex flex-wrap items-start gap-4 py-4">
        <div className="flex w-fit flex-col gap-2">
          <Label htmlFor="daily-branch">Branch</Label>
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
            placeholder="Select branch"
            searchPlaceholder="Search branches…"
          />
        </div>
        <div className="flex w-fit flex-col gap-2">
          <Label htmlFor="daily-date">Date</Label>
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
          <Label>Status</Label>
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
              ? `${statement.status} · #${String(statement.id).padStart(5, "0")}`
              : "No closeout for this date"}
          </Badge>
        </div>
      </CardContent>
    </Card>

    {statement ? <>
    <div className="mt-6 mb-3 flex items-center justify-between gap-3"><CardTitle>Transactions</CardTitle><Button onClick={openAddTransactionForm} disabled={statement.status !== "OPEN"}><Plus className="h-4 w-4" /> Add transaction</Button></div>

    <Card className="gap-0"><CardHeader className="gap-3 border-b py-4 pb-3"><TableDirectoryToolbar showFilterToggle={false} columnLayout={columnLayout} searchSummary={`Showing ${rows.length} of ${total} transactions`} search={<TableSearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search transactions…" />} /></CardHeader>
      {journalsQuery.isError ? <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(journalsQuery.error).message}</div> : journalsQuery.isLoading ? <DirectoryTableLoader icon={ScrollText} title="Loading transactions" description="Syncing journal entries, payments, and closeout totals…" columns={["Date", "Account", "Employee", "Type", "Reference", "Amount"]} /> : <DataTable columns={columnLayout.columns} rows={rows} page={page} isPageDataPending={journalsQuery.isFetching} rowKey={(row) => row.id} rowLabel={(row) => transactionTypeLabel(row.transactionType)} columnLayout={columnLayout} minWidth={1100} emptyState={<p className="text-muted-foreground">No transactions match this closeout.</p>} />}
      {!journalsQuery.isLoading && !journalsQuery.isError ? <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{journalsQuery.isFetching ? "Refreshing transactions…" : `Showing ${rows.length} of ${total} transactions`}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button><span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next <ChevronRight className="h-4 w-4" /></Button></div></div> : null}
    </Card>
    </> : null}

    <Dialog open={statementDialog} onOpenChange={(open) => { setStatementDialog(open); if (!open) setFormError(null); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{statement ? "Edit daily income" : "Create daily income"}</DialogTitle><DialogDescription>Set the branch, date, currency, and exchange rate for this closeout.</DialogDescription></DialogHeader><DailyIncomeStatementForm branches={branches} initialValues={statementValues} isSubmitting={mutationPending} error={formError} onSubmit={saveStatement} onCancel={() => setStatementDialog(false)} /></DialogContent></Dialog>
    <Dialog open={transactionDialog} onOpenChange={(open) => { setTransactionDialog(open); if (!open) { setEditingJournal(null); setFormError(null); } }}><DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">{editingJournal ? <AddTransactionWizard open={transactionDialog} mode="edit" initialValues={journalToFormValues(editingJournal)} employees={employees} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} /> : <AddTransactionWizard open={transactionDialog} mode="add" employees={employees} accounts={accountsQuery.data?.items ?? []} bankAccounts={bankAccountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} />}</DialogContent></Dialog>
    <Dialog open={Boolean(deleteJournal)} onOpenChange={(open) => !open && setDeleteJournal(null)}><DialogContent><DialogHeader><DialogTitle>Delete transaction?</DialogTitle><DialogDescription>This removes the entry and recalculates the daily totals.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteJournal(null)}>Cancel</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (!deleteJournal) return; deleteMutation.mutateAsync(deleteJournal.id).then(() => { setDeleteJournal(null); feedback.notifyDeleted("Transaction", 1); }).catch((error) => feedback.notifyError(normalizeApiError(error).message)); }}>Delete</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
