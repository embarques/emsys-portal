export type TableFilterRange = { start: string; end: string };

/** Parses "2026-01-01 to 2026-06-30" (also `..`, en/em dash, `-`, or comma separators). */
export function parseTableFilterRange(raw: string): TableFilterRange | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const separator of [" to ", "..", "–", "—"]) {
    if (trimmed.includes(separator)) {
      const [start, end] = trimmed.split(separator).map((part) => part.trim());
      if (start && end) return { start, end };
    }
  }

  const dashMatch = trimmed.match(/^(\S+)\s+-\s+(\S+)$/) ?? trimmed.match(/^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/);
  if (dashMatch) {
    return { start: dashMatch[1], end: dashMatch[2] };
  }

  const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length === 2) {
    return { start: commaParts[0], end: commaParts[1] };
  }

  return null;
}
