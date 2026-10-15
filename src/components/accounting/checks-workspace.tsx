"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { CheckViewSheet } from "@/components/accounting/check-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionActionDivider } from "@/components/app-shell/table-selection-action-group";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { CHECK_API_TABLE_FIELDS } from "@/lib/accounting/checks/table-fields";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { getCheckStatusBadgeClass } from "@/lib/accounting/checks/display";
import { useChecks, useUpdateCheck } from "@/lib/accounting/checks/hooks/use-checks";
import {
  buildCheckListParams,
  checkStatusI18nKey,
  checkToFormValues,
  DEFAULT_CHECK_LIST_PARAMS,
  todayCheckDateInputValue,
  type Check,
} from "@/lib/accounting/checks/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";

const SEARCH_DEBOUNCE_MS = 300;

export function ChecksWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const canViewChecks = hasPermission(PERMISSIONS.checksView.name, PERMISSIONS.checksView.resourceType);
  const canUpdateChecks = hasPermission(
    PERMISSIONS.checksUpdate.name,
    PERMISSIONS.checksUpdate.resourceType,
  );
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_CHECK_LIST_PARAMS.sort, () => setPage(1));
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const hasActiveSearch = Boolean(query.trim());
  const isSearchPending = query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewCheck, setViewCheck] = useState<Check | null>(null);

  const listParams = useMemo(
    () =>
      buildCheckListParams({
        page,
        limit: pageLimit,
        query: debouncedQuery,
        sort,
      }),
    [debouncedQuery, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useChecks(listParams);
  const updateCheckMutation = useUpdateCheck();
  const checks = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const total = data?.total ?? 0;
  rememberTotal(total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRowIds = checks.map((check) => check.id);
  const selectedChecks = checks.filter((check) => selectedIds.includes(check.id));
  const selectedOutstandingChecks = selectedChecks.filter((check) => check.status === "OUTSTANDING");
  const isSaving = updateCheckMutation.isPending;

  useTableSelectionReset(buildTableSelectionResetKey(debouncedQuery, sort), setSelectedIds);

  const columns: DataTableColumn<Check>[] = useMemo(
    () => [
      {
        id: "status",
        label: t("accounting.checks.columns.status"),
        truncateCell: false,
        renderCell: (check) => (
          <TableTagText className={getCheckStatusBadgeClass(check.status)}>
            {t(`accounting.checks.status.${checkStatusI18nKey(check.status)}`)}
          </TableTagText>
        ),
      },
      {
        id: "checkNumber",
        label: t("accounting.checks.columns.checkNumber"),
        cellClassName: "font-medium",
        renderCell: (check) => check.checkNumber || t("common.empty.dash"),
      },
      {
        id: "invoiceNumber",
        label: t("accounting.checks.columns.invoiceNumber"),
        sortField: "invoice.number",
        renderCell: (check) => check.invoice.number || t("common.empty.dash"),
      },
      {
        id: "paymentAmount",
        label: t("accounting.checks.columns.paymentAmount"),
        renderCell: (check) => formatAccountingMoney(check.paymentAmount),
      },
      {
        id: "datePosted",
        label: t("accounting.checks.columns.datePosted"),
        renderCell: (check) => (check.datePosted ? formatAuditDate(check.datePosted) : t("common.empty.dash")),
      },
      {
        id: "refNumber",
        label: t("accounting.checks.columns.referenceNumber"),
        renderCell: (check) => check.refNumber || t("common.empty.dash"),
      },
      {
        id: "createdAt",
        label: t("accounting.checks.columns.createdAt"),
        renderCell: (check) => (check.createdAt ? formatAuditDateTime(check.createdAt) : t("common.empty.dash")),
      },
      {
        id: "createdBy",
        label: t("accounting.checks.columns.createdBy"),
        sortField: "createdBy.name",
        renderCell: (check) => check.createdBy || t("common.empty.dash"),
      },
    ],
    [t],
  );

  const columnLayout = useApiTableColumns("accounting-checks-v3", columns, CHECK_API_TABLE_FIELDS);
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveSearch,
      query,
      isSearchPending,
      matched: total,
      noun: t("accounting.checks.noun"),
      isLoading: isFetching && checks.length === 0,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: checks.length,
      page: currentPage,
      pageSize: pageLimit,
      total,
      noun: t("accounting.checks.noun"),
      isFiltered: hasActiveSearch,
      isLoading: isFetching,
    },
    t,
  );

  async function markChecksCleared(targets: Check[]) {
    if (!canUpdateChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    const outstanding = targets.filter((check) => check.status === "OUTSTANDING");
    if (outstanding.length === 0) return;

    const today = todayCheckDateInputValue();

    try {
      const updated: Check[] = [];
      for (const check of outstanding) {
        const result = await updateCheckMutation.mutateAsync({
          checkId: check.id,
          journalId: check.journalId,
          values: {
            ...checkToFormValues(check),
            status: "CLEARED",
            clearedAt: check.clearedAt.slice(0, 10) || today,
          },
        });
        updated.push(result);
      }

      const count = updated.length;
      feedback.notifySuccess(
        count === 1
          ? t("accounting.checks.toasts.markedCleared", { count })
          : t("accounting.checks.toasts.markedCleared_plural", { count }),
      );
      setViewCheck((current) => {
        if (!current) return current;
        return updated.find((check) => check.id === current.id) ?? current;
      });
      setSelectedIds((current) => current.filter((id) => !outstanding.some((check) => check.id === id)));
    } catch (statusError) {
      feedback.notifyError(normalizeApiError(statusError).message);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("accounting.checks.title")}
        description={t("accounting.checks.description")}
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <div>
            <CardTitle>{t("accounting.checks.title")}</CardTitle>
            <CardDescription>{t("accounting.checks.description")}</CardDescription>
          </div>
          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnLayout}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder={t("accounting.checks.searchPlaceholder")}
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
            const check = selectedChecks[0];
            if (check) setViewCheck(check);
          }}
          canView={canViewChecks}
          canEdit={false}
          canDelete={false}
          actions={
            canUpdateChecks && selectedOutstandingChecks.length > 0 ? (
              <>
                <TableSelectionActionDivider />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => markChecksCleared(selectedOutstandingChecks)}
                  className="bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("accounting.checks.actions.markCleared")}
                </Button>
              </>
            ) : null
          }
        />

        {isError ? (
          <div className="border-b px-6 py-3 text-sm text-destructive">{normalizeApiError(error).message}</div>
        ) : (
          <DataTable
            columns={columnLayout.columns}
            rows={checks}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(check) => check.id}
            rowLabel={(check) => check.checkNumber || check.invoice.number}
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
            onRowClick={canViewChecks ? setViewCheck : undefined}
            activeRowId={viewCheck?.id}
            emptyState={
              <p className="text-muted-foreground">
                {hasActiveSearch ? t("accounting.checks.empty") : t("accounting.checks.emptyNone")}
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

      <CheckViewSheet
        check={viewCheck}
        open={Boolean(viewCheck)}
        onOpenChange={(open) => {
          if (!open) setViewCheck(null);
        }}
        onMarkCleared={(check) => markChecksCleared([check])}
        canMarkCleared={canUpdateChecks}
        isMarkingCleared={isSaving}
      />
    </div>
  );
}
