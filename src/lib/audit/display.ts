export function formatAuditDate(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return "—";

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

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
  }).format(parsed);
}
