"use client";

import { useEffect, useRef } from "react";

import {
  resolveSeededFilterRowsOnOpen,
  type TableFilterRowState,
} from "@/lib/table/filter-builder";

type UseTableAdvancedFilterPanelOptions = {
  rows: TableFilterRowState[];
  open: boolean;
  onRowsChange: (rows: TableFilterRowState[]) => void;
  seedEmptyRowWhenOpen?: boolean;
};

/** Seeds a blank filter row when the panel opens with no rows. UI-only — no API calls. */
export function useTableAdvancedFilterPanel({
  rows,
  open,
  onRowsChange,
  seedEmptyRowWhenOpen = true,
}: UseTableAdvancedFilterPanelOptions) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const seededRows = resolveSeededFilterRowsOnOpen(rows, {
      open,
      wasOpen: wasOpenRef.current,
      seedEmptyRowWhenOpen,
    });

    if (seededRows) {
      onRowsChange(seededRows);
    }

    wasOpenRef.current = open;
  }, [open, seedEmptyRowWhenOpen, rows, onRowsChange]);
}
