export function formatFilteredCountSummary(input: {
  matched: number;
  catalogTotal?: number;
  noun: string;
  isLoading?: boolean;
  catalogLoading?: boolean;
}): string {
  const { matched, catalogTotal, noun, isLoading, catalogLoading } = input;

  if (isLoading && matched === 0) {
    return `Searching ${noun}…`;
  }

  const matchedLabel = matched.toLocaleString();

  if (catalogTotal === undefined || catalogLoading) {
    return `${matchedLabel} matching ${noun}`;
  }

  return `${matchedLabel} of ${catalogTotal.toLocaleString()} ${noun}`;
}

export function formatPaginatedListSummary(input: {
  itemCountOnPage: number;
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  isFiltered?: boolean;
  isLoading?: boolean;
  catalogTotal?: number;
  catalogLoading?: boolean;
}): string {
  const {
    itemCountOnPage,
    page,
    pageSize,
    total,
    noun,
    isFiltered,
    isLoading,
    catalogTotal,
    catalogLoading,
  } = input;

  if (isLoading) {
    return `Refreshing ${noun}…`;
  }

  if (total === 0) {
    if (!isFiltered) {
      return `No ${noun}`;
    }

    if (catalogTotal !== undefined && !catalogLoading) {
      return `No matching ${noun} (out of ${catalogTotal.toLocaleString()} total)`;
    }

    return `No matching ${noun}`;
  }

  const start = (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + itemCountOnPage;
  const rangeLabel =
    itemCountOnPage === 0 ? "0" : start === end ? `${start}` : `${start}–${end}`;
  const matchLabel = isFiltered ? " matching" : "";
  const catalogLabel =
    isFiltered && catalogTotal !== undefined && !catalogLoading
      ? ` (out of ${catalogTotal.toLocaleString()} total)`
      : "";

  return `Showing ${rangeLabel} of ${total.toLocaleString()}${matchLabel} ${noun}${catalogLabel}`;
}
