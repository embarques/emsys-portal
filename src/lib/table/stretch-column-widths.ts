/** Raises column widths toward equal shares so their total reaches `targetTotal`. */
export function stretchColumnWidthsToFill(
  widths: Readonly<Record<string, number>>,
  columnIds: readonly string[],
  targetTotal: number,
): Record<string, number> {
  const currentTotal = columnIds.reduce((sum, id) => sum + (widths[id] ?? 0), 0);
  if (columnIds.length === 0 || currentTotal >= targetTotal) {
    return Object.fromEntries(columnIds.map((id) => [id, widths[id] ?? 0]));
  }

  const equalShare = Math.floor(targetTotal / columnIds.length);
  const raised = columnIds.map((id) => Math.max(widths[id] ?? 0, equalShare));
  const raisedTotal = raised.reduce((sum, width) => sum + width, 0);

  if (raisedTotal > targetTotal) {
    return distributeExtraWidth(widths, columnIds, targetTotal - currentTotal);
  }

  const raisedWidths = Object.fromEntries(columnIds.map((id, index) => [id, raised[index]]));
  if (raisedTotal < targetTotal) {
    return distributeExtraWidth(raisedWidths, columnIds, targetTotal - raisedTotal);
  }

  return raisedWidths;
}

function distributeExtraWidth(
  widths: Readonly<Record<string, number>>,
  columnIds: readonly string[],
  extraWidth: number,
): Record<string, number> {
  const columnCount = columnIds.length;
  const baseExtra = Math.floor(extraWidth / columnCount);
  const remainder = extraWidth - baseExtra * columnCount;

  return Object.fromEntries(
    columnIds.map((id, index) => [
      id,
      (widths[id] ?? 0) + baseExtra + (index < remainder ? 1 : 0),
    ]),
  );
}
