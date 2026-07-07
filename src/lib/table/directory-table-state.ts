import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";

/** Stable key for resetting row selection when search/filters change. */
export function buildTableSelectionResetKey(...parts: unknown[]): string {
  return parts.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join("\0");
}

/** Clears table row selection when the directory filter key changes. */
export function useTableSelectionReset<T extends string | number>(
  resetKey: string,
  setSelectedIds: Dispatch<SetStateAction<T[]>>,
): void {
  useEffect(() => {
    setSelectedIds([]);
  }, [resetKey, setSelectedIds]);
}

/**
 * Drops stale placeholder rows from TanStack `keepPreviousData` when the latest
 * response reports zero matches.
 */
export function useResolvedPaginatedItems<T>(
  items: T[] | undefined,
  total: number | undefined,
  isFetching: boolean,
): T[] {
  return useMemo(() => {
    const list = items ?? [];
    const count = total ?? 0;
    if (!isFetching && count === 0) {
      return [];
    }
    return list;
  }, [items, total, isFetching]);
}
