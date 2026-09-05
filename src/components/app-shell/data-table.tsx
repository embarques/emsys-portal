"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import { ScrollableTable } from "@/components/app-shell/scrollable-table";
import { TableCopyableCell } from "@/components/app-shell/table-copyable-cell";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { getPrimarySortSpec, type SortDirection } from "@/lib/api/list-query";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import { resolveCopyableText } from "@/lib/table/copyable-cell";
import { measureTableColumnContentWidth } from "@/lib/table/measure-column-width";
import { stretchColumnWidthsToFill } from "@/lib/table/stretch-column-widths";
import {
  createRowPointerState,
  shouldIgnoreRowClick,
  type RowPointerState,
} from "@/lib/table/row-click";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

const SELECT_COLUMN_WIDTH_PX = 40;
const SELECT_ACTIONS_COLUMN_WIDTH_PX = 72;

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  columnLayout: TableColumnLayout;
  emptyState: React.ReactNode;
  /**
   * Fallback fill width before the card is measured, and the empty-table floor
   * when the viewport width is not yet known.
   */
  minWidth?: number;
  selectable?: boolean;
  selectedIds?: string[];
  allPageSelected?: boolean;
  onToggleSelectAll?: (checked: boolean) => void;
  onToggleSelect?: (id: string, checked: boolean) => void;
  rowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  /** Highlights the row whose key matches (e.g. when a view sheet is open). */
  activeRowId?: string;
  /** Optional edit/delete controls rendered beside the row checkbox. */
  renderSelectCellActions?: (row: T) => React.ReactNode;
  /** When set, visible columns auto-fit on first load and whenever this page changes. */
  page?: number;
  /** When true, auto-fit waits until fresh page data is shown (e.g. while refetching). */
  isPageDataPending?: boolean;
  autoFitColumns?: boolean;
  /** Current sort in `field:direction` form (e.g. `name:asc`). Enables header sort arrows. */
  sort?: string;
  /** Called when a sortable header is clicked. Direction is pre-toggled by DataTable. */
  onSortChange?: (field: string, direction: SortDirection) => void;
  /**
   * When true, sortable headers use the same sort UI but clicks are ignored until
   * server-side sorting is wired up for the table.
   */
  sortUnavailable?: boolean;
};

