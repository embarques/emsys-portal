import { MIN_COLUMN_WIDTH } from "@/lib/table/column-preferences";

/** Auto-fit has no upper bound so long values (addresses, notes, routes) can fully display. */
export function clampAutoFitColumnWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return MIN_COLUMN_WIDTH;
  }

  return Math.max(MIN_COLUMN_WIDTH, Math.round(width));
}

function getHorizontalPadding(element: HTMLElement): number {
  const styles = window.getComputedStyle(element);
  return parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
}

function measureTextWidth(text: string, referenceElement: HTMLElement): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;

  const probe = document.createElement("span");
  const styles = window.getComputedStyle(referenceElement);
  probe.style.position = "fixed";
  probe.style.left = "-10000px";
  probe.style.top = "0";
  probe.style.visibility = "hidden";
  probe.style.whiteSpace = "nowrap";
  probe.style.font = styles.font;
  probe.style.letterSpacing = styles.letterSpacing;
  probe.textContent = normalized;
  document.body.appendChild(probe);

  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function hasComplexCellContent(content: HTMLElement): boolean {
  return Boolean(
    content.querySelector("svg, button, input, img, textarea, select, .inline-flex, [data-slot='badge']"),
  );
}

/** Measure natural width without table or uniform-pill width constraints. */
function stripMeasuredWidthConstraints(element: HTMLElement): void {
  element.classList.remove("truncate", "w-full", "max-w-full", "min-w-0");
  element.style.overflow = "visible";
  element.style.textOverflow = "clip";
  element.style.whiteSpace = "nowrap";
  element.style.width = "auto";
  element.style.minWidth = "0";
  element.style.maxWidth = "none";

  element.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.classList.remove("truncate", "w-full", "max-w-full", "min-w-0");
    node.style.width = "auto";
    node.style.minWidth = "0";
    node.style.maxWidth = "none";
    node.style.overflow = "visible";
    node.style.textOverflow = "clip";
    node.style.whiteSpace = "nowrap";
  });
}

function measureComplexContent(cell: HTMLElement, content: HTMLElement): number {
  const padding = getHorizontalPadding(cell);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.visibility = "hidden";
  container.style.display = "inline-flex";
  container.style.alignItems = "center";
  container.style.whiteSpace = "nowrap";

  const clone = content.cloneNode(true) as HTMLElement;
  stripMeasuredWidthConstraints(clone);
  container.appendChild(clone);
  document.body.appendChild(container);

  const width = container.getBoundingClientRect().width;
  container.remove();
  return padding + width;
}

function isPlaceholderCellText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized === "" || normalized === "—" || normalized === "-";
}

function measureBodyCell(cell: HTMLTableCellElement): number {
  const padding = getHorizontalPadding(cell);
  const fullText = cell.textContent ?? "";
  // Always floor on the full cell text so ellipsis/truncate chrome cannot
  // under-measure long address, route, or purpose values.
  const textFloor = isPlaceholderCellText(fullText)
    ? 36
    : measureTextWidth(fullText, cell);

  const content =
    cell.querySelector(":scope > .truncate") ??
    cell.querySelector(":scope > div") ??
    cell.querySelector(":scope > span") ??
    cell;

  if (!(content instanceof HTMLElement)) {
    return clampAutoFitColumnWidth(padding + textFloor);
  }

  if (hasComplexCellContent(content)) {
    return clampAutoFitColumnWidth(
      Math.max(padding + textFloor, measureComplexContent(cell, content)),
    );
  }

  const contentText = content.textContent ?? "";
  if (isPlaceholderCellText(contentText) && isPlaceholderCellText(fullText)) {
    return clampAutoFitColumnWidth(padding + 36);
  }

  return clampAutoFitColumnWidth(
    padding + Math.max(textFloor, measureTextWidth(contentText, content)),
  );
}

/** Reserve room for the sort chevron (size-3.5) and its gap so the full header label always fits. */
const HEADER_SORT_ICON_WIDTH = 14;
const HEADER_LABEL_ICON_GAP = 2;

function measureHeaderCell(cell: HTMLTableCellElement): number {
  const padding = getHorizontalPadding(cell);
  const label = cell.querySelector("span");
  const labelWidth = label ? measureTextWidth(label.textContent ?? "", label) : 0;
  const resizeHandleWidth = 8;

  return (
    padding + labelWidth + HEADER_LABEL_ICON_GAP + HEADER_SORT_ICON_WIDTH + resizeHandleWidth + 2
  );
}

/** Measures the minimum width needed to fit header + row content without truncation. */
export function measureTableColumnContentWidth(table: HTMLTableElement, columnIndex: number): number {
  if (columnIndex < 0) {
    return clampAutoFitColumnWidth(0);
  }

  let maxWidth = 0;

  table.querySelectorAll("thead tr").forEach((row) => {
    const cell = row.children[columnIndex];
    if (cell instanceof HTMLTableCellElement) {
      maxWidth = Math.max(maxWidth, measureHeaderCell(cell));
    }
  });

  table.querySelectorAll("tbody tr").forEach((row) => {
    const cell = row.children[columnIndex];
    if (!(cell instanceof HTMLTableCellElement)) return;
    if (cell.colSpan > 1) return;
    maxWidth = Math.max(maxWidth, measureBodyCell(cell));
  });

  return clampAutoFitColumnWidth(Math.ceil(maxWidth) + 2);
}
