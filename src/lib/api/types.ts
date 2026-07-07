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
 * Unfiltered lists use `total` as the catalog size.
 * Filtered POST /search responses use `total` for the match count; `subtotal`
 * may be zero or carry the catalog size depending on the endpoint version.
 */
export function resolvePaginatedListTotal(
  payload: PaginatedApiEnvelope<unknown>,
  itemsLength: number,
  options: ResolvePaginatedListTotalOptions = {},
): number {
  const apiTotal = payload.total;
  const apiSubtotal = payload.subtotal;

  if (options.isFiltered) {
    if (typeof apiSubtotal === "number" && apiSubtotal > 0) {
      return apiSubtotal;
    }

    if (typeof apiTotal === "number" && apiTotal >= 0) {
      return apiTotal;
    }

    if (itemsLength > 0) {
      return itemsLength;
    }

    return 0;
  }

  if (typeof apiTotal === "number" && apiTotal >= 0) {
    return apiTotal;
  }

  if (typeof apiSubtotal === "number" && apiSubtotal >= 0) {
    return apiSubtotal;
  }

  return itemsLength;
}
