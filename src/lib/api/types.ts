/** Standard emsys-api paginated list envelope. */
export type PaginatedApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  duration?: number;
  page?: number;
  resultsPerPage?: number;
  total?: number;
  subtotal?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  resultsPerPage: number;
  total: number;
};

type ResolvePaginatedListTotalOptions = {
  /** True when the request used POST /search or equivalent filtered query. */
  isFiltered?: boolean;
};

/**
 * EMSYS list/search envelopes expose `total` and sometimes `subtotal`.
 * On POST /search, `subtotal` is often the filtered match count while `total`
 * may still reflect the unfiltered catalog size.
 */
export function resolvePaginatedListTotal(
  payload: PaginatedApiEnvelope<unknown>,
  itemsLength: number,
  options: ResolvePaginatedListTotalOptions = {},
): number {
  const apiTotal = payload.total;
  const apiSubtotal = payload.subtotal;

  if (options.isFiltered) {
    if (typeof apiSubtotal === "number" && apiSubtotal >= 0) {
      return apiSubtotal;
    }
  }

  if (typeof apiTotal === "number" && apiTotal >= 0) {
    return apiTotal;
  }

  if (typeof apiSubtotal === "number" && apiSubtotal >= 0) {
    return apiSubtotal;
  }

  return itemsLength;
}
