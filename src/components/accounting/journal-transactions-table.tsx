"use client";

import {useDeferredValue, useMemo, useState} from "react";
import {DataTable} from "@/components/app-shell/data-table";
import {useApiTableColumns} from "@/components/app-shell/use-api-table-columns";
import {TableDirectoryToolbar} from "@/components/app-shell/table-directory-toolbar";
import {TableAdvancedFilterPanel} from "@/components/app-shell/table-advanced-filter-panel";
import {TableSearchInput} from "@/components/app-shell/table-search-input";
import {TablePaginationControls} from "@/components/app-shell/table-pagination-controls";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter} from "@/components/ui/dialog";
import {useLocalizedFilterFields} from "@/lib/table/hooks/use-localized-filter-fields";
import {createRandomId} from "@/lib/utils/id";
import {useAuth} from "@/lib/auth/hooks/use-auth";
import {useTranslation} from "@/lib/i18n";
import {normalizeApiError} from "@/lib/api/axios";
import {useTablePageSize} from "@/lib/table/hooks/use-table-page-size";
import {countCompleteFilterRows, type TableFilterRowState} from "@/lib/table/filter-builder";
import {DAILY_INCOME_TABLE_FILTER_FIELDS, PENDING_JOURNAL_TABLE_FILTER_FIELDS, buildJournalSearchBody} from "@/lib/accounting/daily-income/journal-search";
import {DAILY_INCOME_JOURNAL_API_TABLE_FIELDS} from "@/lib/accounting/daily-income/table-fields";
import {useJournalRows, useJournalSummary, useReconcileJournals, type JournalCurrencySummary} from "@/lib/accounting/daily-income/reconciliation";
import type {DailyIncomeJournal} from "@/lib/accounting/daily-income/types";
import {canPrintPaymentReceipt} from "@/lib/accounting/daily-income/print-payment-receipt";
import {journalTableColumns} from "./journal-table-columns";

