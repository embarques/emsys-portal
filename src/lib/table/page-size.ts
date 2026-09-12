export const TABLE_PAGE_SIZE_ALL = "all";
export const TABLE_PAGE_SIZES = [50, 100, 200, 500] as const;
export const DEFAULT_TABLE_PAGE_SIZE = 50;
/** Fallback fetch size when "all" is selected before a total is known. */
export const TABLE_PAGE_SIZE_ALL_LIMIT = 10_000;

export type TablePageSize = (typeof TABLE_PAGE_SIZES)[number] | typeof TABLE_PAGE_SIZE_ALL;

export function parseTablePageSize(value: string): TablePageSize {
  if (value === TABLE_PAGE_SIZE_ALL) return TABLE_PAGE_SIZE_ALL;
  const numeric = Number(value);
  if ((TABLE_PAGE_SIZES as readonly number[]).includes(numeric)) {
    return numeric as TablePageSize;
  }
  return DEFAULT_TABLE_PAGE_SIZE;
}

export function resolveTablePageLimit(pageSize: TablePageSize, knownTotal = 0): number {
  if (pageSize !== TABLE_PAGE_SIZE_ALL) return pageSize;
  return knownTotal > 0 ? knownTotal : TABLE_PAGE_SIZE_ALL_LIMIT;
}

/** Client-side tables already have the full list; "all" means the whole filtered set. */
export function resolveClientTablePageLimit(pageSize: TablePageSize, itemCount: number): number {
  if (pageSize !== TABLE_PAGE_SIZE_ALL) return pageSize;
  return Math.max(itemCount, 1);
}
