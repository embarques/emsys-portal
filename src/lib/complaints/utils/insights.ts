const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

/** Insights bounds are inclusive UTC calendar days. */
export function defaultComplaintInsightsRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  return { from: `${to.slice(0, 8)}01`, to };
}

/** Mirrors the API's checks: both dates, `to` on or after `from`, at most 365 days apart. */
export function complaintInsightsRangeError(from: string, to: string): string | null {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return "complaints.insights.errors.dates";
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return "complaints.insights.errors.order";
  if (days > MAX_RANGE_DAYS) return "complaints.insights.errors.span";
  return null;
}

export function complaintReopenRate(total: number, reopened: number): number | null {
  return total > 0 ? reopened / total : null;
}
