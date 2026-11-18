"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import {useEffect, useMemo, useState, type ReactNode} from "react";
import {CheckCircle2, Info, Printer} from "lucide-react";
import {DataTable} from "@/components/app-shell/data-table";
import {useApiTableColumns} from "@/components/app-shell/use-api-table-columns";
import {TableDirectoryToolbar} from "@/components/app-shell/table-directory-toolbar";
import {TableAdvancedFilterPanel} from "@/components/app-shell/table-advanced-filter-panel";
import {TableSearchInput} from "@/components/app-shell/table-search-input";
import {TablePaginationControls} from "@/components/app-shell/table-pagination-controls";
import {TableSelectionActionsMenu} from "@/components/app-shell/table-selection-actions-menu";
import {TableSelectionToolbar} from "@/components/app-shell/table-selection-toolbar";
import {JournalLifecycleActions} from "@/components/accounting/journal-lifecycle-actions";
import {JournalTotals} from "@/components/accounting/journal-totals";
import {Card, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {useLocalizedFilterFields} from "@/lib/table/hooks/use-localized-filter-fields";
import {createRandomId} from "@/lib/utils/id";
import {useAuth} from "@/lib/auth/hooks/use-auth";
import {useTranslation} from "@/lib/i18n";
import {normalizeApiError} from "@/lib/api/axios";
import {useTablePageSize} from "@/lib/table/hooks/use-table-page-size";
import {tableSelectionActionMenuStyles, tableSelectionActionStyles} from "@/lib/table/selection-action-styles";
import {cn} from "@/lib/utils";
import {countCompleteFilterRows, type TableFilterRowState} from "@/lib/table/filter-builder";
import {DAILY_INCOME_TABLE_FILTER_FIELDS, PENDING_JOURNAL_TABLE_FILTER_FIELDS} from "@/lib/accounting/daily-income/journal-search";
import {DAILY_INCOME_JOURNAL_API_TABLE_FIELDS} from "@/lib/accounting/daily-income/table-fields";
import {useJournalRows, useJournalSummary} from "@/lib/accounting/daily-income/reconciliation";
import {getJournalQueueBlockReason, isJournalQueueActionable, type JournalQueueBlockReason} from "@/lib/accounting/daily-income/journal-queue";
import {
  getJournalBatchSelectionBlockReason,
  getJournalBatchSelectionKey,
  journalsShareBatchSelection,
} from "@/lib/accounting/daily-income/journal-batch-selection";
import type {DailyIncomeJournal} from "@/lib/accounting/daily-income/types";
import {canPrintPaymentReceipt} from "@/lib/accounting/daily-income/print-payment-receipt";
import {buildChartAccountsById} from "@/lib/accounting/daily-income/journal-account";
import {
  stashJournalBatch,
  subscribeJournalBatchConfirmed,
} from "@/lib/accounting/daily-income/journal-batch-draft";
import {useChartAccounts} from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import {useWorkspaceTabs} from "@/lib/layout/hooks/use-workspace-tabs";
import {journalTableColumns} from "./journal-table-columns";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";

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

type SelectionBlockReason = JournalQueueBlockReason | "paymentMethod" | "moneyAccount" | "limit";

export function JournalTransactionsTable(props: JournalTransactionsTableProps) {
  const {companyId,user,email,roleId} = useAuth();
  return <JournalTable key={`${companyId}:${user?.uid??email}:${roleId}:${props.clearance ? "clearance" : props.pending ? "reconciliation" : "closeout"}`} {...props}/>;
}
function JournalTable({incomeStatementId = 0, pending = false, clearance = false, headerActions, isPrintingReceipt = false, onView, onEdit, canEditRow, onPrintReceipt}: JournalTransactionsTableProps) {
  const {t} = useTranslation();
  const {hasPermission} = useAuth();
  const {openFormTab} = useWorkspaceTabs();
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
  const params = {incomeStatementId, pending: pending && !clearance, pendingClearance: clearance, page, limit: pageLimit, query: debouncedQuery, filterRows, sort};
  const rowsQuery = useJournalRows(params);
  const rows = rowsQuery.data?.items ?? [];
  const total = rowsQuery.data?.total ?? 0;
  const ids = Object.keys(selected);
  const canProcess = isQueue && hasPermission(clearance ? "canClearJournal" : "canReconcileJournal", "journal");
  const selectedTotals = useJournalSummary({ids}, ids.length > 0);
  useEffect(() => subscribeJournalBatchConfirmed((confirmedIds) => {
    if (confirmedIds.length === 0) return;
    setSelected((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !confirmedIds.includes(id))));
    setPage(1);
  }), [setPage]);
  const fields = useLocalizedFilterFields(isQueue ? PENDING_JOURNAL_TABLE_FILTER_FIELDS : DAILY_INCOME_TABLE_FILTER_FIELDS, "accounting.journalReconciliation.fields");
  const activeFilterCount = countCompleteFilterRows(filterRows, fields);
  const hasActiveSearch = Boolean(query.trim()) || activeFilterCount > 0;
  const noun = t("accounting.dailyIncome.noun");
  const listSummary = formatPaginatedListSummary({itemCountOnPage: rows.length, page, pageSize: pageLimit, total, noun, isFiltered: hasActiveSearch, isLoading: rowsQuery.isFetching}, t);
  const chartAccountsQuery = useChartAccounts({page: 1, limit: 500}, hasPermission("canViewChartAccount", "chart_account"));
  const chartAccountsById = useMemo(() => buildChartAccountsById(chartAccountsQuery.data?.items ?? []), [chartAccountsQuery.data]);
  const tableVariant = clearance ? "clearance" : pending ? "reconciliation" : "closeout";
  const columnStorageKey =
    tableVariant === "clearance"
      ? "journal-clearance-v2"
      : tableVariant === "reconciliation"
        ? "journal-reconciliation-v2"
        : "journal-transactions-v2";
  const columns = useMemo(
    () => journalTableColumns(t, chartAccountsById, tableVariant).map((column) => ({
      ...column,
      sortable: column.id === "date" || column.id === "createdAt",
    })),
    [t, chartAccountsById, tableVariant],
  );
  const layout = useApiTableColumns(columnStorageKey, columns, DAILY_INCOME_JOURNAL_API_TABLE_FIELDS);
  const batchKey = ids.length ? getJournalBatchSelectionKey(selected[ids[0]]) : undefined;
  function selectionBlockReason(row: DailyIncomeJournal): SelectionBlockReason | null {
    if (ids.includes(row.id)) return null;
    if (ids.length >= 200) return "limit";
    if (!canProcess) return null;
    const reason = getJournalQueueBlockReason(row, queue);
    if (reason) return reason;
    return getJournalBatchSelectionBlockReason(batchKey, row);
  }
  const canSelect = (row: DailyIncomeJournal) => selectionBlockReason(row) === null;
  const selectablePageIds = rows.filter(canSelect).map(row => row.id);
  function applySelectedIds(nextIds: string[]) {
    const pageIdSet = new Set(rows.map(row => row.id));
    const limitedIds = canProcess ? nextIds.slice(0, 200) : nextIds;
    setSelected(current => {
      const next: Record<string, DailyIncomeJournal> = {};
      for (const id of limitedIds) {
        if (current[id]) {
          next[id] = current[id];
          continue;
        }
        if (!pageIdSet.has(id)) continue;
        const row = rows.find(item => item.id === id);
        if (row) next[id] = row;
      }
      return next;
    });
  }
  function renderBlockedHint(row: DailyIncomeJournal) {
    const reason = selectionBlockReason(row);
    if (!reason) return null;
    const scope = clearance ? "journalClearance" : "journalReconciliation";
    const label = t(`accounting.${scope}.blocked.${reason}`, {
      method: batchKey?.paymentMethod || t(`accounting.${scope}.blocked.noMethod`),
      account: batchKey?.moneyAccountName || t(`accounting.${scope}.blocked.noMoneyAccount`),
    });
    return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={label}><Info className="size-4" aria-hidden="true"/></Button></TooltipTrigger><TooltipContent className="max-w-xs">{label}</TooltipContent></Tooltip>;
  }
  function toggle(id: string, checked: boolean) {
    const row = rows.find(item => item.id === id);
    if (checked && (!row || !canSelect(row))) return;
    setSelected(current => {
      const next = {...current};
      if (checked && row) next[id] = row; else delete next[id];
      return next;
    });
  }
  function resetFilters(next: TableFilterRowState[]) {
    setFilterRows(next); setPage(1); setSelected({});
  }
  function togglePage(checked: boolean) {
    setSelected(current => {
      const next = {...current};
      const pageKey =
        batchKey ??
        (canProcess
          ? (() => {
              const first = rows.find((row) => isJournalQueueActionable(row, queue));
              return first ? getJournalBatchSelectionKey(first) : undefined;
            })()
          : undefined);
      for (const row of rows) {
        if (!checked) delete next[row.id];
        else if (
          Object.keys(next).length < 200 &&
          (!canProcess || (isJournalQueueActionable(row, queue) && journalsShareBatchSelection(pageKey, row)))
        ) {
          next[row.id] = row;
        }
      }
      return next;
    });
  }
  function openConfirm() {
    const requestId = createRandomId();
    const batchIds = [...ids];
    const batchRows = batchIds.map((id) => selected[id]);
    stashJournalBatch({
      queue: clearance ? "clearance" : "reconciliation",
      requestId,
      ids: batchIds,
      rows: batchRows,
    });
    openFormTab({
      feature: clearance ? "journal-clearance-batch" : "journal-reconciliation-batch",
      baseHref: clearance ? "/accounting/pending-clearance" : "/accounting/pending-financial-activity",
      mode: "stage",
      entityId: requestId,
      label: actionLabel,
      journalBatch: {
        queue: clearance ? "clearance" : "reconciliation",
        requestId,
        ids: batchIds,
      },
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
      activeFilterCount={activeFilterCount}
      filterPanel={<TableAdvancedFilterPanel isLoading={rowsQuery.isFetching || query.trim() !== debouncedQuery.trim()} presetScope={clearance ? "pending-clearance" : pending ? "pending-journals" : "daily-income-journals"} open={filtersOpen} rows={filterRows} fields={fields} resultSummary={listSummary} onRowsChange={resetFilters} onClearAll={() => resetFilters([])}/>}
      search={<TableSearchInput value={query} onChange={value => {setQuery(value); setPage(1); setSelected({});}} placeholder={t("accounting.dailyIncome.transactions.searchPlaceholder")}/>}
    />
    </CardHeader>
    <TableSelectionToolbar
      selectedIds={ids}
      pageRowIds={selectablePageIds}
      totalCount={total}
      onSelectedIdsChange={applySelectedIds}
      canDelete={false}
      onEdit={onEdit ? () => onEdit(selected[ids[0]]) : undefined}
      canEdit={Boolean(onEdit && canEditRow)}
      editDisabled={ids.length !== 1 || !canEditRow?.(selected[ids[0]])}
      meta={selectedTotals.isError
        ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(selectedTotals.error).message}</p>
        : <JournalTotals layout="inline" label={text("selectedTotals")} totals={selectedTotals.data} journals={ids.map(id => selected[id])} chartAccounts={chartAccountsQuery.data?.items ?? []} loading={selectedTotals.isFetching}/>}
      actions={<>
        {ids.length === 1 && onPrintReceipt && canPrintPaymentReceipt(selected[ids[0]]) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isPrintingReceipt}
            onClick={() => onPrintReceipt(selected[ids[0]])}
            className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
          >
            <Printer className="size-4" aria-hidden="true"/>
            {t("accounting.dailyIncome.actions.printReceipt")}
          </Button>
        ) : null}
        {canProcess || ids.length === 1 ? (
          <TableSelectionActionsMenu>
            {canProcess ? (
              <DropdownMenuItem disabled={!ready} onSelect={openConfirm} className={tableSelectionActionMenuStyles.complete}>
                <CheckCircle2 className="size-4" aria-hidden="true"/>
                {actionLabel}
              </DropdownMenuItem>
            ) : null}
            {ids.length === 1 ? (
              <JournalLifecycleActions
                key={`selection-lifecycle:${ids[0]}:${selected[ids[0]]?.version ?? 0}`}
                journal={selected[ids[0]]}
                variant="menu"
                onCompleted={() => setSelected({})}
              />
            ) : null}
          </TableSelectionActionsMenu>
        ) : null}
      </>}
    />
    {canProcess ? <p className="border-b px-6 py-3 text-sm text-muted-foreground">{text("sameMethod")}</p> : null}
    {rowsQuery.isError ? <p role="alert" className="px-6 py-3 text-sm text-destructive">{normalizeApiError(rowsQuery.error).message}</p> : <DataTable
      columns={layout.columns} columnLayout={layout} rows={rows} rowKey={row => row.id} rowLabel={row => row.refNumber || row.id}
      page={page} isPageDataPending={rowsQuery.isFetching || query.trim() !== debouncedQuery.trim()} selectable selectedIds={ids}
      isRowSelectable={row => canSelect(row)}
      renderSelectCellActions={isQueue ? renderBlockedHint : undefined}
      allPageSelected={rows.length > 0 && rows.every(row => ids.includes(row.id))}
      onToggleSelect={toggle} onToggleSelectAll={togglePage} onRowClick={onView}
      sort={sort} onSortChange={(field, direction) => {setSort(`${field}:${direction}`); setPage(1);}}
      emptyState={
        <p role="status" className="text-sm text-muted-foreground">
          {isQueue
            ? (hasActiveSearch ? text("emptyFiltered") : text("empty"))
            : t("accounting.dailyIncome.transactions.empty")}
        </p>
      }
    />}
    <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{listSummary}</p><TablePaginationControls allowAll={false} page={page} totalPages={Math.max(1, Math.ceil(total / pageLimit))} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize} disabled={rowsQuery.isFetching}/></div>
  </Card>;
}
