"use client";

import type { ReactNode } from "react";

import { DataTable } from "@/components/app-shell/data-table";
import { TableAdvancedFilterPanel } from "@/components/app-shell/table-advanced-filter-panel";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import type { CatalogTableState } from "@/lib/table/hooks/use-catalog-table";
import type { DataTableColumn } from "@/lib/table/types";

type CatalogTableToolbarProps<T> = {
  state: CatalogTableState<T>;
  presetScope: string;
  searchPlaceholder: string;
  columnLayout?: TableColumnLayout;
};

/** Search + filter toolbar for server-filtered catalog tables. */
export function CatalogTableToolbar<T>({ state, presetScope, searchPlaceholder, columnLayout }: CatalogTableToolbarProps<T>) {
  const { t } = useTranslation();
  const summary = state.hasActiveFilters ? t("common.table.matchCount", { count: state.total }) : undefined;

  return (
    <TableDirectoryToolbar
      filtersOpen={state.open}
      onFiltersOpenChange={state.setOpen}
      activeFilterCount={state.activeFilterCount}
      searchSummary={summary}
      columnLayout={columnLayout}
      filterPanel={
        <TableAdvancedFilterPanel
          presetScope={presetScope}
          open={state.open}
          rows={state.rows}
          fields={state.fields}
          resultSummary={summary}
          onRowsChange={state.setRows}
          onClearAll={state.hasActiveFilters ? state.clear : undefined}
        />
      }
      search={<TableSearchInput value={state.query} onChange={state.setQuery} placeholder={searchPlaceholder} />}
    />
  );
}

type CatalogDataTableProps<T> = {
  state: CatalogTableState<T>;
  columns: DataTableColumn<T>[];
  columnLayout: TableColumnLayout;
  rowKey: (row: T) => string;
  rowLabel?: (row: T) => string;
  emptyMessage: string;
  retryLabel?: string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  activeRowId?: string;
  renderSelectCellActions?: (row: T) => ReactNode;
  minWidth?: number;
};

/** Sortable, selectable catalog table with the shared loading, error and empty states. */
export function CatalogDataTable<T>({
  state,
  columns,
  columnLayout,
  rowKey,
  rowLabel,
  emptyMessage,
  retryLabel,
  onRowClick,
  onRowDoubleClick,
  activeRowId,
  renderSelectCellActions,
  minWidth = 720,
}: CatalogDataTableProps<T>) {
  const { t } = useTranslation();

  if (state.isLoading) {
    return <p className="px-6 py-6 text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (state.isError) {
    return (
      <div className="space-y-3 border-b px-6 py-3">
        <p role="alert" className="text-sm text-destructive">{normalizeApiError(state.error).message}</p>
        {retryLabel ? (
          <Button variant="outline" onClick={() => void state.refetch()}>{retryLabel}</Button>
        ) : null}
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={state.items}
      rowKey={rowKey}
      rowLabel={rowLabel}
      columnLayout={columnLayout}
      page={state.pagination.page}
      sort={state.sort}
      onSortChange={state.onSortChange}
      minWidth={minWidth}
      selectable
      selectedIds={state.selection.selectedIds}
      allPageSelected={state.selection.allPageSelected}
      onToggleSelectAll={state.selection.toggleAll}
      onToggleSelect={state.selection.toggle}
      onRowClick={onRowClick}
      onRowDoubleClick={onRowDoubleClick}
      activeRowId={activeRowId}
      renderSelectCellActions={renderSelectCellActions}
      emptyState={
        <p className="text-sm text-muted-foreground">
          {state.hasActiveFilters ? t("common.table.noMatches") : emptyMessage}
        </p>
      }
    />
  );
}

/** Pagination footer for server-filtered catalog tables. */
export function CatalogTablePagination<T>({ state }: { state: CatalogTableState<T> }) {
  if (state.isLoading || state.isError) return null;

  return (
    <div className="flex justify-end border-t px-6 py-4">
      <TablePaginationControls
        page={state.pagination.page}
        totalPages={state.pagination.totalPages}
        pageSize={state.pagination.pageSize}
        onPageChange={state.pagination.setPage}
        onPageSizeChange={state.pagination.changePageSize}
        disabled={state.isLoading}
      />
    </div>
  );
}
