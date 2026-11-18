import type { TranslateFn } from "@/lib/feedback/messages";

function englishSummary(key: string, params: Record<string, string | number>): string {
  switch (key) {
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
