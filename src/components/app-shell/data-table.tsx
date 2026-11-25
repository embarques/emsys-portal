"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import { ScrollableTable } from "@/components/app-shell/scrollable-table";
import { TableCopyableCell } from "@/components/app-shell/table-copyable-cell";
import type { TableColumnLayout } from "@/components/app-shell/use-column-visibility";
import { getPrimarySortSpec, type SortDirection } from "@/lib/api/list-query";
import { useTranslation } from "@/lib/i18n";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import { resolveCopyableText } from "@/lib/table/copyable-cell";
import { measureTableColumnContentWidth } from "@/lib/table/measure-column-width";
import { stretchColumnWidthsToFill } from "@/lib/table/stretch-column-widths";
import { syncTablePillWidths, UNIFORM_PILL_CELL_CLASSNAME } from "@/lib/table/uniform-pill-widths";
import {
  createRowPointerState,
  shouldIgnoreRowClick,
  type RowPointerState,
} from "@/lib/table/row-click";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

/** pl-4 (16) + checkbox size-4 (16) + pr-1 (4). Locked so stretch cannot widen it. */
const SELECT_COLUMN_WIDTH_PX = 36;
/**
 * Fallback when row actions are present but not yet measured:
 * checkbox column + gap-1 + two size-7 icon buttons + gap-0.5 between them.
 */
const SELECT_ACTIONS_COLUMN_WIDTH_PX = 100;

