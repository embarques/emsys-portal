import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  createListTextSearch,
  hasResourceListFilters,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import { resolvePaginatedListTotal, type PaginatedResult } from "@/lib/api/types";
import type { TableFilterFieldDefinition, TableFilterRowState } from "@/lib/table/filter-builder";

/** One server page of a small lookup catalog (titles, departments, policies, statuses). */
export type CatalogPageParams = {
  page: number;
  limit: number;
  sort: string;
  query?: string;
  filterRows?: TableFilterRowState[];
};

export type CatalogPageConfig<T> = {
  endpoint: string;
  barOrSearchFields: readonly string[];
  filterFields: TableFilterFieldDefinition[];
  expandNode?: (node: ApiSearchFilterNode) => ApiSearchFilterNode | null;
  /** Parses the envelope `data`; throw on contract violations like the feature's list fetchers do. */
  parseRows: (data: unknown) => T[];
};

/** GET when unfiltered, POST /<endpoint>/search when the query or filter rows are set. */
export function fetchCatalogPage<T>(config: CatalogPageConfig<T>, params: CatalogPageParams): Promise<PaginatedResult<T>> {
  const search = createListTextSearch(params.query ?? "");
  return fetchPaginatedResourceList({
    endpoint: config.endpoint,
    page: params.page,
    limit: params.limit,
    isFiltered: hasResourceListFilters({
      search,
      filterRows: params.filterRows,
      tableFilterFields: config.filterFields,
    }),
    buildGetQuery: () => buildApiListQuery({ page: params.page, limit: params.limit, sort: params.sort }),
    buildSearchBody: () =>
      buildStripeStyleSearchBody({
        sort: params.sort,
        filterGroups: buildResourceSearchFilterGroups({
          search,
          barOrSearchFields: config.barOrSearchFields,
          filterRows: params.filterRows,
          tableFilterFields: config.filterFields,
          expandNode: config.expandNode,
        }),
      }),
    normalize: (payload, context) => {
      const items = config.parseRows(payload.data);
      return {
        items,
        page: payload.page ?? params.page,
        resultsPerPage: payload.resultsPerPage ?? items.length,
        total: resolvePaginatedListTotal(payload, items.length, context),
      };
    },
  });
}
