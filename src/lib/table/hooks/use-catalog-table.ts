import { useMemo, useState } from "react";
import { keepPreviousData, type QueryKey } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import type { PaginatedResult } from "@/lib/api/types";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import {
  countCompleteFilterRows,
  type TableFilterFieldDefinition,
  type TableFilterFieldOption,
  type TableFilterRowState,
} from "@/lib/table/filter-builder";
import { useLocalizedFilterFields } from "@/lib/table/hooks/use-localized-filter-fields";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";

const SEARCH_DEBOUNCE_MS = 300;

type UseCatalogTableOptions<T> = {
  fields: readonly TableFilterFieldDefinition[];
  enabled?: boolean;
  keepPrevious?: boolean;
  /** Locale prefix for field labels, e.g. `employeeTitles.filters.fields`. */
  keyPrefix: string;
  sort: string;
  queryKey: (params: CatalogPageParams) => QueryKey;
  fetchPage: (params: CatalogPageParams, signal?: AbortSignal) => Promise<PaginatedResult<T>>;
  localizeOption?: (
    field: string,
    option: TableFilterFieldOption,
    t: (key: string) => string,
  ) => TableFilterFieldOption;
};

/** Search box, advanced filters and pagination for a small catalog, all applied by the API. */
export function useCatalogTable<T>({ fields, keyPrefix, sort, queryKey, fetchPage, localizeOption, enabled = true, keepPrevious = true }: UseCatalogTableOptions<T>) {
  const [query, setQueryState] = useState("");
  const [rows, setRowsState] = useState<TableFilterRowState[]>([]);
  const [open, setOpen] = useState(false);
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
    items: pageQuery.data?.items ?? [],
    total,
    isLoading: pageQuery.isLoading,
    isError: pageQuery.isError,
    error: pageQuery.error,
    refetch: pageQuery.refetch,
    pagination: { page: Math.min(page, totalPages), totalPages, pageSize, setPage, changePageSize },
    clear: () => {
      setQueryState("");
      setRowsState([]);
      setPage(1);
    },
  };
}

export type CatalogTableState<T> = ReturnType<typeof useCatalogTable<T>>;
