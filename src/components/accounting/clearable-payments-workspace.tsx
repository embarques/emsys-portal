"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { ClearablePaymentViewSheet } from "@/components/accounting/clearable-payment-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionActionDivider } from "@/components/app-shell/table-selection-action-group";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterPanel } from "@/components/app-shell/table-advanced-filter-panel";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { CLEARABLE_PAYMENT_API_TABLE_FIELDS } from "@/lib/accounting/clearable-payments/table-fields";
import { CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS } from "@/lib/accounting/clearable-payments/filter-fields";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { formatAccountingMoney } from "@/lib/accounting/display";
import type { ClearablePaymentMethodConfig } from "@/lib/accounting/clearable-payments/configs";
import { getClearablePaymentStatusBadgeClass } from "@/lib/accounting/clearable-payments/display";
import {
  useClearablePayments,
  useUpdateClearablePayment,
} from "@/lib/accounting/clearable-payments/hooks";
import {
  buildClearablePaymentListParams,
  clearablePaymentStatusI18nKey,
  clearablePaymentToFormValues,
  DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
  todayClearablePaymentDateInputValue,
  type ClearablePayment,
} from "@/lib/accounting/clearable-payments/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { countCompleteFilterRows, type TableFilterRowState } from "@/lib/table/filter-builder";
import { useLocalizedFilterFields } from "@/lib/table/hooks/use-localized-filter-fields";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";

const SEARCH_DEBOUNCE_MS = 300;

type ClearablePaymentsWorkspaceProps = {
  config: ClearablePaymentMethodConfig;
};

