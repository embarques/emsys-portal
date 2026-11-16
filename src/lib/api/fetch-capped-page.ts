import type { PaginatedResult } from "@/lib/api/types";

/**
 * One table page for an endpoint that rejects pages larger than `cap`. Larger
 * table page sizes are assembled from sequential capped API pages.
 */
export async function fetchCappedPage<T>(
  params: { page: number; limit: number },
  cap: number,
  fetchApiPage: (page: number, limit: number) => Promise<PaginatedResult<T>>,
  signal?: AbortSignal,
): Promise<PaginatedResult<T>> {
  if (params.limit <= cap) return fetchApiPage(params.page, params.limit);

  const start = (params.page - 1) * params.limit;
  let apiPage = Math.floor(start / cap) + 1;
  let skip = start % cap;
  const items: T[] = [];
  let total = 0;

  for (;;) {
    signal?.throwIfAborted();
    const result = await fetchApiPage(apiPage, cap);
    total = result.total;
    items.push(...result.items.slice(skip));
    skip = 0;
    if (result.items.length < cap || items.length >= params.limit || apiPage * cap >= total) break;
    apiPage += 1;
  }

  return { items: items.slice(0, params.limit), page: params.page, resultsPerPage: params.limit, total };
}
