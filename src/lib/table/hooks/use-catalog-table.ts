import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, type QueryKey } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import type { SortDirection } from "@/lib/api/list-query";
import type { PaginatedResult } from "@/lib/api/types";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { buildTableSelectionResetKey } from "@/lib/table/directory-table-state";
import {
  countCompleteFilterRows,
  type TableFilterFieldDefinition,
  type TableFilterFieldOption,
  type TableFilterRowState,
} from "@/lib/table/filter-builder";
import { useLocalizedFilterFields } from "@/lib/table/hooks/use-localized-filter-fields";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableRowSelection } from "@/lib/table/hooks/use-table-row-selection";

const SEARCH_DEBOUNCE_MS = 300;

type UseCatalogTableOptions<T> = {
  fields: readonly TableFilterFieldDefinition[];
  enabled?: boolean;
  keepPrevious?: boolean;
  /** Locale prefix for field labels, e.g. `employeeTitles.filters.fields`. */
  keyPrefix: string;
  /** Initial `field:direction` sort; header clicks replace it. */
  defaultSort: string;
  /** Row identity for checkbox selection. */
  getRowId: (row: T) => string;
  queryKey: (params: CatalogPageParams) => QueryKey;
  fetchPage: (params: CatalogPageParams, signal?: AbortSignal) => Promise<PaginatedResult<T>>;
  localizeOption?: (
    field: string,
    option: TableFilterFieldOption,
    t: (key: string) => string,
  ) => TableFilterFieldOption;
};

/** Search box, advanced filters, header sort and pagination for a small catalog, all applied by the API. */
export function useCatalogTable<T>({ fields, keyPrefix, defaultSort, getRowId, queryKey, fetchPage, localizeOption, enabled = true, keepPrevious = true }: UseCatalogTableOptions<T>) {
  const [query, setQueryState] = useState("");
  const [rows, setRowsState] = useState<TableFilterRowState[]>([]);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState(defaultSort);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const localizedFields = useLocalizedFilterFields(fields, keyPrefix, localizeOption);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const activeFilterCount = countCompleteFilterRows(rows, localizedFields);
  const hasActiveFilters = Boolean(query.trim()) || activeFilterCount > 0;

  const params = useMemo<CatalogPageParams>(
    () => ({
      page,
      limit: pageLimit,
      sort,
      ...(debouncedQuery.trim() ? { query: debouncedQuery.trim() } : {}),
      ...(rows.length ? { filterRows: rows } : {}),
    }),
    [debouncedQuery, page, pageLimit, rows, sort],
  );

  const pageQuery = useWorkspaceQuery({
    queryKey: queryKey(params),
    enabled,
    queryFn: ({ signal }) => fetchPage(params, signal),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });

  const total = pageQuery.data?.total ?? 0;
  rememberTotal(total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const items = useMemo(() => pageQuery.data?.items ?? [], [pageQuery.data?.items]);
  const selection = useTableRowSelection(items, getRowId, buildTableSelectionResetKey(debouncedQuery, rows));

  const onSortChange = useCallback(
    (field: string, direction: SortDirection) => {
      setSort(`${field}:${direction}`);
      setPage(1);
    },
    [setPage],
  );

  return {
    query,
    setQuery: (next: string) => {
      setQueryState(next);
      setPage(1);
    },
    rows,
    setRows: (next: TableFilterRowState[]) => {
      setRowsState(next);
      setPage(1);
    },
    open,
    setOpen,
    fields: localizedFields,
    activeFilterCount,
    hasActiveFilters,
    sort,
    onSortChange,
    items,
    total,
    isLoading: pageQuery.isLoading,
    isFetching: pageQuery.isFetching,
    isSearching: enabled && (query.trim() !== debouncedQuery.trim() || pageQuery.isFetching),
    isError: pageQuery.isError,
    error: pageQuery.error,
    refetch: pageQuery.refetch,
    pagination: { page: Math.min(page, totalPages), totalPages, pageSize, setPage, changePageSize },
    selection,
    clear: () => {
      setQueryState("");
      setRowsState([]);
      setPage(1);
    },
  };
}

export type CatalogTableState<T> = ReturnType<typeof useCatalogTable<T>>;
