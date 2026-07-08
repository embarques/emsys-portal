import type { DataTableColumn } from "@/lib/table/types";

function isEmptyCopyValue(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed === "—" || trimmed === "-";
}

export function resolveCopyableText<T>(
  column: DataTableColumn<T>,
  row: T,
  cellContent: React.ReactNode,
): string | null {
  if (column.copyable === false) return null;

  const explicitValue = column.copyValue?.(row);
  if (explicitValue !== undefined) {
    return isEmptyCopyValue(explicitValue) ? null : explicitValue;
  }

  if (column.stopRowClick || column.truncateCell === false) return null;

  if (typeof cellContent !== "string" && typeof cellContent !== "number") return null;

  const text = String(cellContent);
  return isEmptyCopyValue(text) ? null : text;
}