export function ClearablePaymentsWorkspace({ config }: ClearablePaymentsWorkspaceProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const i18n = `accounting.${config.i18nKey}`;
  const canView = hasPermission(config.permissions.view.name, config.permissions.view.resourceType);
  const canUpdate = false;
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.sort, () =>
    setPage(1),
  );
  const [query, setQuery] = useState("");
  const [filterRows, setFilterRows] = useState<TableFilterRowState[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const localizeStatusOption = useCallback(
    (field: string, option: { value: string; label: string }, translate: (key: string) => string) =>
      field === "status"
        ? { ...option, label: translate(`${i18n}.status.${option.value.toLowerCase()}`) }
        : option,
    [i18n],
  );
  const sharedFilterFields = useLocalizedFilterFields(
    CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS,
    "accounting.clearablePayments.filters.fields",
    localizeStatusOption,
  );
  const filterFields = useMemo(
    () =>
      sharedFilterFields.map((field) =>
        field.field === "paymentReference"
          ? { ...field, label: t(`${i18n}.columns.paymentReference`) }
          : field,
      ),
    [i18n, sharedFilterFields, t],
  );
  const activeFilterCount = countCompleteFilterRows(filterRows, filterFields);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const hasActiveSearch = Boolean(query.trim()) || activeFilterCount > 0;
  const isSearchPending = query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewPayment, setViewPayment] = useState<ClearablePayment | null>(null);

  const listParams = useMemo(
    () =>
      buildClearablePaymentListParams({
        page,
        limit: pageLimit,
        query: debouncedQuery,
        rows: filterRows,
        sort,
      }),
    [debouncedQuery, filterRows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useClearablePayments(config, listParams);
  const updateMutation = useUpdateClearablePayment(config);
  const payments = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const total = data?.total ?? 0;
  rememberTotal(total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRowIds = payments.map((payment) => payment.id);
  const selectedPayments = payments.filter((payment) => selectedIds.includes(payment.id));
  const selectedOutstanding = selectedPayments.filter((payment) => payment.status === "OUTSTANDING");
  const isSaving = updateMutation.isPending;

  useTableSelectionReset(buildTableSelectionResetKey(debouncedQuery, filterRows, sort), setSelectedIds);

  const columns: DataTableColumn<ClearablePayment>[] = useMemo(
    () => [
      {
        id: "status",
        label: t(`${i18n}.columns.status`),
        truncateCell: false,
        renderCell: (payment) => (
          <TableTagText className={getClearablePaymentStatusBadgeClass(payment.status)}>
            {t(`${i18n}.status.${clearablePaymentStatusI18nKey(payment.status)}`)}
          </TableTagText>
        ),
      },
      {
        id: "paymentReference",
        label: t(`${i18n}.columns.paymentReference`),
        sortField: "paymentReference",
        cellClassName: "font-medium tabular-nums",
        renderCell: (payment) => payment.paymentReference || t("common.empty.dash"),
      },
      {
        id: "invoiceNumber",
        label: t(`${i18n}.columns.invoiceNumber`),
        sortField: "invoice.number",
        renderCell: (payment) => payment.invoice.number || t("common.empty.dash"),
      },
      {
        id: "paymentAmount",
        label: t(`${i18n}.columns.paymentAmount`),
        renderCell: (payment) => formatAccountingMoney(payment.paymentAmount),
      },
      {
        id: "datePosted",
        label: t(`${i18n}.columns.datePosted`),
        renderCell: (payment) =>
          payment.datePosted ? formatAuditDate(payment.datePosted) : t("common.empty.dash"),
      },
      {
        id: "refNumber",
        label: t(`${i18n}.columns.referenceNumber`),
        renderCell: (payment) => payment.refNumber || t("common.empty.dash"),
      },
      {
        id: "createdAt",
        label: t(`${i18n}.columns.createdAt`),
        renderCell: (payment) =>
          payment.createdAt ? formatAuditDateTime(payment.createdAt) : t("common.empty.dash"),
      },
      {
        id: "createdBy",
        label: t(`${i18n}.columns.createdBy`),
        sortField: "createdBy.name",
        renderCell: (payment) => payment.createdBy || t("common.empty.dash"),
      },
    ],
    [i18n, t],
  );

  const columnLayout = useApiTableColumns(config.columnStorageKey, columns, CLEARABLE_PAYMENT_API_TABLE_FIELDS);
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveSearch,
      query,
      isSearchPending,
      matched: total,
      noun: t(`${i18n}.noun`),
      isLoading: isFetching && payments.length === 0,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: payments.length,
      page: currentPage,
      pageSize: pageLimit,
      total,
      noun: t(`${i18n}.noun`),
      isFiltered: hasActiveSearch,
      isLoading: isFetching,
    },
    t,
  );

  async function markPaymentsCleared(targets: ClearablePayment[]) {
    if (!canUpdate) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    const outstanding = targets.filter((payment) => payment.status === "OUTSTANDING");
    if (outstanding.length === 0) return;

    const today = todayClearablePaymentDateInputValue();

    try {
      const updated: ClearablePayment[] = [];
      for (const payment of outstanding) {
        const result = await updateMutation.mutateAsync({
          paymentId: payment.id,
          journalId: payment.journalId,
          values: {
            ...clearablePaymentToFormValues(payment),
            status: "CLEARED",
            clearedAt: payment.clearedAt.slice(0, 10) || today,
          },
        });
        updated.push(result);
      }

      const count = updated.length;
      feedback.notifySuccess(
        count === 1
          ? t(`${i18n}.toasts.markedCleared`, { count })
          : t(`${i18n}.toasts.markedCleared_plural`, { count }),
      );
      setViewPayment((current) => {
        if (!current) return current;
        return updated.find((payment) => payment.id === current.id) ?? current;
      });
      setSelectedIds((current) =>
        current.filter((id) => !outstanding.some((payment) => payment.id === id)),
      );
    } catch (statusError) {
      feedback.notifyError(normalizeApiError(statusError).message);
    }
  }

  return (
    <div>
      <PageHeader title={t(`${i18n}.title`)} description={t(`${i18n}.description`)} />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <div>
            <CardTitle>{t(`${i18n}.title`)}</CardTitle>
            <CardDescription>{t(`${i18n}.description`)}</CardDescription>
          </div>
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            filterPanel={
              <TableAdvancedFilterPanel
                presetScope={`accounting-${config.queryKeySegment}`}
                open={filtersOpen}
                rows={filterRows}
                fields={filterFields}
                resultSummary={listSummary}
                onRowsChange={(rows) => {
                  setFilterRows(rows);
                  setPage(1);
                }}
                onClearAll={
                  hasActiveSearch
                    ? () => {
                        setQuery("");
                        setFilterRows([]);
                        setPage(1);
                      }
                    : undefined
                }
              />
            }
            columnLayout={columnLayout}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder={t(`${i18n}.searchPlaceholder`)}
              />
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRowIds}
          totalCount={total}
          onSelectedIdsChange={setSelectedIds}
          onView={() => {
            const payment = selectedPayments[0];
            if (payment) setViewPayment(payment);
          }}
          canView={canView}
          canEdit={false}
          canDelete={false}
          actions={
            canUpdate && selectedOutstanding.length > 0 ? (
              <>
                <TableSelectionActionDivider />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => markPaymentsCleared(selectedOutstanding)}
                  className="bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t(`${i18n}.actions.markCleared`)}
                </Button>
              </>
            ) : null
          }
        />

        {isError ? (
          <div className="border-b px-6 py-3 text-sm text-destructive">
            {normalizeApiError(error).message}
          </div>
        ) : (
          <DataTable
            columns={columnLayout.columns}
            rows={payments}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(payment) => payment.id}
            rowLabel={(payment) => payment.paymentReference || payment.invoice.number}
            columnLayout={columnLayout}
            minWidth={1100}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id))}
            onToggleSelectAll={(checked) => {
              if (checked) {
                setSelectedIds((current) => Array.from(new Set([...current, ...pageRowIds])));
                return;
              }

              setSelectedIds((current) => current.filter((id) => !pageRowIds.includes(id)));
            }}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) =>
                checked ? Array.from(new Set([...current, id])) : current.filter((entry) => entry !== id),
              );
            }}
            onRowClick={canView ? setViewPayment : undefined}
            activeRowId={viewPayment?.id}
            emptyState={
              <p className="text-muted-foreground">
                {hasActiveSearch ? t(`${i18n}.empty`) : t(`${i18n}.emptyNone`)}
              </p>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
        </div>
      </Card>

      <ClearablePaymentViewSheet
        config={config}
        payment={viewPayment}
        open={Boolean(viewPayment)}
        onOpenChange={(open) => {
          if (!open) setViewPayment(null);
        }}
        onMarkCleared={(payment) => markPaymentsCleared([payment])}
        canMarkCleared={canUpdate}
        isMarkingCleared={isSaving}
      />
    </div>
  );
}
