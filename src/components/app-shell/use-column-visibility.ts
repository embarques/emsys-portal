"use client";

import { useCallback, useMemo, useState } from "react";

import {
  buildDefaultOrder,
  buildDefaultVisibility,
  buildDefaultWidths,
  clampColumnWidth,
  DEFAULT_COLUMN_WIDTH,
  loadTableColumnPreferences,
  reorderColumnIds,
  saveTableColumnPreferences,
  sortColumnsByOrder,
  type TableColumnPreferences,
} from "@/lib/table/column-preferences";
import { clampAutoFitColumnWidth } from "@/lib/table/measure-column-width";
import type { ColumnVisibilityDefinition } from "@/lib/table/types";

export function useColumnVisibility<T extends ColumnVisibilityDefinition>(
  storageKey: string,
  columns: T[]
) {
  const hideableColumns = useMemo(
    () => columns.filter((column) => column.hideable !== false),
    [columns]
  );

  const [preferences, setPreferences] = useState<TableColumnPreferences>(() =>
    loadTableColumnPreferences(storageKey, columns)
  );

  const orderedColumns = useMemo(
    () => sortColumnsByOrder(columns, preferences.order),
    [columns, preferences.order]
  );

  const persist = useCallback(
    (next: TableColumnPreferences) => {
      setPreferences(next);
      saveTableColumnPreferences(storageKey, next);
    },
    [storageKey]
  );

  const isVisible = useCallback(
    (id: string) => {
      const column = columns.find((entry) => entry.id === id);
      if (column?.hideable === false) return true;
      return preferences.visibility[id] ?? true;
    },
    [columns, preferences.visibility]
  );

  const getColumnWidth = useCallback(
    (id: string) => {
      const width = preferences.widths[id];
      return width != null && Number.isFinite(width) ? width : DEFAULT_COLUMN_WIDTH;
    },
    [preferences.widths]
  );

  const setColumnVisible = useCallback(
    (id: string, visible: boolean) => {
      persist({
        ...preferences,
        visibility: { ...preferences.visibility, [id]: visible },
      });
    },
    [persist, preferences]
  );

  const setColumnWidth = useCallback(
    (id: string, width: number) => {
      persist({
        ...preferences,
        widths: { ...preferences.widths, [id]: clampColumnWidth(width) },
      });
    },
    [persist, preferences]
  );

  const fitColumnWidth = useCallback(
    (id: string, width: number) => {
      persist({
        ...preferences,
        widths: { ...preferences.widths, [id]: clampAutoFitColumnWidth(width) },
      });
    },
    [persist, preferences]
  );

  const fitColumnWidths = useCallback(
    (widths: Record<string, number>) => {
      const nextWidths = { ...preferences.widths };
      for (const [id, width] of Object.entries(widths)) {
        nextWidths[id] = clampAutoFitColumnWidth(width);
      }
      persist({
        ...preferences,
        widths: nextWidths,
      });
    },
    [persist, preferences]
  );

  const reorderColumns = useCallback(
    (sourceId: string, targetId: string) => {
      persist({
        ...preferences,
        order: reorderColumnIds(preferences.order, sourceId, targetId),
      });
    },
    [persist, preferences]
  );

  const moveColumn = useCallback(
    (id: string, direction: "up" | "down") => {
      const index = preferences.order.indexOf(id);
      if (index === -1) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= preferences.order.length) return;

      persist({
        ...preferences,
        order: reorderColumnIds(preferences.order, id, preferences.order[targetIndex]),
      });
    },
    [persist, preferences]
  );

  const showAllColumns = useCallback(() => {
    persist({
      ...preferences,
      visibility: buildDefaultVisibility(hideableColumns),
    });
  }, [hideableColumns, persist, preferences]);

  const resetColumns = useCallback(() => {
    persist({
      visibility: buildDefaultVisibility(hideableColumns),
      order: buildDefaultOrder(columns),
      widths: buildDefaultWidths(columns),
    });
  }, [columns, hideableColumns, persist]);

  return {
    columns: orderedColumns,
    isVisible,
    getColumnWidth,
    setColumnVisible,
    setColumnWidth,
    fitColumnWidth,
    fitColumnWidths,
    reorderColumns,
    moveColumn,
    showAllColumns,
    resetColumns,
    hideableColumns,
    visibility: preferences.visibility,
    order: preferences.order,
  };
}

export type TableColumnLayout = ReturnType<typeof useColumnVisibility>;
