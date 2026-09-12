"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";

import { DataTable } from "@/components/app-shell/data-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import {
  formatUserActivityOrigin,
  formatUserActivityQuantity,
  getUserActivitySeverityClass,
} from "@/lib/user-activities/display";
import { useUserActivities } from "@/lib/user-activities/hooks/use-user-activities";
import {
  buildUserActivityListParams,
  DEFAULT_USER_ACTIVITY_LIST_PARAMS,
  type UserActivity,
} from "@/lib/user-activities/types";
import { useResolvedPaginatedItems } from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export function UserActivitiesWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission(
    PERMISSIONS.userActivitiesView.name,
    PERMISSIONS.userActivitiesView.resourceType,
  );

  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_USER_ACTIVITY_LIST_PARAMS.sort, () =>
    setPage(1),
  );
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const hasActiveSearch = Boolean(query.trim());
  const isSearchPending = query.trim() !== debouncedQuery.trim();

  const listParams = useMemo(
    () =>
      buildUserActivityListParams({
        page,
        limit: pageLimit,
        query: debouncedQuery,
        sort,
      }),
    [debouncedQuery, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useUserActivities(listParams, {
    enabled: canView,
  });
  const activities = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const total = data?.total ?? 0;
  rememberTotal(total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const dash = t("common.empty.dash");

  const columns: DataTableColumn<UserActivity>[] = useMemo(
    () => [
      {
        id: "timestamp",
        label: t("userActivities.columns.timestamp"),
        sortField: "timestamp",
        renderCell: (row) => (
          <span className={cn(getUserActivitySeverityClass(row.severity))}>
            {row.timestamp ? formatAuditDateTime(row.timestamp) : dash}
          </span>
        ),
      },
      {
        id: "user",
        label: t("userActivities.columns.user"),
        sortField: "user.name",
        renderCell: (row) => (
          <span className={cn(getUserActivitySeverityClass(row.severity))}>
            {row.user.name || dash}
          </span>
        ),
      },
      {
        id: "description",
        label: t("userActivities.columns.description"),
        sortField: "description",
        cellClassName: "max-w-[28rem]",
        renderCell: (row) => (
          <span className={cn(getUserActivitySeverityClass(row.severity))}>
            {row.description || dash}
          </span>
        ),
      },
      {
        id: "origin",
        label: t("userActivities.columns.origin"),
        sortField: "origin",
        renderCell: (row) => (
          <span className={cn(getUserActivitySeverityClass(row.severity))}>
            {formatUserActivityOrigin(row.origin, dash)}
          </span>
        ),
      },
      {
        id: "entityId",
        label: t("userActivities.columns.id"),
        sortField: "id",
        renderCell: (row) => (
          <span className={cn("font-mono text-xs", getUserActivitySeverityClass(row.severity))}>
            {row.entityId || dash}
          </span>
        ),
      },
      {
        id: "quantity",
        label: t("userActivities.columns.quantity"),
        sortField: "quantity",
        renderCell: (row) => (
          <span className={cn(getUserActivitySeverityClass(row.severity))}>
            {formatUserActivityQuantity(row.quantity, dash)}
          </span>
        ),
      },
      {
        id: "severity",
        label: t("userActivities.columns.severity"),
        sortField: "severity",
        renderCell: (row) => (
          <span className={cn(getUserActivitySeverityClass(row.severity))}>
            {t(`userActivities.severity.${row.severity}`)}
          </span>
        ),
      },
    ],
    [dash, t],
  );

  const columnLayout = useColumnVisibility("user-activities-v1", columns);
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveSearch,
      query,
      isSearchPending,
      matched: total,
      noun: t("userActivities.noun"),
      isLoading: isFetching && activities.length === 0,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: activities.length,
      page: currentPage,
      pageSize: pageLimit,
      total,
      noun: t("userActivities.noun"),
      isFiltered: hasActiveSearch,
      isLoading: isFetching,
    },
    t,
  );

  if (!canView) {
    return (
      <div>
        <PageHeader
          title={t("userActivities.title")}
          description={t("userActivities.description")}
        />
        <Card className="mt-6 gap-0">
          <div className="px-6 py-8 text-sm text-muted-foreground">
            {t("common.errors.api.forbidden")}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("userActivities.title")}
        description={t("userActivities.description")}
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <div>
            <CardTitle>{t("userActivities.title")}</CardTitle>
            <CardDescription>{t("userActivities.description")}</CardDescription>
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
                placeholder={t("userActivities.searchPlaceholder")}
              />
            }
          />
        </CardHeader>

        {isError ? (
          <div className="border-b px-6 py-3 text-sm text-destructive">
            {normalizeApiError(error).message}
          </div>
        ) : (
          <DataTable
            columns={columnLayout.columns}
            rows={activities}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(row) => row.activityId}
            rowLabel={(row) => row.description || row.entityId || row.activityId}
            columnLayout={columnLayout}
            minWidth={1100}
            sort={sort}
            onSortChange={onSortChange}
            emptyState={
              <>
                <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                <p className="text-muted-foreground">
                  {isLoading
                    ? t("userActivities.empty.loading")
                    : hasActiveSearch
                      ? t("userActivities.empty.noMatches")
                      : t("userActivities.empty.noResults")}
                </p>
              </>
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
          />
        </div>
      </Card>
    </div>
  );
}
