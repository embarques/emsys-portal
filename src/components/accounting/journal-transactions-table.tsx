"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import {useMemo, useState, type ReactNode} from "react";
import {CheckCircle2, Info, Printer} from "lucide-react";
import {DataTable} from "@/components/app-shell/data-table";
import {useApiTableColumns} from "@/components/app-shell/use-api-table-columns";
import {TableDirectoryToolbar} from "@/components/app-shell/table-directory-toolbar";
import {TableAdvancedFilterPanel} from "@/components/app-shell/table-advanced-filter-panel";
import {TableSearchInput} from "@/components/app-shell/table-search-input";
import {TablePaginationControls} from "@/components/app-shell/table-pagination-controls";
import {TableSelectionBar} from "@/components/app-shell/table-selection-bar";
import {Card, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter} from "@/components/ui/dialog";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {useLocalizedFilterFields} from "@/lib/table/hooks/use-localized-filter-fields";
import {createRandomId} from "@/lib/utils/id";
import {useAuth} from "@/lib/auth/hooks/use-auth";
import {useTranslation} from "@/lib/i18n";
import {normalizeApiError} from "@/lib/api/axios";
import {useTablePageSize} from "@/lib/table/hooks/use-table-page-size";
import {countCompleteFilterRows, type TableFilterRowState} from "@/lib/table/filter-builder";
import {DAILY_INCOME_TABLE_FILTER_FIELDS, PENDING_JOURNAL_TABLE_FILTER_FIELDS} from "@/lib/accounting/daily-income/journal-search";
import {DAILY_INCOME_JOURNAL_API_TABLE_FIELDS} from "@/lib/accounting/daily-income/table-fields";
import {useJournalRows, useJournalSummary, useReconcileJournals, useClearJournals, type JournalCurrencySummary} from "@/lib/accounting/daily-income/reconciliation";
import {atomicBatchOutcome} from "@/lib/accounting/daily-income/batch-outcome";
import {getJournalQueueBlockReason, isJournalQueueActionable, type JournalQueueBlockReason} from "@/lib/accounting/daily-income/journal-queue";
import type {DailyIncomeJournal} from "@/lib/accounting/daily-income/types";
import {canPrintPaymentReceipt} from "@/lib/accounting/daily-income/print-payment-receipt";
import {buildChartAccountsById, resolveJournalRowAccount, type ChartAccountsById} from "@/lib/accounting/daily-income/journal-account";
import {formatDailyIncomeMoney} from "@/lib/accounting/daily-income/display";
import {formatAuditDate} from "@/lib/audit/display";
import {useChartAccounts} from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import {journalTableColumns} from "./journal-table-columns";
import {buildToolbarSearchSummary, formatPaginatedListSummary} from "@/lib/table/list-summary";

type JournalTransactionsTableProps = {
  incomeStatementId?: number;
  pending?: boolean;
  clearance?: boolean;
  headerActions?: ReactNode;
  isPrintingReceipt?: boolean;
  onView?: (row: DailyIncomeJournal) => void;
  onEdit?: (row: DailyIncomeJournal) => void;
  canEditRow?: (row: DailyIncomeJournal) => boolean;
  onPrintReceipt?: (row: DailyIncomeJournal) => void;
};

type SelectionBlockReason = JournalQueueBlockReason | "paymentMethod" | "limit";