function DataTableContent<T>({
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
  activeRowId,
  renderSelectCellActions,
  page,
  isPageDataPending = false,
  autoFitColumns = true,
  sort,
  onSortChange,
  sortUnavailable = false,
}: DataTableProps<T>) {
  const { isVisible, getColumnWidth, setColumnWidth, fitColumnWidth, fitColumnWidths, reorderColumns } =
    columnLayout;

  const activeSort = useMemo(() => getPrimarySortSpec(sort), [sort]);

  function handleSort(field: string) {
    if (sortUnavailable) return;

    if (!onSortChange) return;
    const nextDirection: SortDirection =
      activeSort?.field === field && activeSort.direction === "asc" ? "desc" : "asc";
    onSortChange(field, nextDirection);
  }

  const visibleColumns = columns.filter((column) => isVisible(column.id));
  const visibleColumnKey = visibleColumns.map((column) => column.id).join("\0");
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const [draggingHeaderId, setDraggingHeaderId] = useState<string | null>(null);
  const [dragOverHeaderId, setDragOverHeaderId] = useState<string | null>(null);
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);
  const pendingRowClickRef = useRef<number | null>(null);
  const rowPointerRef = useRef<RowPointerState | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const lastAutoFitSignatureRef = useRef<string | null>(null);
  const autoFitPassRef = useRef(0);
  const autoFitContextRef = useRef({ pageKey: -1, visibleColumnKey: "" });

  const delaySingleClick = Boolean(onRowClick && onRowDoubleClick);

  function triggerRowClick(row: T) {
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

  function handleRowClick(event: React.MouseEvent<HTMLTableRowElement>, row: T) {
    if (shouldIgnoreRowClick(rowPointerRef.current, event.clientX, event.clientY, event.target)) {
      rowPointerRef.current = null;
      return;
    }

    rowPointerRef.current = null;
    triggerRowClick(row);
  }

  function handleRowMouseDown(event: React.MouseEvent<HTMLTableRowElement>) {
    rowPointerRef.current = createRowPointerState(event.clientX, event.clientY);
  }

  function handleRowDoubleClick(row: T) {
    if (pendingRowClickRef.current != null) {
      window.clearTimeout(pendingRowClickRef.current);
      pendingRowClickRef.current = null;
    }

    onRowDoubleClick?.(row);
  }

  function autoFitColumnWidth(columnId: string, columnIndex: number) {
    const column = visibleColumns.find((entry) => entry.id === columnId);
    if (column?.autoFitColumn === false) return;
    if (!tableRef.current) return;
    const width = measureTableColumnContentWidth(tableRef.current, columnIndex);
    fitColumnWidth(columnId, width);
  }

  function autoFitAllVisibleColumns() {
    if (!tableRef.current) return;

    const nextWidths: Record<string, number> = {};

    visibleColumns.forEach((column, columnIndex) => {
      if (column.autoFitColumn === false) return;

      const tableColumnIndex = columnIndex + (selectable ? 1 : 0);
      nextWidths[column.id] = measureTableColumnContentWidth(tableRef.current!, tableColumnIndex);
    });

    if (Object.keys(nextWidths).length > 0) {
      fitColumnWidths(nextWidths);
    }
  }

  useLayoutEffect(() => {
    if (!autoFitColumns || rows.length === 0 || isPageDataPending) return;

    const pageKey = page ?? -1;
    if (
      autoFitContextRef.current.pageKey !== pageKey ||
      autoFitContextRef.current.visibleColumnKey !== visibleColumnKey
    ) {
      autoFitContextRef.current = { pageKey, visibleColumnKey };
      lastAutoFitSignatureRef.current = null;
      autoFitPassRef.current = 0;
    }

    const signature = `${pageKey}\0${visibleColumnKey}`;

    if (lastAutoFitSignatureRef.current === signature) return;
    if (autoFitPassRef.current >= 2) return;

    let cancelled = false;
    let frame = 0;
    let innerFrame = 0;

    frame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        autoFitAllVisibleColumns();
        lastAutoFitSignatureRef.current = signature;
        autoFitPassRef.current += 1;
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(innerFrame);
    };
  }, [autoFitColumns, page, rows, isPageDataPending, selectable, visibleColumnKey]);

  // Measure the scroll container so short tables can stretch to the card width
  // and empty-state copy stays pinned to the visible viewport.
  useLayoutEffect(() => {
    // table -> minWidth wrapper -> CardContent (the horizontal scroll container).
    const scrollContainer = tableRef.current?.parentElement?.parentElement;
    if (!scrollContainer) return;

    const update = () => setViewportWidth(scrollContainer.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, []);

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

  const hasSelectCellActions = Boolean(
    renderSelectCellActions && rows.some((row) => renderSelectCellActions(row)),
  );
  const selectColumnWidth = selectable
    ? hasSelectCellActions
      ? SELECT_ACTIONS_COLUMN_WIDTH_PX
      : SELECT_COLUMN_WIDTH_PX
    : 0;
  const baseColumnWidths = Object.fromEntries(
    visibleColumns.map((column) => [column.id, getColumnWidth(column.id)]),
  );
  const columnsWidth = visibleColumns.reduce(
    (total, column) => total + (baseColumnWidths[column.id] ?? 0),
    0,
  );
  const contentWidth = columnsWidth + selectColumnWidth;
  const fillWidth = viewportWidth && viewportWidth > 0 ? viewportWidth : minWidth;
  const targetTableWidth = Math.max(contentWidth, fillWidth);
  const stretchedColumnWidths = stretchColumnWidthsToFill(
    baseColumnWidths,
    visibleColumns.map((column) => column.id),
    Math.max(0, targetTableWidth - selectColumnWidth),
  );
  const tableWidth =
    selectColumnWidth +
    visibleColumns.reduce((total, column) => total + (stretchedColumnWidths[column.id] ?? 0), 0);

  function getDisplayColumnWidth(columnId: string) {
    return stretchedColumnWidths[columnId] ?? getColumnWidth(columnId);
  }

  return (
    <ScrollableTable minWidth={tableWidth}>
      <table
        ref={tableRef}
        className="w-full table-fixed text-sm"
        style={{ width: tableWidth, minWidth: tableWidth }}
      >
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            {selectable ? (
              <th
                style={{ width: selectColumnWidth }}
                className="py-3 pl-4 pr-2"
                aria-label={hasSelectCellActions ? "Select and actions" : undefined}
              >
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
              const width = getDisplayColumnWidth(column.id);
              const headerLabel = formatTableColumnLabel(column.label);
              const tableColumnIndex = columnIndex + (selectable ? 1 : 0);
              const sortField = column.sortable === false ? undefined : column.sortField ?? column.id;
              const canSort = (Boolean(onSortChange) || sortUnavailable) && Boolean(sortField);
              const isActiveSort = canSort && !sortUnavailable && activeSort?.field === sortField;
              const isLeadingColumn = !selectable && columnIndex === 0;

              return (
                <th
                  key={column.id}
                  draggable
                  style={{ width }}
                  className={cn(
                    "group relative cursor-grab select-none px-2 py-3 text-left active:cursor-grabbing",
                    column.headerClassName,
                    isLeadingColumn && "pl-4",
                    draggingHeaderId === column.id && "cursor-grabbing opacity-60",
                    dragOverHeaderId === column.id && draggingHeaderId !== column.id && "bg-primary/10",
                    resizingColumnId === column.id && "bg-primary/5"
                  )}
                  aria-label={`${headerLabel} column. Drag to reorder.`}
                  onDragStart={(event) => {
                    if ((event.target as HTMLElement).closest('[role="separator"]')) {
                      event.preventDefault();
                      return;
                    }

                    setDraggingHeaderId(column.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggingHeaderId(null);
                    setDragOverHeaderId(null);
                  }}
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
                  <div className="relative flex items-center justify-start">
                    {canSort ? (
                      <button
                        type="button"
                        draggable={false}
                        aria-label={
                          sortUnavailable
                            ? `Sort by ${headerLabel} (unavailable)`
                            : `Sort by ${headerLabel}`
                        }
                        aria-sort={
                          isActiveSort
                            ? activeSort?.direction === "desc"
                              ? "descending"
                              : "ascending"
                            : "none"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSort(sortField!);
                        }}
                        className="group/sort flex min-w-0 items-center gap-0.5 text-left"
                        title={headerLabel}
                      >
                        <span className="min-w-0 truncate text-xs font-semibold leading-tight tracking-wide text-foreground/70 transition-colors">
                          {headerLabel}
                        </span>
                        {isActiveSort ? (
                          activeSort?.direction === "desc" ? (
                            <ChevronDown className="size-3.5 shrink-0 text-foreground/80" />
                          ) : (
                            <ChevronUp className="size-3.5 shrink-0 text-foreground/80" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 group-hover/sort:opacity-100" />
                        )}
                      </button>
                    ) : (
                      <span
                        className="min-w-0 truncate text-left text-xs font-semibold leading-tight tracking-wide text-foreground/70"
                        title={headerLabel}
                      >
                        {headerLabel}
                      </span>
                    )}
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
              const active = activeRowId === id;

              return (
                <tr
                  key={id}
                  className={cn(
                    (onRowClick || onRowDoubleClick) && "cursor-pointer",
                    "border-b transition-colors last:border-0 hover:bg-muted/25",
                    (selected || active) && "bg-primary/[0.06]"
                  )}
                  onMouseDown={handleRowMouseDown}
                  onClick={(event) => handleRowClick(event, row)}
                  onDoubleClick={() => handleRowDoubleClick(row)}
                >
                  {selectable ? (
                    <td
                      style={{ width: selectColumnWidth }}
                      className="py-3 pl-4 pr-2 align-top"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          aria-label={`Select ${rowLabel?.(row) ?? id}`}
                          checked={selected}
                          onChange={(event) => onToggleSelect?.(id, event.target.checked)}
                          className="size-4 shrink-0 rounded border-input"
                        />
                        {renderSelectCellActions?.(row)}
                      </div>
                    </td>
                  ) : null}
                  {visibleColumns.map((column, columnIndex) => {
                    const cellContent = column.renderCell(row);
                    const cellText =
                      typeof cellContent === "string" || typeof cellContent === "number"
                        ? String(cellContent)
                        : undefined;
                    const copyText = resolveCopyableText(column, row, cellContent);

                    const shouldTruncate = column.truncateCell === true;
                    const isLeadingColumn = !selectable && columnIndex === 0;

                    return (
                    <td
                      key={column.id}
                      style={{ width: getDisplayColumnWidth(column.id) }}
                      className={cn(
                        "px-2 py-3 align-top",
                        shouldTruncate ? "overflow-hidden" : "whitespace-normal break-words",
                        column.cellClassName,
                        isLeadingColumn && "pl-4",
                      )}
                      onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                      title={!copyText && shouldTruncate && cellText ? cellText : undefined}
                    >
                      {copyText ? (
                        <TableCopyableCell
                          value={copyText}
                          truncate={shouldTruncate}
                        >
                          {!shouldTruncate ? cellContent : undefined}
                        </TableCopyableCell>
                      ) : shouldTruncate ? (
                        <div className="truncate">{cellContent}</div>
                      ) : (
                        <div className="min-w-0 max-w-full break-words [overflow-wrap:break-word]">
                          {cellContent}
                        </div>
                      )}
                    </td>
                    );
                  })}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={colSpan} className="p-0">
                <div
                  className="sticky left-0 flex flex-col items-center justify-center px-6 py-12 text-center"
                  style={viewportWidth ? { width: viewportWidth } : undefined}
                >
                  {emptyState}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollableTable>
  );
}

export function DataTable<T>(props: DataTableProps<T>) {
  return <DataTableContent {...props} />;
}
