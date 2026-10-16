const DEFAULT_APP_TIMEZONE = "America/New_York";

/** Keep audit timestamps in the same business timezone as API insight buckets. */
function appTimezone(): string {
  const configured = process.env.NEXT_PUBLIC_APP_TIMEZONE?.trim() || DEFAULT_APP_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured });
    return configured;
  } catch {
    return DEFAULT_APP_TIMEZONE;
  }
}

/** Date-only values represent calendar days and must not shift with timezone. */
export function formatAuditDate(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return "—";

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? "UTC" : appTimezone(),
  }).format(parsed);
}

/** Date + time for entity audit stamps (`createdAt` / `updatedAt`). */
export function formatAuditDateTime(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return "—";

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: appTimezone(),
    timeZoneName: "short",
  }).format(parsed);
}
