import type { TranslateFn } from "@/lib/feedback/messages";

function englishSummary(key: string, params: Record<string, string | number>): string {
  switch (key) {
    case "searching":
      return `Searching ${params.noun}…`;
    case "matching":
      return `${params.matched} matching ${params.noun}`;
    case "matchedOfTotal":
      return `${params.matched} of ${params.total} ${params.noun}`;
    case "refreshing":
      return `Refreshing ${params.noun}…`;
    case "noNoun":
      return `No ${params.noun}`;
    case "noMatching":
      return `No matching ${params.noun}`;
    case "noMatchingOfTotal":
      return `No matching ${params.noun} (out of ${params.total} total)`;
    case "showingRange":
      return `Showing ${params.range} of ${params.total}${params.matching} ${params.noun}${params.catalog}`;
    default:
      return key;
  }
}

function resolveSummary(
  t: TranslateFn | undefined,
  key: string,
  params: Record<string, string | number>,
): string {
  if (t) {
    return t(`common.listSummary.${key}`, params);
  }
  return englishSummary(key, params);
}

export function formatFilteredCountSummary(
  input: {
    matched: number;
    catalogTotal?: number;
    noun: string;
    isLoading?: boolean;
    catalogLoading?: boolean;
  },
  t?: TranslateFn,
): string {
  const { matched, catalogTotal, noun, isLoading, catalogLoading } = input;

  if (isLoading && matched === 0) {
    return resolveSummary(t, "searching", { noun });
  }

  const matchedLabel = matched.toLocaleString();

  if (catalogTotal === undefined || catalogLoading) {
    return resolveSummary(t, "matching", { matched: matchedLabel, noun });
  }

  return resolveSummary(t, "matchedOf", {
    matched: matchedLabel,
    total: catalogTotal.toLocaleString(),
    noun,
  });
}

/** Compact toolbar badge: search + filter on the left, this summary + columns on the right. */
export function buildToolbarSearchSummary(
  input: {
    isFiltered: boolean;
    query?: string;
    isSearchPending?: boolean;
    matched: number;
    catalogTotal?: number;
    noun: string;
    isLoading?: boolean;
    catalogLoading?: boolean;
  },
  t?: TranslateFn,
): string | undefined {
  if (!input.isFiltered) return undefined;

  if (input.query?.trim() && input.isSearchPending) {
    return resolveSummary(t, "searching", { noun: input.noun });
  }

  return formatFilteredCountSummary(
    {
      matched: input.matched,
      catalogTotal: input.catalogTotal,
      noun: input.noun,
      isLoading: input.isLoading,
      catalogLoading: input.catalogLoading,
    },
    t,
  );
}

export function formatPaginatedListSummary(
  input: {
    itemCountOnPage: number;
    page: number;
    pageSize: number;
    total: number;
    noun: string;
    isFiltered?: boolean;
    isLoading?: boolean;
    catalogTotal?: number;
    catalogLoading?: boolean;
  },
  t?: TranslateFn,
): string {
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
    return resolveSummary(t, "refreshing", { noun });
  }

  if (total === 0) {
    if (!isFiltered) {
      return resolveSummary(t, "noNoun", { noun });
    }

    if (catalogTotal !== undefined && !catalogLoading) {
      return resolveSummary(t, "noMatchingOfTotal", {
        noun,
        total: catalogTotal.toLocaleString(),
      });
    }

    return resolveSummary(t, "noMatching", { noun });
  }

  const start = (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + itemCountOnPage;
  const rangeLabel =
    itemCountOnPage === 0 ? "0" : start === end ? `${start}` : `${start}–${end}`;
  const matching = isFiltered ? " matching" : "";
  const catalog =
    isFiltered && catalogTotal !== undefined && !catalogLoading
      ? ` (out of ${catalogTotal.toLocaleString()} total)`
      : "";

  return resolveSummary(t, "showingRange", {
    range: rangeLabel,
    total: total.toLocaleString(),
    matching,
    noun,
    catalog,
  });
}