export function JournalTransactionsTable(props: {incomeStatementId?: number; pending?: boolean; isPrintingReceipt?: boolean; onView?: (row: DailyIncomeJournal) => void; onPrintReceipt?: (row: DailyIncomeJournal) => void}) {
  const {companyId} = useAuth();
  return <JournalTable key={companyId} {...props}/>;
}
function JournalTable({incomeStatementId = 0, pending = false, isPrintingReceipt = false, onView, onPrintReceipt}: {incomeStatementId?: number; pending?: boolean; isPrintingReceipt?: boolean; onView?: (row: DailyIncomeJournal) => void; onPrintReceipt?: (row: DailyIncomeJournal) => void}) {
  const {t} = useTranslation();
  const {hasPermission} = useAuth();
  const text = (key: string) => t(`accounting.journalReconciliation.${key}`);
  const {page, setPage, pageSize, pageLimit, changePageSize} = useTablePageSize();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filterRows, setFilterRows] = useState<TableFilterRowState[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("createdAt:desc");
  const [selected, setSelected] = useState<Record<string, DailyIncomeJournal>>({});
  const [command, setCommand] = useState<{ids: string[]; requestId: string} | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const params = {incomeStatementId, pending, page, limit: pageLimit, query: deferredQuery, filterRows, sort};
  const rowsQuery = useJournalRows(params);
  const rows = rowsQuery.data?.items ?? [];
  const total = rowsQuery.data?.total ?? 0;
  const ids = Object.keys(selected);
  const canReconcile = pending && hasPermission("canReconcileJournal", "journal");
  const matching = useJournalSummary({filters: buildJournalSearchBody(params).filters});
  const selectedTotals = useJournalSummary({ids}, ids.length > 0);
  const reconcile = useReconcileJournals();
  const fields = useLocalizedFilterFields(pending ? PENDING_JOURNAL_TABLE_FILTER_FIELDS : DAILY_INCOME_TABLE_FILTER_FIELDS, "accounting.journalReconciliation.fields");
  const columns = useMemo(() => journalTableColumns(t).map(column => ({...column, sortable: column.id === "date" || column.id === "createdAt"})), [t]);
  const layout = useApiTableColumns("journal-transactions-v1", columns, DAILY_INCOME_JOURNAL_API_TABLE_FIELDS);
  const method = ids.length ? selected[ids[0]].paymentMethod?.name ?? "" : undefined;
  const canSelect = (row: DailyIncomeJournal) => ids.includes(row.id) || (ids.length < 200 && (!canReconcile || (row.reconciliationStatus === "OUTSTANDING" && !row.reversedAt && !row.reversalOf && (method === undefined || method === (row.paymentMethod?.name ?? "")))));
  function toggle(id: string, checked: boolean) {
    if (reconcile.isPending) return;
    const row = rows.find(item => item.id === id);
    if (checked && (!row || !canSelect(row))) return;
    setCommand(null);
    setSelected(current => {
      const next = {...current};
      if (checked && row) next[id] = row; else delete next[id];
      return next;
    });
  }
  function resetFilters(next: TableFilterRowState[]) {
    if (reconcile.isPending) return;
    setFilterRows(next); setPage(1); setSelected({}); setCommand(null);
  }
  function togglePage(checked: boolean) {
    if (reconcile.isPending) return;
    setCommand(null);
    setSelected(current => {
      const next = {...current};
      const selectedMethod = method ?? (canReconcile ? rows.find(row => row.reconciliationStatus === "OUTSTANDING" && !row.reversedAt && !row.reversalOf)?.paymentMethod?.name ?? "" : undefined);
      for (const row of rows) {
        if (!checked) delete next[row.id];
        else if (Object.keys(next).length < 200 && (!canReconcile || (row.reconciliationStatus === "OUTSTANDING" && !row.reversedAt && !row.reversalOf && (row.paymentMethod?.name ?? "") === selectedMethod))) next[row.id] = row;
      }
      return next;
    });
  }
  const ready = !rowsQuery.isFetching && !selectedTotals.isFetching && selectedTotals.isSuccess && ids.length > 0;
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <TableDirectoryToolbar columnLayout={layout}
      filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen}
      activeFilterCount={countCompleteFilterRows(filterRows, fields)}
      filterPanel={<TableAdvancedFilterPanel presetScope={pending ? "pending-journals" : "daily-income-journals"} open={filtersOpen} rows={filterRows} fields={fields} onRowsChange={resetFilters} onClearAll={() => resetFilters([])}/>}
      search={<TableSearchInput value={query} onChange={value => {setQuery(value); setPage(1); setSelected({}); setCommand(null);}} placeholder={t("accounting.dailyIncome.transactions.searchPlaceholder")}/>}
    />
    {matching.isError ? <p role="alert">{normalizeApiError(matching.error).message}</p> : <JournalTotals label={text("matchingTotals")} totals={matching.data} loading={matching.isFetching}/>}
    {ids.length > 0 ? <div className="space-y-3 rounded-lg border p-3">
      <p>{text("selectedCount")} {ids.length} / 200</p>
      {selectedTotals.isError ? <p role="alert">{normalizeApiError(selectedTotals.error).message}</p> : <JournalTotals label={text("selectedTotals")} totals={selectedTotals.data} loading={selectedTotals.isFetching}/>}
      <Button variant="outline" disabled={reconcile.isPending} onClick={() => {setSelected({}); setCommand(null);}}>{text("clearSelection")}</Button>
      {canReconcile ? <Button disabled={!ready || reconcile.isPending} onClick={() => {setCommand(current => current ?? {ids: [...ids], requestId: createRandomId()}); setConfirmOpen(true);}}>{text("reconcileSelected")}</Button> : null}
      {ids.length === 1 && onPrintReceipt && canPrintPaymentReceipt(selected[ids[0]]) ? <Button variant="outline" disabled={isPrintingReceipt} onClick={() => onPrintReceipt(selected[ids[0]])}>{t("accounting.dailyIncome.actions.printReceipt")}</Button> : null}
    </div> : null}
    {canReconcile ? <p className="text-sm text-muted-foreground">{text("sameMethod")}</p> : null}
    {rowsQuery.isError ? <p role="alert" className="text-destructive">{normalizeApiError(rowsQuery.error).message}</p> : <DataTable
      columns={layout.columns} columnLayout={layout} rows={rows} rowKey={row => row.id} rowLabel={row => row.refNumber || row.id}
      page={page} isPageDataPending={rowsQuery.isFetching} selectable selectedIds={ids}
      isRowSelectable={row => !reconcile.isPending && canSelect(row)}
      allPageSelected={rows.length > 0 && rows.every(row => ids.includes(row.id))}
      onToggleSelect={toggle} onToggleSelectAll={togglePage} onRowClick={onView}
      sort={sort} onSortChange={(field, direction) => {setSort(`${field}:${direction}`); setPage(1);}}
      emptyState={<p role="status">{rowsQuery.isLoading ? t("accounting.dailyIncome.transactions.loadingTitle") : t("accounting.dailyIncome.transactions.empty")}</p>}
    />}
    <div className="flex flex-wrap items-center justify-between gap-3"><span>{text("totalCount")} {total}</span><TablePaginationControls allowAll={false} page={page} totalPages={Math.max(1, Math.ceil(total / pageLimit))} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize} disabled={rowsQuery.isFetching || reconcile.isPending}/></div>
    <Dialog open={confirmOpen} onOpenChange={open => {if (!reconcile.isPending) setConfirmOpen(open);}}><DialogContent><DialogHeader><DialogTitle>{text("confirmTitle")}</DialogTitle><DialogDescription>{text("confirmDescription")}</DialogDescription></DialogHeader>
      <p>{text("selectedCount")} {command?.ids.length}</p>
      <JournalTotals label={text("selectedTotals")} totals={selectedTotals.data} loading={selectedTotals.isFetching}/>
      {reconcile.isError ? <p role="alert" className="text-destructive">{normalizeApiError(reconcile.error).message}</p> : null}
      <DialogFooter><Button variant="outline" disabled={reconcile.isPending} onClick={() => setConfirmOpen(false)}>{t("common.actions.cancel")}</Button><Button disabled={!ready || reconcile.isPending || !command} onClick={() => {if (!command) return; reconcile.mutate(command, {onSuccess: () => {setSelected({}); setCommand(null); setConfirmOpen(false); setPage(1);}});}}>{text("reconcileSelected")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
function JournalTotals({label, totals, loading}: {label: string; totals?: JournalCurrencySummary[]; loading: boolean}) {
  const {t} = useTranslation();
  return <div aria-busy={loading}><p className="font-medium">{label}</p>{loading ? <span role="status">{t("accounting.dailyIncome.transactions.loadingTitle")}</span> : totals?.map(row => <p key={row.currency} className="tabular-nums">{row.currency || "—"} · {t("accounting.journalReconciliation.income")} {row.income.toFixed(2)} · {t("accounting.journalReconciliation.expenses")} {row.expenses.toFixed(2)} · {t("accounting.journalReconciliation.net")} {row.net.toFixed(2)} · {row.count}</p>)}</div>;
}