function measureSelectColumnWidth(table: HTMLTableElement): number {
  let maxWidth = SELECT_COLUMN_WIDTH_PX;

  table.querySelectorAll("thead tr > :first-child, tbody tr > :first-child").forEach((cell) => {
    if (!(cell instanceof HTMLTableCellElement) || cell.colSpan > 1) return;

    const styles = window.getComputedStyle(cell);
    const padding =
      (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);

    const contentRoot =
      cell.querySelector(":scope > div") ?? cell.querySelector("input[type='checkbox']");
    if (!(contentRoot instanceof HTMLElement)) {
      maxWidth = Math.max(maxWidth, SELECT_COLUMN_WIDTH_PX);
      return;
    }

    // Sum children so overflow-hidden cells still report the natural content width.
    const parts = contentRoot.matches("input[type='checkbox']")
      ? [contentRoot]
      : Array.from(contentRoot.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    const gap = parts.length > 1 ? (Number.parseFloat(window.getComputedStyle(contentRoot).columnGap) || 4) : 0;
    const contentWidth = parts.reduce((sum, part, index) => {
      return sum + part.getBoundingClientRect().width + (index > 0 ? gap : 0);
    }, 0);

    maxWidth = Math.max(maxWidth, Math.ceil(padding + contentWidth));
  });

  return maxWidth;
}

type DataTableDensity = "default" | "compact";

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
  /**
   * Row/header spacing. Portal directories default to `compact` (Appointments
   * standard): tighter padding, `text-sm`, auto-fit to single-line content, and
   * wrap only after the user shrinks a column. Pass `default` only for rare
   * non-directory tables that need looser spacing.
   */
  density?: DataTableDensity;
  selectable?: boolean;
  isRowSelectable?: (row: T) => boolean;
  selectedIds?: string[];
  allPageSelected?: boolean;
  selectAllLabel?: string;
  selectAllDisabled?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: (checked: boolean) => void;
  onToggleSelect?: (id: string, checked: boolean) => void;
  rowLabel?: (row: T) => string;
  /** Optional extra classes for a data row (e.g. warning / status tint). */
  getRowClassName?: (row: T) => string | undefined;
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
  density = "compact",
  selectable = false,
  isRowSelectable,
  selectedIds = [],
  allPageSelected = false,
  selectAllLabel,
  selectAllDisabled = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  onToggleSelect,
  rowLabel,
  getRowClassName,
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
  const { t } = useTranslation();
  const isCompact = density === "compact";
  const {
    isVisible,
    getColumnWidth,
    setColumnWidth,
    fitColumnWidth,
    fitColumnWidths,
    reorderColumns,
    autoFitEpoch = 0,
  } = columnLayout;

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
  /**
   * Compact density: columns stay single-line until the user shrinks them.
   * Shrinking opts that column into wrapping for the rest of the session.
   */
  const [userWrappedColumnIds, setUserWrappedColumnIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pendingRowClickRef = useRef<number | null>(null);
  const rowPointerRef = useRef<RowPointerState | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [measuredSelectColumnWidth, setMeasuredSelectColumnWidth] = useState<number | null>(null);
  const lastAutoFitSignatureRef = useRef<string | null>(null);
  const autoFitPassRef = useRef(0);
  const lastAutoFitEpochRef = useRef(autoFitEpoch);
  const autoFitContextRef = useRef({ pageKey: -1, visibleColumnKey: "" });

  function clearUserWrappedColumn(columnId: string) {
    setUserWrappedColumnIds((current) => {
      if (!current.has(columnId)) return current;
      const next = new Set(current);
      next.delete(columnId);
      return next;
    });
  }

  function markUserWrappedColumn(columnId: string) {
    setUserWrappedColumnIds((current) => {
      if (current.has(columnId)) return current;
      const next = new Set(current);
      next.add(columnId);
      return next;
    });
  }

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
    clearUserWrappedColumn(columnId);
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

    if (lastAutoFitEpochRef.current !== autoFitEpoch) {
      lastAutoFitEpochRef.current = autoFitEpoch;
      lastAutoFitSignatureRef.current = null;
      autoFitPassRef.current = 0;
      // Reset-to-default should return to single-line content fit.
      setUserWrappedColumnIds(new Set());
    }

    const signature = `${pageKey}\0${visibleColumnKey}\0${autoFitEpoch}`;

    if (lastAutoFitSignatureRef.current === signature) return;

    let cancelled = false;
    const frames: number[] = [];

    // Two passes: measure → apply widths → measure again after layout commits.
    const runPass = () => {
      if (cancelled || autoFitPassRef.current >= 2) {
        lastAutoFitSignatureRef.current = signature;
        return;
      }
      autoFitAllVisibleColumns();
      autoFitPassRef.current += 1;
      if (autoFitPassRef.current >= 2) {
        lastAutoFitSignatureRef.current = signature;
        return;
      }
      frames.push(
        requestAnimationFrame(() => {
          frames.push(requestAnimationFrame(runPass));
        }),
      );
    };

    frames.push(
      requestAnimationFrame(() => {
        frames.push(requestAnimationFrame(runPass));
      }),
    );

    return () => {
      cancelled = true;
      frames.forEach((frame) => cancelAnimationFrame(frame));
    };
    // Refit only when table inputs change; the per-render helper would retrigger every pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitColumns, page, rows, isPageDataPending, selectable, visibleColumnKey, autoFitEpoch]);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    syncTablePillWidths(table);

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) syncTablePillWidths(table);
    });
    return () => {
      cancelled = true;
    };
  }, [rows, columns, visibleColumnKey, selectable]);

  // Keep the checkbox/actions column only as wide as its content (never absorb stretch).
  useLayoutEffect(() => {
    if (!selectable) {
      setMeasuredSelectColumnWidth(null);
      return;
    }

    const table = tableRef.current;
    if (!table) return;

    const update = () => {
      const nextWidth = measureSelectColumnWidth(table);
      setMeasuredSelectColumnWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    update();

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) update();
    });
    return () => {
      cancelled = true;
    };
  }, [selectable, rows, visibleColumnKey, renderSelectCellActions]);

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
    let latestWidth = startWidth;
    setResizingColumnId(columnId);

    function handleMouseMove(event: MouseEvent) {
      latestWidth = startWidth + event.clientX - startX;
      setColumnWidth(columnId, latestWidth);
    }

    function handleMouseUp() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizingColumnId(null);
      // Compact: shrinking a column opts it into multiline wrapping.
      if (isCompact && latestWidth < startWidth) {
        markUserWrappedColumn(columnId);
      }
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
    ? measuredSelectColumnWidth ??
      (hasSelectCellActions ? SELECT_ACTIONS_COLUMN_WIDTH_PX : SELECT_COLUMN_WIDTH_PX)
    : 0;
  const selectColumnStyle = {
    width: selectColumnWidth,
    minWidth: selectColumnWidth,
    maxWidth: selectColumnWidth,
  };
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

  const selectCellPaddingClassName = isCompact ? "py-1 pl-3 pr-1" : "py-3 pl-4 pr-1";
  const leadingColumnPaddingClassName = isCompact ? "pl-3" : "pl-4";
  const headerCellPaddingClassName = isCompact ? "px-2 py-1.5" : "px-2 py-3";
  const bodyCellPaddingClassName = isCompact ? "px-2 py-1" : "px-2 py-3";

  return (
    <ScrollableTable minWidth={tableWidth}>
      <table
        ref={tableRef}
        aria-busy={isPageDataPending}
        data-density={density}
        className="w-full table-fixed text-sm"
        style={{ width: tableWidth, minWidth: tableWidth }}
      >
        <colgroup>
          {selectable ? <col style={selectColumnStyle} /> : null}
          {visibleColumns.map((column) => (
            <col key={column.id} style={{ width: getDisplayColumnWidth(column.id) }} />
          ))}
        </colgroup>
        <thead>
          <tr
            className={cn(
              "border-b text-left",
              // Keep default text color so native checkboxes are not tinted by
              // `text-muted-foreground` (WebKit uses currentColor for the control).
              isCompact ? "bg-muted" : "bg-muted/30",
            )}
          >
            {selectable ? (
              <th
                style={selectColumnStyle}
                className={cn(
                  "overflow-hidden align-middle",
                  selectCellPaddingClassName,
                  isCompact && "border-b border-border bg-muted",
                )}
                aria-label={hasSelectCellActions ? t("tableFields.table.selectAndActions") : undefined}
              >
                <input
                  type="checkbox"
                  aria-label={selectAllLabel ?? t("tableFields.table.selectAllOnPage")}
                  disabled={selectAllDisabled}
                  ref={(element) => { if (element) element.indeterminate = selectAllIndeterminate; }}
                  checked={allPageSelected}
                  onChange={(event) => onToggleSelectAll?.(event.target.checked)}
                  className="size-4 shrink-0 rounded border-input"
                />
              </th>
            ) : null}
            {visibleColumns.map((column, columnIndex) => {
              const width = getDisplayColumnWidth(column.id);
              const headerLabel = formatTableColumnLabel(column.label, t);
              const tableColumnIndex = columnIndex + (selectable ? 1 : 0);
              const sortField = column.sortable === false ? undefined : column.sortField ?? column.id;
              const canSort = (Boolean(onSortChange) || sortUnavailable) && Boolean(sortField);
              const isActiveSort = canSort && !sortUnavailable && activeSort?.field === sortField;
              const isLeadingColumn = !selectable && columnIndex === 0;

              return (
                <th
                  key={column.id}
                  draggable
                  scope="col"
                  aria-sort={
                    canSort
                      ? isActiveSort
                        ? activeSort?.direction === "desc"
                          ? "descending"
                          : "ascending"
                        : "none"
                      : undefined
                  }
                  style={{ width }}
                  className={cn(
                    "group relative cursor-grab select-none text-left active:cursor-grabbing",
                    headerCellPaddingClassName,
                    isCompact && "border-b border-border bg-muted font-medium",
                    column.headerClassName,
                    isLeadingColumn && leadingColumnPaddingClassName,
                    draggingHeaderId === column.id && "cursor-grabbing opacity-60",
                    dragOverHeaderId === column.id && draggingHeaderId !== column.id && "bg-primary/10",
                    resizingColumnId === column.id && "bg-primary/5"
                  )}
                  aria-label={t("tableFields.table.columnHeaderAria", { column: headerLabel })}
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
                            ? t("tableFields.table.sortByUnavailable", { column: headerLabel })
                            : t("tableFields.table.sortBy", { column: headerLabel })
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSort(sortField!);
                        }}
                        className="group/sort flex min-h-6 min-w-0 items-center gap-0.5 text-left"
                        title={headerLabel}
                      >
                        <span
                          className={cn(
                            "min-w-0 truncate text-xs font-semibold leading-tight tracking-wide transition-colors",
                            isCompact ? "text-muted-foreground" : "text-foreground/70",
                          )}
                        >
                          {headerLabel}
                        </span>
                        {isActiveSort ? (
                          activeSort?.direction === "desc" ? (
                            <ChevronDown className="size-3.5 shrink-0 text-foreground/80" aria-hidden />
                          ) : (
                            <ChevronUp className="size-3.5 shrink-0 text-foreground/80" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="size-3.5 shrink-0 text-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 group-hover/sort:opacity-100"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "min-w-0 truncate text-left text-xs font-semibold leading-tight tracking-wide",
                          isCompact ? "text-muted-foreground" : "text-foreground/70",
                        )}
                        title={headerLabel}
                      >
                        {headerLabel}
                      </span>
                    )}
                  </div>

                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t("tableFields.table.resizeColumn", { column: headerLabel })}
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
                    isCompact && "even:bg-muted/25 last:border-b-0",
                    (selected || active) && "bg-primary/[0.06]",
                    getRowClassName?.(row),
                  )}
                  onMouseDown={handleRowMouseDown}
                  onClick={(event) => handleRowClick(event, row)}
                  onDoubleClick={() => handleRowDoubleClick(row)}
                >
                  {selectable ? (
                    <td
                      style={selectColumnStyle}
                      className={cn("overflow-hidden align-middle", selectCellPaddingClassName)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1 whitespace-nowrap">
                        <input
                          type="checkbox"
                          aria-label={t("tableFields.table.selectRow", { row: rowLabel?.(row) ?? id })}
                          disabled={isRowSelectable ? !isRowSelectable(row) : false}
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
                    const allowWrap =
                      !shouldTruncate &&
                      (!isCompact || userWrappedColumnIds.has(column.id));
                    const keepSingleLine = isCompact && !shouldTruncate && !allowWrap;

                    return (
                    <td
                      key={column.id}
                      data-wrap={allowWrap ? "true" : keepSingleLine ? "false" : undefined}
                      style={{ width: getDisplayColumnWidth(column.id) }}
                      className={cn(
                        bodyCellPaddingClassName,
                        isCompact ? "align-middle" : "align-top",
                        UNIFORM_PILL_CELL_CLASSNAME,
                        shouldTruncate || keepSingleLine
                          ? "overflow-hidden"
                          : "whitespace-normal break-words",
                        column.cellClassName,
                        // Apply after cellClassName so compact single-line wins over wrap utilities.
                        keepSingleLine &&
                          "overflow-hidden whitespace-nowrap [&_:where(p,div,span)]:whitespace-nowrap",
                        allowWrap &&
                          isCompact &&
                          "overflow-visible whitespace-normal break-words [&_:where(p,div,span)]:whitespace-normal",
                        isLeadingColumn && leadingColumnPaddingClassName,
                      )}
                      onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                      title={
                        !copyText && (shouldTruncate || keepSingleLine) && cellText
                          ? cellText
                          : undefined
                      }
                    >
                      {copyText ? (
                        <TableCopyableCell
                          value={copyText}
                          // Compact single-line must clip inside the column (never paint into neighbors).
                          truncate={shouldTruncate || keepSingleLine}
                        >
                          {
                            // Keep custom cell chrome (e.g. muted address2) even when single-line.
                            typeof cellContent === "string" || typeof cellContent === "number"
                              ? undefined
                              : cellContent
                          }
                        </TableCopyableCell>
                      ) : shouldTruncate || keepSingleLine ? (
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
                  {isPageDataPending ? <p className="text-sm text-muted-foreground">{t("common.loading")}</p> : emptyState}
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
