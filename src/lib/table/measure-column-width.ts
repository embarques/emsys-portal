import { MIN_COLUMN_WIDTH } from "@/lib/table/column-preferences";

/** Auto-fit may exceed manual resize max so long values (addresses, notes) can fully display. */
export const AUTO_FIT_MAX_COLUMN_WIDTH = 1200;

export function clampAutoFitColumnWidth(width: number): number {
  return Math.min(AUTO_FIT_MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
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
  clone.classList.remove("truncate");
  clone.style.overflow = "visible";
  clone.style.textOverflow = "clip";
  clone.style.whiteSpace = "nowrap";
  clone.style.maxWidth = "none";
  clone.style.width = "auto";
  container.appendChild(clone);
  document.body.appendChild(container);

  const width = container.getBoundingClientRect().width;
  container.remove();
  return padding + width;
}

function measureBodyCell(cell: HTMLTableCellElement): number {
  const content =
    cell.querySelector(":scope > .truncate") ??
    cell.querySelector(":scope > div") ??
    cell;

  if (!(content instanceof HTMLElement)) {
    return getHorizontalPadding(cell) + measureTextWidth(cell.textContent ?? "", cell);
  }

  if (hasComplexCellContent(content)) {
    return measureComplexContent(cell, content);
  }

  return getHorizontalPadding(cell) + measureTextWidth(content.textContent ?? "", content);
}

function measureHeaderCell(cell: HTMLTableCellElement): number {
  const padding = getHorizontalPadding(cell);
  const label = cell.querySelector("span");
  const labelWidth = label ? measureTextWidth(label.textContent ?? "", label) : 0;

  const grip = cell.querySelector("button");
  const gripWidth = grip ? grip.getBoundingClientRect().width : 0;

  const inner = cell.querySelector(":scope > .flex");
  const innerStyles = inner instanceof HTMLElement ? window.getComputedStyle(inner) : null;
  const innerGap = innerStyles ? parseFloat(innerStyles.columnGap || innerStyles.gap || "0") : 4;
  const innerPaddingRight = innerStyles ? parseFloat(innerStyles.paddingRight) : 12;

  return padding + gripWidth + innerGap + labelWidth + innerPaddingRight + 4;
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
