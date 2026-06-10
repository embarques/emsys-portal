"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

import { ScrollableTable } from "@/components/app-shell/scrollable-table";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import { measureTableColumnContentWidth } from "@/lib/table/measure-column-width";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  columnLayout: TableColumnLayout;
  emptyState: React.ReactNode;
  minWidth?: number;
  selectable?: boolean;
  selectedIds?: string[];
  allPageSelected?: boolean;
  onToggleSelectAll?: (checked: boolean) => void;
  onToggleSelect?: (id: string, checked: boolean) => void;
  rowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  /** When set, visible columns auto-fit on first load and whenever this page changes. */
  page?: number;
  /** When true, auto-fit waits until fresh page data is shown (e.g. while refetching). */
  isPageDataPending?: boolean;
  autoFitColumns?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  columnLayout,
  emptyState,
  minWidth = 960,
  selectable = false,
  selectedIds = [],
  allPageSelected = false,
  onToggleSelectAll,
  onToggleSelect,
  rowLabel,
  onRowClick,
  onRowDoubleClick,
  page,
  isPageDataPending = false,
  autoFitColumns = true,
}: DataTableProps<T>) {
  const { isVisible, getColumnWidth, setColumnWidth, fitColumnWidth, fitColumnWidths, reorderColumns } =
    columnLayout;

  const visibleColumns = columns.filter((column) => isVisible(column.id));
  const visibleColumnKey = visibleColumns.map((column) => column.id).join("\0");
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const [draggingHeaderId, setDraggingHeaderId] = useState<string | null>(null);
  const [dragOverHeaderId, setDragOverHeaderId] = useState<string | null>(null);
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);
  const pendingRowClickRef = useRef<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const lastAutoFitPageRef = useRef<number | null>(null);

  const delaySingleClick = Boolean(onRowClick && onRowDoubleClick);

  function handleRowClick(row: T) {
    if (!onRowClick) return;

    if (!delaySingleClick) {
      onRowClick(row);
      return;
    }

    if (pendingRowClickRef.current != null) {
      window.clearTimeout(pendingRowClickRef.current);
    }

    pendingRowClickRef.current = window.setTimeout(() => {
      pendingRowClickRef.current = null;
      onRowClick(row);
    }, 250);
  }

  function handleRowDoubleClick(row: T) {
    if (pendingRowClickRef.current != null) {
      window.clearTimeout(pendingRowClickRef.current);
      pendingRowClickRef.current = null;
    }

    onRowDoubleClick?.(row);
  }

  function autoFitColumnWidth(columnId: string, columnIndex: number) {
    if (!tableRef.current) return;
    const width = measureTableColumnContentWidth(tableRef.current, columnIndex);
    fitColumnWidth(columnId, width);
  }

  function autoFitAllVisibleColumns() {
    if (!tableRef.current) return;

    const nextWidths: Record<string, number> = {};

    visibleColumns.forEach((column, columnIndex) => {
      const tableColumnIndex = columnIndex + (selectable ? 1 : 0);
      nextWidths[column.id] = measureTableColumnContentWidth(tableRef.current!, tableColumnIndex);
    });

    fitColumnWidths(nextWidths);
  }

  useEffect(() => {
    if (!autoFitColumns || rows.length === 0 || isPageDataPending) return;

    const pageKey = page ?? -1;
    const isInitialLoad = lastAutoFitPageRef.current === null;
    const isPageChange = page !== undefined && lastAutoFitPageRef.current !== pageKey;

    if (!isInitialLoad && !isPageChange) return;

    const frame = requestAnimationFrame(() => {
      autoFitAllVisibleColumns();
      lastAutoFitPageRef.current = pageKey;
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFitColumns, page, rows, isPageDataPending, selectable, visibleColumnKey]);

  function startColumnResize(columnId: string, startX: number) {
    const startWidth = getColumnWidth(columnId);
    setResizingColumnId(columnId);

    function handleMouseMove(event: MouseEvent) {
      setColumnWidth(columnId, startWidth + event.clientX - startX);
    }

    function handleMouseUp() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizingColumnId(null);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleHeaderDrop(targetId: string) {
    if (draggingHeaderId && draggingHeaderId !== targetId) {
      reorderColumns(draggingHeaderId, targetId);
    }
    setDraggingHeaderId(null);
    setDragOverHeaderId(null);
  }

  const tableMinWidth = Math.max(
    minWidth,
    visibleColumns.reduce((total, column) => total + getColumnWidth(column.id), 0) + (selectable ? 48 : 0)
  );

  return (
    <ScrollableTable minWidth={tableMinWidth}>
      <table ref={tableRef} className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            {selectable ? (
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={allPageSelected}
                  onChange={(event) => onToggleSelectAll?.(event.target.checked)}
                  className="size-4 rounded border-input"
                />
              </th>
            ) : null}
            {visibleColumns.map((column, columnIndex) => {
              const width = getColumnWidth(column.id);
              const headerLabel = formatTableColumnLabel(column.label);
              const tableColumnIndex = columnIndex + (selectable ? 1 : 0);

              return (
                <th
                  key={column.id}
                  style={{ width }}
                  className={cn(
                    "group relative select-none px-3 py-3.5",
                    column.headerClassName,
                    dragOverHeaderId === column.id && draggingHeaderId !== column.id && "bg-primary/10",
                    resizingColumnId === column.id && "bg-primary/5"
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverHeaderId(column.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverHeaderId === column.id) setDragOverHeaderId(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleHeaderDrop(column.id);
                  }}
                >
                  <div className="flex items-center gap-1 pr-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDraggingHeaderId(column.id)}
                      onDragEnd={() => {
                        setDraggingHeaderId(null);
                        setDragOverHeaderId(null);
                      }}
                      className="cursor-grab rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 active:cursor-grabbing"
                      aria-label={`Drag to reorder ${headerLabel}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>

                    <span
                      className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight tracking-wide text-foreground/70"
                      title={headerLabel}
                    >
                      {headerLabel}
                    </span>
                  </div>

                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${headerLabel}. Double-click to fit content.`}
                    className={cn(
                      "absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none",
                      "opacity-0 transition-opacity group-hover:opacity-100",
                      resizingColumnId === column.id && "opacity-100"
                    )}
                    onMouseDown={(event) => {
                      if (event.detail > 1) return;
                      event.preventDefault();
                      event.stopPropagation();
                      startColumnResize(column.id, event.clientX);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      autoFitColumnWidth(column.id, tableColumnIndex);
                    }}
                  >
                    <div className="absolute right-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-border group-hover:bg-primary/50" />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const id = rowKey(row);
              const selected = selectedIds.includes(id);

              return (
                <tr
                  key={id}
                  className={cn(
                    (onRowClick || onRowDoubleClick) && "cursor-pointer",
                    "border-b transition-colors last:border-0 hover:bg-muted/30",
                    selected && "bg-accent/40"
                  )}
                  onClick={() => handleRowClick(row)}
                  onDoubleClick={() => handleRowDoubleClick(row)}
                >
                  {selectable ? (
                    <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${rowLabel?.(row) ?? id}`}
                        checked={selected}
                        onChange={(event) => onToggleSelect?.(id, event.target.checked)}
                        className="size-4 rounded border-input"
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      style={{ width: getColumnWidth(column.id) }}
                      className={cn("overflow-hidden px-4 py-4", column.cellClassName)}
                      onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                    >
                      <div className="truncate">{column.renderCell(row)}</div>
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={colSpan} className="px-6 py-12 text-center">
                {emptyState}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollableTable>
  );
}
