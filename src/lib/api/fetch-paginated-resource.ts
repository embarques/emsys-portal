import { apiClient } from "@/lib/api/client";
import type { ApiListSortInput } from "@/lib/api/list-query";
import {
  buildApiSearchPaginationQuery,
  type StripeStyleSearchBody,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";

type FetchPaginatedResourceListOptions<T> = {
  endpoint: string;
  page?: number;
  limit?: number;
  offset?: number;
  isFiltered: boolean;
  buildGetQuery: () => string;
  buildSearchBody: () => StripeStyleSearchBody;
  normalize: (
    payload: PaginatedApiEnvelope<unknown[]>,
    context?: { isFiltered?: boolean },
  ) => PaginatedResult<T>;
};

export async function fetchPaginatedResourceList<T>({
  endpoint,
  page = 1,
  limit = 40,
  offset,
  isFiltered,
  buildGetQuery,
  buildSearchBody,
  normalize,
}: FetchPaginatedResourceListOptions<T>): Promise<PaginatedResult<T>> {
  if (isFiltered) {
    const resolvedOffset = offset ?? (page - 1) * limit;
    const paginationQuery = buildApiSearchPaginationQuery({
      page,
      limit,
      offset: resolvedOffset,
    });

    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${endpoint}/search?${paginationQuery}`,
      buildSearchBody(),
    );

    return normalize(response, { isFiltered: true });
  }

  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${endpoint}?${buildGetQuery()}`,
  );

  return normalize(response, { isFiltered: false });
}

export type ResourceListFetchParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
};
