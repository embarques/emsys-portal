"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";

import { ScrollableTable } from "@/components/app-shell/scrollable-table";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
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
}: DataTableProps<T>) {
  const { isVisible, getColumnWidth, setColumnWidth, reorderColumns } = columnLayout;

  const visibleColumns = columns.filter((column) => isVisible(column.id));
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const [draggingHeaderId, setDraggingHeaderId] = useState<string | null>(null);
  const [dragOverHeaderId, setDragOverHeaderId] = useState<string | null>(null);
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);

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
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-muted-foreground">
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
            {visibleColumns.map((column) => {
              const width = getColumnWidth(column.id);

              return (
                <th
                  key={column.id}
                  style={{ width }}
                  className={cn(
                    "group relative select-none px-2 py-3 font-medium",
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
                      aria-label={`Drag to reorder ${column.label}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>

                    <span className="min-w-0 flex-1 truncate text-xs font-medium sm:text-sm" title={column.label}>
                      {column.label}
                    </span>
                  </div>

                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${column.label}`}
                    className={cn(
                      "absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none",
                      "opacity-0 transition-opacity group-hover:opacity-100",
                      resizingColumnId === column.id && "opacity-100"
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startColumnResize(column.id, event.clientX);
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
                    onRowClick && "cursor-pointer",
                    "border-b transition-colors last:border-0 hover:bg-muted/30",
                    selected && "bg-accent/40"
                  )}
                  onClick={() => onRowClick?.(row)}
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
