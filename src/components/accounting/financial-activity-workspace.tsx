"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { DataTable } from "@/components/app-shell/data-table";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableAdvancedFilterPanel } from "@/components/app-shell/table-advanced-filter-panel";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { dailyIncomeTransactionColumns } from "./daily-income-transaction-columns";
import { DAILY_INCOME_JOURNAL_API_TABLE_FIELDS } from "@/lib/accounting/daily-income/table-fields";
import { PENDING_TRANSACTION_FILTER_FIELDS } from "@/lib/accounting/pending-transactions/api";
import { usePendingTransactions } from "@/lib/accounting/pending-transactions/hooks";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollText } from "lucide-react";

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, currency ? { style: "currency", currency } : { maximumFractionDigits: 2 }).format(value);
}

export function FinancialActivityWorkspace() {
  const { companyId } = useAuth();
  const { t } = useTranslation();
  return <div className="space-y-6">
    <PageHeader title={t("accounting.financialActivity.title")} description={t("accounting.pendingTransactions.description")} />
    <PendingTransactionsPanel key={companyId} />
  </div>;
}

function PendingTransactionsPanel() {
  const { t } = useTranslation();
  const state = usePendingTransactions();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const text = (key: string) => t(`accounting.pendingTransactions.${key}`);
  const columns = useMemo(() => dailyIncomeTransactionColumns(t, "USD", true), [t]);
  const columnLayout = useApiTableColumns("pending-journals-v1", columns, DAILY_INCOME_JOURNAL_API_TABLE_FIELDS);
  const rows = state.list.data?.items ?? [];
  const selected = new Set(state.selectedIds);
  const busy = state.reconcile.isPending;
  const allPageSelected = rows.length > 0 && rows.every(row => selected.has(row.id));
  const summary = <div className="flex flex-wrap gap-4" role="status">
    {state.summary.isFetching ? <p>{text("summaryLoading")}</p> : state.summary.isError ? <p role="alert" className="text-destructive">{normalizeApiError(state.summary.error).message}<Button variant="outline" onClick={() => void state.summary.refetch()}>{text("retry")}</Button></p> : state.summary.data?.map(total => <div key={total.currency} className="flex flex-wrap gap-4 text-sm">
      <span>{total.currency || text("unknownCurrency")}</span>
      <span>{t("accounting.dailyIncome.selectionTotals.income")}: <strong>{money(total.income, total.currency)}</strong></span>
      <span>{t("accounting.dailyIncome.selectionTotals.expenses")}: <strong>{money(total.expenses, total.currency)}</strong></span>
      <span>{t("accounting.dailyIncome.selectionTotals.net")}: <strong>{money(total.net, total.currency)}</strong></span>
    </div>)}
  </div>;
  const selectionList = <div className="max-h-64 overflow-auto rounded-md border"><table className="w-full text-left text-sm">
    <thead><tr>{["date", "employee", "paymentMethod", "account", "payment"].map(key => <th key={key} scope="col" className="p-3">{t(`accounting.dailyIncome.columns.${key}`)}</th>)}</tr></thead>
    <tbody>{state.selectedRows.map(row => <tr className="border-t" key={row.id}>
      <td className="p-3">{row.date || "—"}</td><td className="p-3">{row.employee?.name || "—"}</td>
      <td className="p-3">{row.paymentMethod?.name || "—"}</td><td className="p-3">{row.account?.displayName || row.account?.name || "—"}</td>
      <td className="p-3 tabular-nums">{money(row.amount, row.currency)}</td>
    </tr>)}</tbody>
  </table></div>;
  if (!state.canView) return <p>{t("common.errors.forbidden")}</p>;
  return <div className="space-y-4">
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4"><TableDirectoryToolbar columnLayout={columnLayout} filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen}
        activeFilterCount={countCompleteFilterRows(state.filters, PENDING_TRANSACTION_FILTER_FIELDS)}
        search={<TableSearchInput value={state.query} onChange={state.setQuery} placeholder={t("accounting.dailyIncome.transactions.searchPlaceholder")} />}
        filterPanel={<TableAdvancedFilterPanel presetScope="pending-journals" open={filtersOpen} rows={state.filters} fields={PENDING_TRANSACTION_FILTER_FIELDS} onRowsChange={state.setFilters} onClearAll={() => { state.setQuery(""); state.setFilters([]); }} />} /></div>
      {state.list.isError ? <p role="alert" className="p-6 text-destructive">{normalizeApiError(state.list.error).message}<Button variant="outline" onClick={() => void state.list.refetch()}>{text("retry")}</Button></p> : state.list.isPending ? <DirectoryTableLoader icon={ScrollText} title={text("loading")} description={text("description")} columns={columns.map(column => column.label)} /> : <DataTable
        columns={columnLayout.columns} rows={rows} rowKey={row => row.id} rowLabel={row => row.refNumber || row.id} columnLayout={columnLayout} page={state.page} isPageDataPending={state.list.isFetching} minWidth={1100}
        selectable={!busy} selectedIds={state.selectedIds} allPageSelected={allPageSelected}
        onToggleSelect={(id, checked) => state.select([id], checked)} onToggleSelectAll={checked => state.select(rows.map(row => row.id), checked)}
        emptyState={<p>{text("empty")}</p>} />}
      <div className="flex items-center justify-end gap-3 border-t p-4">
        <Button variant="outline" disabled={state.page <= 1 || state.list.isFetching || busy} onClick={() => state.setPage(state.page - 1)}>{t("accounting.financialActivity.previous")}</Button>
        <span>{state.page} / {Math.max(1, Math.ceil((state.list.data?.total ?? 0) / 40))}</span>
        <Button variant="outline" disabled={state.page * 40 >= (state.list.data?.total ?? 0) || state.list.isFetching || busy} onClick={() => state.setPage(state.page + 1)}>{t("accounting.financialActivity.next")}</Button>
      </div>
    </div>
    {state.selectedIds.length > 0 ? <section aria-label={text("selectedTitle")} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{text("selectedTitle")} ({state.selectedIds.length})</h2><div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={state.clearSelection}>{text("clearSelection")}</Button>
        {state.canReconcile ? <Button disabled={busy || !state.validSelection || !state.summary.isSuccess || state.summary.isFetching} onClick={() => setConfirmOpen(true)}>{text("reconcileSelected")}</Button> : null}
      </div></div>
      <p className="text-sm text-muted-foreground">{text("selectionHelp")}</p>{summary}{selectionList}
    </section> : null}
    <Dialog open={confirmOpen} onOpenChange={open => { if (!busy) setConfirmOpen(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{text("reconcileSelected")}</DialogTitle><DialogDescription>{text("confirmDescription")}</DialogDescription></DialogHeader>
      {summary}{selectionList}
      {state.reconcile.isError ? <p role="alert" className="text-destructive">{normalizeApiError(state.reconcile.error).message}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>{text("cancel")}</Button><Button disabled={busy || !state.canReconcile || !state.selectedIds.length || !state.validSelection || !state.summary.isSuccess || state.summary.isFetching} onClick={() => state.reconcile.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })}>{busy ? text("reconciling") : text("confirm")}</Button></div>
    </DialogContent></Dialog>
  </div>;
}
