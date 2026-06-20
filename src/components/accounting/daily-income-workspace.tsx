"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Edit, Lock, LockOpen, Plus, Receipt, Trash2, Wallet } from "lucide-react";

import { DailyIncomeStatementForm } from "@/components/accounting/daily-income-statement-form";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useChartAccounts,
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
  useCreateIncomeStatement,
  useDailyIncomeJournals,
  useDeleteDailyIncomeJournal,
  useIncomeStatement,
  useSetIncomeStatementStatus,
  useUpdateDailyIncomeJournal,
  useUpdateIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 20;
const selectClassName = "flex h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

function today() { return new Date().toISOString().slice(0, 10); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function transactionLabel(value: string) {
  return ({ "INITIAL-PAYMENT": "Invoice", PAYMENT: "Payment", DISCOUNT: "Discount", SURCHARGE: "Surcharge", EXPENSE: "Expense", SALES: "Income", TRANSFER: "Transfer", LOAN: "Loan" } as Record<string, string>)[value] ?? value;
}
function emptyTransaction(): DailyIncomeJournalValues { return { transactionType: "INITIAL-PAYMENT", amount: 0, refNumber: "", description: "" }; }
function journalValues(row: DailyIncomeJournal): DailyIncomeJournalValues {
  return { transactionType: row.transactionType, amount: row.amount, refNumber: row.refNumber, description: row.description, employeeId: row.employee?.id, employeeName: row.employee?.name, accountId: row.account?.id, accountName: row.account?.displayName ?? row.account?.name, accountType: row.accounts.find((account) => account.id === row.account?.id)?.type, sourceAccountId: row.sourceAccount?.id, sourceAccountName: row.sourceAccount?.displayName ?? row.sourceAccount?.name, sourceAccountType: row.accounts.find((account) => account.id === row.sourceAccount?.id)?.type, invoiceId: row.invoice?.id != null ? String(row.invoice.id) : "", invoiceNumber: row.invoice?.number, paymentMethodId: row.paymentMethod?.id, paymentMethodName: row.paymentMethod?.name };
}

export function DailyIncomeWorkspace() {
  const feedback = useFeedback();
  const [branchCode, setBranchCode] = useState("");
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
  useEffect(() => { if (!branchCode && branches[0]?.code) setBranchCode(branches[0].code); }, [branchCode, branches]);
  const selectedBranch = branches.find((branch) => branch.code === branchCode);
  const statementQuery = useIncomeStatement(selectedBranch?.id ?? 0, date);
  const statement = statementQuery.data ?? null;
  const journalsQuery = useDailyIncomeJournals({ incomeStatementId: statement?.id ?? 0, page, limit: PAGE_SIZE, query: deferredQuery });
  const employeesQuery = useEmployees({ page: 1, limit: 200, active: true, sort: "name:asc" });
  const invoicesQuery = useInvoices({ page: 1, limit: 200, sort: "number:desc" });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, transactionDialog);
  const paymentMethodsQuery = useAccountingPaymentMethods(transactionDialog);
  const createStatement = useCreateIncomeStatement();
  const updateStatement = useUpdateIncomeStatement();
  const statusMutation = useSetIncomeStatementStatus();
  const createJournal = useCreateDailyIncomeJournal();
  const updateJournal = useUpdateDailyIncomeJournal();
  const deleteMutation = useDeleteDailyIncomeJournal();
  const rows = journalsQuery.data?.items ?? [];
  const summary = journalsQuery.data?.summary;
  const total = journalsQuery.data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: DataTableColumn<DailyIncomeJournal>[] = useMemo(() => [
    { id: "date", label: "Date", renderCell: (row) => row.date || "—" },
    { id: "invoice", label: "Account / invoice", renderCell: (row) => row.invoice?.number ?? row.account?.displayName ?? row.account?.name ?? "—" },
    { id: "employee", label: "Employee", renderCell: (row) => row.employee?.name ?? "—" },
    { id: "type", label: "Transaction", truncateCell: false, renderCell: (row) => <Badge variant="outline">{transactionLabel(row.transactionType)}</Badge> },
    { id: "reference", label: "Reference #", renderCell: (row) => row.refNumber || "—" },
    { id: "paymentMethod", label: "Payment method", renderCell: (row) => row.paymentMethod?.name ?? "—" },
    { id: "amount", label: "Amount", cellClassName: "font-medium tabular-nums", renderCell: (row) => money(row.amount) },
    { id: "actions", label: "Actions", hideable: false, stopRowClick: true, truncateCell: false, renderCell: (row) => <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Edit transaction" disabled={statement?.status !== "OPEN"} onClick={() => { setEditingJournal(row); setFormError(null); setTransactionDialog(true); }}><Edit className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete transaction" disabled={statement?.status !== "OPEN"} onClick={() => setDeleteJournal(row)}><Trash2 className="h-4 w-4" /></Button></div> },
  ], [statement?.status]);
  const columnLayout = useColumnVisibility("daily-income-v1", columns);
  const stats = [
    { label: "Total income", value: money(summary?.totalIncome ?? 0), description: "Income entries", icon: ArrowUpCircle },
    { label: "Total expenses", value: money(summary?.expense ?? 0), description: "Expense entries", icon: ArrowDownCircle },
    { label: "Net (income − expenses)", value: money((summary?.totalIncome ?? 0) - (summary?.expense ?? 0)), description: "Non-invoice ledger net", icon: Wallet },
    { label: "Invoice payments", value: money(summary?.invoice ?? 0), description: "Payments registered", icon: Receipt },
  ];
  const statementValues: DailyIncomeStatementValues = { date, branchId: selectedBranch?.id ?? 0, branchCode, branchName: selectedBranch?.name ?? "", currency: statement?.currency ?? "USD", rate: statement?.rate ?? 1 };
  const mutationPending = createStatement.isPending || updateStatement.isPending;

  function saveStatement(values: DailyIncomeStatementValues) {
    setFormError(null);
    const action = statement ? updateStatement.mutateAsync({ id: statement.id, values }) : createStatement.mutateAsync(values);
    action.then(() => { setStatementDialog(false); setBranchCode(values.branchCode); setDate(values.date); feedback.notifySuccess(statement ? "Daily income updated." : "Daily income created."); }).catch((error) => setFormError(normalizeApiError(error).message));
  }
  function saveJournal(values: DailyIncomeJournalValues) {
    if (!statement) return;
    setFormError(null);
    const action = editingJournal ? updateJournal.mutateAsync({ id: editingJournal.id, statement, values }) : createJournal.mutateAsync({ statement, values });
    action.then(() => { setTransactionDialog(false); setEditingJournal(null); feedback.notifySuccess(editingJournal ? "Transaction updated." : "Transaction created."); }).catch((error) => setFormError(normalizeApiError(error).message));
  }
  function changeStatus(open: boolean) {
    if (!statement) return;
    statusMutation.mutateAsync({ statement, open }).then(() => feedback.notifySuccess(`Daily income ${open ? "opened" : "closed"}.`)).catch((error) => feedback.notifyError(normalizeApiError(error).message));
  }

  return <div>
    <PageHeader title="Daily Income" description="Create and reconcile the daily accounting closeout." actions={<>
      {statement ? <Button variant="outline" onClick={() => setStatementDialog(true)}><Edit className="h-4 w-4" /> Edit closeout</Button> : <Button onClick={() => setStatementDialog(true)} disabled={!branchCode}><Plus className="h-4 w-4" /> Create closeout</Button>}
      {statement ? <Button variant={statement.status === "OPEN" ? "destructive" : "default"} onClick={() => changeStatus(statement.status !== "OPEN")} disabled={statusMutation.isPending}>{statement.status === "OPEN" ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}{statement.status === "OPEN" ? "Close day" : "Reopen day"}</Button> : null}
    </>} />

    <Card className="mb-6"><CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-end">
      <div className="space-y-2"><label className="text-sm font-medium" htmlFor="daily-branch">Branch</label><select id="daily-branch" className={selectClassName} value={branchCode} onChange={(event) => { setBranchCode(event.target.value); setPage(1); }}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.code}>{branch.code} — {branch.name}</option>)}</select></div>
      <div className="space-y-2"><label className="text-sm font-medium" htmlFor="daily-date">Date</label><Input id="daily-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} /></div>
      <div className="sm:ml-auto"><Badge className={statement?.status === "OPEN" ? "bg-emerald-600" : statement ? "bg-slate-600" : "bg-amber-600"}>{statement ? `${statement.status} · #${String(statement.id).padStart(5, "0")}` : "No closeout for this date"}</Badge></div>
    </CardContent></Card>

    <StatCardsGrid>{stats.map((stat) => { const Icon = stat.icon; return <Card key={stat.label}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stat.value}</div><CardDescription className="mt-1">{stat.description}</CardDescription></CardContent></Card>; })}</StatCardsGrid>

    <Card className="mt-6"><CardHeader className="gap-3 border-b py-4 pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle>Transactions</CardTitle><CardDescription>All entries for the selected branch and date.</CardDescription></div><Button onClick={() => { setEditingJournal(null); setFormError(null); setTransactionDialog(true); }} disabled={!statement || statement.status !== "OPEN"}><Plus className="h-4 w-4" /> Add transaction</Button></div><TableDirectoryToolbar showFilterToggle={false} columnLayout={columnLayout} searchSummary={`Showing ${rows.length} of ${total} transactions`} search={<TableSearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search transactions…" />} /></CardHeader>
      {statementQuery.isError || journalsQuery.isError ? <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(statementQuery.error ?? journalsQuery.error).message}</div> : !statement ? <div className="px-6 py-12 text-center text-muted-foreground">Create or select a daily closeout to view transactions.</div> : journalsQuery.isLoading ? <div className="px-6 py-12 text-center text-muted-foreground">Loading transactions…</div> : <DataTable columns={columnLayout.columns} rows={rows} page={page} isPageDataPending={journalsQuery.isFetching} rowKey={(row) => row.id} rowLabel={(row) => transactionLabel(row.transactionType)} columnLayout={columnLayout} minWidth={1100} emptyState={<p className="text-muted-foreground">No transactions match this closeout.</p>} />}
      {statement ? <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{journalsQuery.isFetching ? "Refreshing transactions…" : `Showing ${rows.length} of ${total} transactions`}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button><span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next <ChevronRight className="h-4 w-4" /></Button></div></div> : null}
    </Card>

    <Dialog open={statementDialog} onOpenChange={(open) => { setStatementDialog(open); if (!open) setFormError(null); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{statement ? "Edit daily income" : "Create daily income"}</DialogTitle><DialogDescription>Set the branch, date, currency, and exchange rate for this closeout.</DialogDescription></DialogHeader><DailyIncomeStatementForm branches={branches} initialValues={statementValues} isSubmitting={mutationPending} error={formError} onSubmit={saveStatement} onCancel={() => setStatementDialog(false)} /></DialogContent></Dialog>
    <Dialog open={transactionDialog} onOpenChange={(open) => { setTransactionDialog(open); if (!open) { setEditingJournal(null); setFormError(null); } }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingJournal ? "Edit transaction" : "Add transaction"}</DialogTitle><DialogDescription>Record an entry in the selected daily closeout.</DialogDescription></DialogHeader><DailyIncomeTransactionForm key={editingJournal?.id ?? "new"} initialValues={editingJournal ? journalValues(editingJournal) : emptyTransaction()} employees={employeesQuery.data?.items ?? []} accounts={accountsQuery.data?.items ?? []} invoices={invoicesQuery.data?.items ?? []} paymentMethods={paymentMethodsQuery.data ?? []} isSubmitting={createJournal.isPending || updateJournal.isPending} error={formError} onSubmit={saveJournal} onCancel={() => setTransactionDialog(false)} /></DialogContent></Dialog>
    <Dialog open={Boolean(deleteJournal)} onOpenChange={(open) => !open && setDeleteJournal(null)}><DialogContent><DialogHeader><DialogTitle>Delete transaction?</DialogTitle><DialogDescription>This removes the entry and recalculates the daily totals.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteJournal(null)}>Cancel</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (!deleteJournal) return; deleteMutation.mutateAsync(deleteJournal.id).then(() => { setDeleteJournal(null); feedback.notifyDeleted("Transaction", 1); }).catch((error) => feedback.notifyError(normalizeApiError(error).message)); }}>Delete</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
