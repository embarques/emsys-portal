"use client";

import { TableAdvancedFilterPanel } from "@/components/app-shell/table-advanced-filter-panel";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useTranslation } from "@/lib/i18n";
import type { CatalogTableState } from "@/lib/table/hooks/use-catalog-table";

type CatalogTableToolbarProps<T> = {
  state: CatalogTableState<T>;
  presetScope: string;
  searchPlaceholder: string;
};

/** Search + filter toolbar for server-filtered catalog tables. */
export function CatalogTableToolbar<T>({ state, presetScope, searchPlaceholder }: CatalogTableToolbarProps<T>) {
  const { t } = useTranslation();
  const summary = state.hasActiveFilters ? t("common.table.matchCount", { count: state.total }) : undefined;

  return (
    <TableDirectoryToolbar
      filtersOpen={state.open}
      onFiltersOpenChange={state.setOpen}
      activeFilterCount={state.activeFilterCount}
      searchSummary={summary}
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

/** Pagination footer for server-filtered catalog tables. */
export function CatalogTablePagination<T>({ state }: { state: CatalogTableState<T> }) {
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
