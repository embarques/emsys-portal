"use client";

import { useCallback, useState } from "react";

import type { SortDirection } from "@/lib/api/list-query";

export type UseTableSortResult = {
  /** Current sort string in EMSYS `field:direction` form (e.g. `name:asc`). */
  sort: string;
  setSort: (sort: string) => void;
  /** Pass to `<DataTable onSortChange={...} />`. Toggling is handled inside DataTable. */
  onSortChange: (field: string, direction: SortDirection) => void;
};

/**
 * Manages click-to-sort header state for a list table.
 *
 * @param initialSort default `field:direction` (e.g. `name:asc`).
 * @param onAfterChange optional callback fired after a sort change (e.g. reset page to 1).
 */
export function useTableSort(initialSort: string, onAfterChange?: () => void): UseTableSortResult {
  const [sort, setSort] = useState(initialSort);

  const onSortChange = useCallback(
    (field: string, direction: SortDirection) => {
      setSort(`${field}:${direction}`);
      onAfterChange?.();
    },
    [onAfterChange],
  );

  return { sort, setSort, onSortChange };
}
