import type { ColumnVisibilityDefinition } from "@/lib/table/types";

export const DEFAULT_COLUMN_WIDTH = 160;
export const MIN_COLUMN_WIDTH = 48;
export const MAX_COLUMN_WIDTH = 520;

export type TableColumnPreferences = {
  visibility: Record<string, boolean>;
  order: string[];
  widths: Record<string, number>;
};

export function buildDefaultVisibility(columns: ColumnVisibilityDefinition[]): Record<string, boolean> {
  return Object.fromEntries(
    columns
      .filter((column) => column.hideable !== false)
      .map((column) => [column.id, column.defaultVisible !== false]),
  );
}

export function buildDefaultOrder(columns: ColumnVisibilityDefinition[]): string[] {
  return columns.map((column) => column.id);
}

export function buildDefaultWidths(columns: ColumnVisibilityDefinition[]): Record<string, number> {
  return Object.fromEntries(columns.map((column) => [column.id, DEFAULT_COLUMN_WIDTH]));
}

export function normalizeColumnOrder(order: string[], columns: ColumnVisibilityDefinition[]): string[] {
  const ids = new Set(columns.map((column) => column.id));
  const normalized = order.filter((id) => ids.has(id));
  const missing = columns.filter((column) => !normalized.includes(column.id)).map((column) => column.id);
  return [...normalized, ...missing];
}

export function reorderColumnIds(order: string[], sourceId: string, targetId: string): string[] {
  const fromIndex = order.indexOf(sourceId);
  const toIndex = order.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return order;

  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, sourceId);
  return next;
}

export function clampColumnWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_COLUMN_WIDTH;
  }

  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

function sanitizeColumnWidths(widths: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(widths).map(([id, width]) => [id, clampColumnWidth(width)]),
  );
}

function mergeRecord<T extends Record<string, unknown>>(defaults: T, saved: Partial<T> | undefined): T {
  return { ...defaults, ...saved };
}

export function loadTableColumnPreferences(
  storageKey: string,
  columns: ColumnVisibilityDefinition[]
): TableColumnPreferences {
  const hideableColumns = columns.filter((column) => column.hideable !== false);
  const defaults: TableColumnPreferences = {
    visibility: buildDefaultVisibility(hideableColumns),
    order: buildDefaultOrder(columns),
    widths: buildDefaultWidths(columns),
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const raw =
      localStorage.getItem(`emsys-table-prefs:${storageKey}`) ??
      localStorage.getItem(`emsys-table-columns:${storageKey}`);

    if (!raw) return defaults;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return defaults;
    }

    if (parsed && typeof parsed === "object" && "order" in parsed) {
      const prefs = parsed as Partial<TableColumnPreferences & { collapsed?: Record<string, boolean> }>;
      return {
        visibility: mergeRecord(defaults.visibility, prefs.visibility),
        order: normalizeColumnOrder(prefs.order ?? defaults.order, columns),
        widths: sanitizeColumnWidths(mergeRecord(defaults.widths, prefs.widths)),
      };
    }

    return {
      ...defaults,
      visibility: mergeRecord(defaults.visibility, parsed as Record<string, boolean>),
    };
  } catch {
    return defaults;
  }
}

export function saveTableColumnPreferences(storageKey: string, preferences: TableColumnPreferences) {
  localStorage.setItem(`emsys-table-prefs:${storageKey}`, JSON.stringify(preferences));
}

export function sortColumnsByOrder<T extends ColumnVisibilityDefinition>(
  columns: T[],
  order: string[]
): T[] {
  const columnMap = new Map(columns.map((column) => [column.id, column]));
  return normalizeColumnOrder(order, columns)
    .map((id) => columnMap.get(id))
    .filter((column): column is T => column !== undefined);
}
