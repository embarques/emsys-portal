import { useMemo, useState } from "react";

import { useTableSelectionReset } from "@/lib/table/directory-table-state";

/**
 * Checkbox selection for a paginated table. Selections on other pages are kept
 * until `resetKey` (search/filter state) changes.
 */
export function useTableRowSelection<T>(pageRows: readonly T[], getRowId: (row: T) => string, resetKey: string) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useTableSelectionReset(resetKey, setSelectedIds);

  const pageRowIds = useMemo(() => pageRows.map(getRowId), [pageRows, getRowId]);
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id));
  const selectedRows = useMemo(
    () => pageRows.filter((row) => selectedIds.includes(getRowId(row))),
    [pageRows, getRowId, selectedIds],
  );

  return {
    selectedIds,
    setSelectedIds,
    pageRowIds,
    allPageSelected,
    selectedRows,
    toggle: (id: string, checked: boolean) =>
      setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((entry) => entry !== id))),
    toggleAll: (checked: boolean) =>
      setSelectedIds((current) =>
        checked ? [...new Set([...current, ...pageRowIds])] : current.filter((id) => !pageRowIds.includes(id)),
      ),
  };
}

export type TableRowSelection<T> = ReturnType<typeof useTableRowSelection<T>>;
