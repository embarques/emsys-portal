const PILL_WIDTH_VARIABLE = "--table-pill-width";
/** Badges marked `data-uniform-width="off"` (e.g. chip lists) keep their natural width. */
const PILL_SELECTOR = '[data-slot="badge"]:not([data-uniform-width="off"])';

/** Applied to body cells so badges take the shared width published by `syncTablePillWidths`. */
export const UNIFORM_PILL_CELL_CLASSNAME =
  "[&_[data-slot=badge]:not([data-uniform-width=off])]:w-[var(--table-pill-width,auto)] [&_[data-slot=badge]:not([data-uniform-width=off])]:max-w-full [&_[data-slot=badge]:not([data-uniform-width=off])]:justify-center";

/**
 * Gives every badge in a table column the width of the widest badge in that
 * column. Widths are written as a CSS variable on each body cell, so badges
 * rendered through portals (sheets, dialogs) are never affected.
 */
export function syncTablePillWidths(table: HTMLTableElement): void {
  const body = table.tBodies[0];
  if (!body) return;

  const cellsByColumn = new Map<number, HTMLTableCellElement[]>();
  for (const row of Array.from(body.rows)) {
    for (const cell of Array.from(row.cells)) {
      if (cell.colSpan > 1) continue;
      cell.style.removeProperty(PILL_WIDTH_VARIABLE);
      if (!cell.querySelector(PILL_SELECTOR)) continue;
      const cells = cellsByColumn.get(cell.cellIndex) ?? [];
      cells.push(cell);
      cellsByColumn.set(cell.cellIndex, cells);
    }
  }

  const widthByColumn = new Map<number, number>();
  cellsByColumn.forEach((cells, columnIndex) => {
    let maxWidth = 0;
    for (const cell of cells) {
      cell.querySelectorAll<HTMLElement>(PILL_SELECTOR).forEach((pill) => {
        maxWidth = Math.max(maxWidth, pill.getBoundingClientRect().width);
      });
    }
    if (maxWidth > 0) widthByColumn.set(columnIndex, Math.ceil(maxWidth));
  });

  widthByColumn.forEach((width, columnIndex) => {
    for (const cell of cellsByColumn.get(columnIndex) ?? []) {
      cell.style.setProperty(PILL_WIDTH_VARIABLE, `${width}px`);
    }
  });
}