export function JournalTransactionsTable(props: JournalTransactionsTableProps) {
  const {companyId,user,email,roleId} = useAuth();
  return <JournalTable key={`${companyId}:${user?.uid??email}:${roleId}:${props.clearance ? "clearance" : props.pending ? "reconciliation" : "closeout"}`} {...props}/>;
}
function JournalTable({incomeStatementId = 0, pending = false, clearance = false, headerActions, isPrintingReceipt = false, onView, onEdit, canEditRow, onPrintReceipt}: JournalTransactionsTableProps) {
  const {t} = useTranslation();
  const {hasPermission} = useAuth();
  const text = (key: string) => t(`accounting.${clearance ? "journalClearance" : "journalReconciliation"}.${key}`);
  const queue = clearance ? "clearance" : "reconciliation";
  const isQueue = pending || clearance;
  const actionLabel = text(clearance ? "clearSelected" : "reconcileSelected");
  const {page, setPage, pageSize, pageLimit, changePageSize} = useTablePageSize();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [filterRows, setFilterRows] = useState<TableFilterRowState[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("createdAt:desc");
  const [selected, setSelected] = useState<Record<string, DailyIncomeJournal>>({});
  const [command, setCommand] = useState<{ids: string[]; requestId: string} | null>(null);
  const [commandRows, setCommandRows] = useState<DailyIncomeJournal[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outcome, setOutcome] = useState<ReturnType<typeof atomicBatchOutcome> | null>(null);
  const params = {incomeStatementId, pending: pending && !clearance, pendingClearance: clearance, page, limit: pageLimit, query: debouncedQuery, filterRows, sort};
  const rowsQuery = useJournalRows(params);
  const rows = rowsQuery.data?.items ?? [];
  const total = rowsQuery.data?.total ?? 0;
  const ids = Object.keys(selected);
  const canProcess = isQueue && hasPermission(clearance ? "canClearJournal" : "canReconcileJournal", "journal");
  const selectedTotals = useJournalSummary({ids}, ids.length > 0);
  const reconciliationMutation = useReconcileJournals();
  const clearanceMutation = useClearJournals();
  const processMutation = clearance ? clearanceMutation : reconciliationMutation;
  const fields = useLocalizedFilterFields(isQueue ? PENDING_JOURNAL_TABLE_FILTER_FIELDS : DAILY_INCOME_TABLE_FILTER_FIELDS, "accounting.journalReconciliation.fields");
  const activeFilterCount = countCompleteFilterRows(filterRows, fields);
  const hasActiveSearch = Boolean(query.trim()) || activeFilterCount > 0;
  const noun = t("accounting.dailyIncome.noun");
  const listSummary = formatPaginatedListSummary({itemCountOnPage: rows.length, page, pageSize: pageLimit, total, noun, isFiltered: hasActiveSearch, isLoading: rowsQuery.isFetching}, t);
  const searchSummary = buildToolbarSearchSummary({isFiltered: hasActiveSearch, query, isSearchPending: query.trim() !== debouncedQuery.trim(), matched: total, noun, isLoading: rowsQuery.isFetching && rows.length === 0}, t);
  const chartAccountsQuery = useChartAccounts({page: 1, limit: 500}, hasPermission("canViewChartAccount", "chart_account"));
  const chartAccountsById = useMemo(() => buildChartAccountsById(chartAccountsQuery.data?.items ?? []), [chartAccountsQuery.data]);
  const columns = useMemo(() => journalTableColumns(t, chartAccountsById).map(column => ({...column, sortable: column.id === "date" || column.id === "createdAt"})), [t, chartAccountsById]);
  const layout = useApiTableColumns("journal-transactions-v1", columns, DAILY_INCOME_JOURNAL_API_TABLE_FIELDS);
  const method = ids.length ? selected[ids[0]].paymentMethod?.name ?? "" : undefined;
  function selectionBlockReason(row: DailyIncomeJournal): SelectionBlockReason | null {
    if (ids.includes(row.id)) return null;
    if (ids.length >= 200) return "limit";
    if (!canProcess) return null;
    const reason = getJournalQueueBlockReason(row, queue);
    if (reason) return reason;
    return method === undefined || method === (row.paymentMethod?.name ?? "") ? null : "paymentMethod";
  }
  const canSelect = (row: DailyIncomeJournal) => selectionBlockReason(row) === null;
  function renderBlockedHint(row: DailyIncomeJournal) {
    const reason = processMutation.isPending ? null : selectionBlockReason(row);
    if (!reason || (!clearance && reason !== "awaitingClearance")) return null;
    const label = t(`accounting.journalClearance.blocked.${reason}`, {method: method || t("accounting.journalClearance.blocked.noMethod")});
    return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={label}><Info className="size-4" aria-hidden="true"/></Button></TooltipTrigger><TooltipContent className="max-w-xs">{label}</TooltipContent></Tooltip>;
  }
  function toggle(id: string, checked: boolean) {
    if (processMutation.isPending) return;
    const row = rows.find(item => item.id === id);
    if (checked && (!row || !canSelect(row))) return;
    setCommand(null); setOutcome(null);
    setSelected(current => {
      const next = {...current};
      if (checked && row) next[id] = row; else delete next[id];
      return next;
    });
  }
  function resetFilters(next: TableFilterRowState[]) {
    if (processMutation.isPending) return;
    setFilterRows(next); setPage(1); setSelected({}); setCommand(null); setOutcome(null);
  }
  function togglePage(checked: boolean) {
    if (processMutation.isPending) return;
    setCommand(null); setOutcome(null);
    setSelected(current => {
      const next = {...current};
      const selectedMethod = method ?? (canProcess ? rows.find(row => isJournalQueueActionable(row, queue))?.paymentMethod?.name ?? "" : undefined);
      for (const row of rows) {
        if (!checked) delete next[row.id];
        else if (Object.keys(next).length < 200 && (!canProcess || (isJournalQueueActionable(row, queue) && (row.paymentMethod?.name ?? "") === selectedMethod))) next[row.id] = row;
      }
      return next;
    });
  }
  const ready = canProcess && !rowsQuery.isFetching && !selectedTotals.isFetching && selectedTotals.isSuccess && ids.length > 0 && ids.every(id => isJournalQueueActionable(selected[id], queue));
  return <Card className="gap-0 py-0">
    <CardHeader className="gap-3 border-b py-4 pb-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <CardTitle>{isQueue ? text("title") : t("accounting.dailyIncome.transactions.title")}</CardTitle>
      {headerActions}
    </div>
    <TableDirectoryToolbar isLoading={rowsQuery.isFetching || query.trim() !== debouncedQuery.trim()} columnLayout={layout}
      filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen}
      activeFilterCount={activeFilterCount} searchSummary={searchSummary}
      filterPanel={<TableAdvancedFilterPanel isLoading={rowsQuery.isFetching || query.trim() !== debouncedQuery.trim()} presetScope={clearance ? "pending-clearance" : pending ? "pending-journals" : "daily-income-journals"} open={filtersOpen} rows={filterRows} fields={fields} resultSummary={listSummary} onRowsChange={resetFilters} onClearAll={() => resetFilters([])}/>}
      search={<TableSearchInput value={query} onChange={value => {setQuery(value); setPage(1); setSelected({}); setCommand(null); setOutcome(null);}} placeholder={t("accounting.dailyIncome.transactions.searchPlaceholder")}/>}
    />
    </CardHeader>
    <TableSelectionBar
      selectedCount={ids.length} totalCount={total}
      onClear={() => {if (!processMutation.isPending) {setSelected({}); setCommand(null); setOutcome(null);}}}
      onView={onView ? () => onView(selected[ids[0]]) : undefined}
      viewDisabled={processMutation.isPending} canDelete={false}
      onEdit={onEdit ? () => onEdit(selected[ids[0]]) : undefined}
      canEdit={Boolean(onEdit && canEditRow)}
      editDisabled={processMutation.isPending || ids.length !== 1 || !canEditRow?.(selected[ids[0]])}
      actions={<>
        {canProcess ? <Button size="sm" disabled={!ready || processMutation.isPending} onClick={() => {if (!command) setCommandRows(ids.map(id => selected[id])); setCommand(current => current ?? {ids: [...ids], requestId: createRandomId()}); setConfirmOpen(true);}}><CheckCircle2 className="size-4" aria-hidden="true"/>{actionLabel}</Button> : null}
        {ids.length === 1 && onPrintReceipt && canPrintPaymentReceipt(selected[ids[0]]) ? <Button size="sm" variant="outline" disabled={isPrintingReceipt} onClick={() => onPrintReceipt(selected[ids[0]])}><Printer className="size-4" aria-hidden="true"/>{t("accounting.dailyIncome.actions.printReceipt")}</Button> : null}
      </>}
    />
    {ids.length > 0 ? <div className="border-b bg-muted/20 px-6 py-3">
      {selectedTotals.isError ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(selectedTotals.error).message}</p> : <JournalTotals label={text("selectedTotals")} totals={selectedTotals.data} loading={selectedTotals.isFetching}/>}
    </div> : null}
    {canProcess ? <p className="border-b px-6 py-3 text-sm text-muted-foreground">{text("sameMethod")}</p> : null}
    {rowsQuery.isError ? <p role="alert" className="px-6 py-3 text-sm text-destructive">{normalizeApiError(rowsQuery.error).message}</p> : <DataTable
      columns={layout.columns} columnLayout={layout} rows={rows} rowKey={row => row.id} rowLabel={row => row.refNumber || row.id}
      page={page} isPageDataPending={rowsQuery.isFetching || query.trim() !== debouncedQuery.trim()} selectable selectedIds={ids}
      isRowSelectable={row => !processMutation.isPending && canSelect(row)}
      renderSelectCellActions={isQueue ? renderBlockedHint : undefined}
      allPageSelected={rows.length > 0 && rows.every(row => ids.includes(row.id))}
      onToggleSelect={toggle} onToggleSelectAll={togglePage} onRowClick={onView}
      sort={sort} onSortChange={(field, direction) => {setSort(`${field}:${direction}`); setPage(1);}}
      emptyState={<p role="status">{rowsQuery.isLoading ? t("accounting.dailyIncome.transactions.loadingTitle") : t("accounting.dailyIncome.transactions.empty")}</p>}
    />}
    <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{listSummary}</p><TablePaginationControls allowAll={false} page={page} totalPages={Math.max(1, Math.ceil(total / pageLimit))} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize} disabled={rowsQuery.isFetching || processMutation.isPending}/></div>
    <Dialog open={confirmOpen} onOpenChange={open => {if (!processMutation.isPending) setConfirmOpen(open);}}><DialogContent className={clearance ? "sm:max-w-4xl" : undefined}><DialogHeader><DialogTitle>{text("confirmTitle")}</DialogTitle><DialogDescription>{text("confirmDescription")}</DialogDescription></DialogHeader>
      <p>{text("selectedCount")} {command?.ids.length}</p>
      {clearance ? <ClearanceConfirmList rows={commandRows} chartAccountsById={chartAccountsById}/> : null}
      <JournalTotals label={text("selectedTotals")} totals={selectedTotals.data} loading={selectedTotals.isFetching}/>
      {processMutation.isError ? <p role="alert" className="text-destructive">{normalizeApiError(processMutation.error).message}</p> : null}
      {outcome ? <div role="status" className="max-h-64 space-y-2 overflow-y-auto text-sm">
        <p>{text(outcome.complete ? "batchComplete" : "batchUnconfirmed")}</p>
        {outcome.confirmed.map(id => <p key={id}>{id} — {text("confirmed")}</p>)}
        {outcome.unconfirmed.map(id => <p key={id}>{id} — {text("unconfirmed")}</p>)}
      </div> : null}
      <DialogFooter><Button variant="outline" disabled={processMutation.isPending} onClick={() => setConfirmOpen(false)}>{t("common.actions.cancel")}</Button><Button disabled={(!ready && !outcome) || outcome?.complete === true || processMutation.isPending || !command} onClick={() => {if (!command) return;
 const onSuccess = (acknowledged: string[] | undefined) => {
 const result = atomicBatchOutcome(command.ids,[...(outcome?.confirmed??[]),...(Array.isArray(acknowledged)?acknowledged:[])]);
 setOutcome(result);
 setSelected(current => Object.fromEntries(Object.entries(current).filter(([id]) => !result.confirmed.includes(id))));
 setPage(1);
 // Keep the exact original command for an uncertain-response retry. Its UUID
 // must never be reused with only the omitted IDs or another payload.
 };
 if (clearance) clearanceMutation.mutate({...command,
   invoices: commandRows.flatMap(row => row.invoice?.id ? [{id: String(row.invoice.id), number: row.invoice.number}] : []),
   incomeStatementIds: [...new Set(commandRows.map(row => row.incomeStatementId).filter(id => id > 0))],
 }, {onSuccess: response => onSuccess(response?.data?.cleared)});
 else reconciliationMutation.mutate(command, {onSuccess: response => onSuccess(response?.data?.reconciled)});
 }}>{actionLabel}</Button></DialogFooter>
    </DialogContent></Dialog>
  </Card>;
}
function ClearanceConfirmList({rows, chartAccountsById}: {rows: DailyIncomeJournal[]; chartAccountsById: ChartAccountsById}) {
  const {t} = useTranslation();
  const dash = t("common.empty.dash");
  const headers = [t("accounting.dailyIncome.columns.date"), t("accounting.dailyIncome.columns.invoice"), t("accounting.dailyIncome.columns.reference"), t("accounting.journalClearance.confirmList.externalReference"), t("accounting.dailyIncome.columns.paymentMethod"), t("accounting.dailyIncome.columns.accountName"), t("accounting.dailyIncome.columns.payment")];
  return <div className="max-h-64 overflow-auto rounded-md border">
    <table className="w-full text-xs">
      <caption className="sr-only">{t("accounting.journalClearance.confirmList.caption")}</caption>
      <thead className="sticky top-0 bg-muted text-left text-muted-foreground"><tr>{headers.map((label, index) => <th key={label} scope="col" className={`whitespace-nowrap px-2 py-1.5 font-medium${index === headers.length - 1 ? " text-right" : ""}`}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t">
        <td className="whitespace-nowrap px-2 py-1.5">{row.date ? formatAuditDate(row.date) : dash}</td>
        <td className="whitespace-nowrap px-2 py-1.5">{row.invoice?.number || dash}</td>
        <td className="whitespace-nowrap px-2 py-1.5">{row.refNumber || dash}</td>
        <td className="whitespace-nowrap px-2 py-1.5">{row.checkNumber || row.externalReferenceNumber || dash}</td>
        <td className="whitespace-nowrap px-2 py-1.5">{row.paymentMethod?.name || dash}</td>
        <td className="px-2 py-1.5">{resolveJournalRowAccount(row, chartAccountsById)?.name || dash}</td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums">{formatDailyIncomeMoney(row.amount, row.currency || "USD")}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
function JournalTotals({label, totals, loading}: {label: string; totals?: JournalCurrencySummary[]; loading: boolean}) {
  const {t, locale} = useTranslation();
  const number = (value: number) => value.toLocaleString(locale, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return <div aria-busy={loading} className="space-y-2 text-sm">
    <p className="font-medium">{label}</p>
    {loading ? <span role="status" className="text-muted-foreground">{t("accounting.dailyIncome.transactions.loadingTitle")}</span> : totals?.map(row => <div key={row.currency} className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="text-xs font-semibold text-muted-foreground">{row.currency || "—"}</span>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">{t("accounting.journalReconciliation.income")}</dt><dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{number(row.income)}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">{t("accounting.journalReconciliation.expenses")}</dt><dd className="font-medium tabular-nums text-rose-600 dark:text-rose-400">{number(row.expenses)}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">{t("accounting.journalReconciliation.net")}</dt><dd className="font-semibold tabular-nums">{number(row.net)}</dd></div>
      </dl>
    </div>)}
  </div>;
}
