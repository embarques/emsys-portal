function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO instant → `datetime-local` input value in the browser's timezone. */
export function toDateTimeLocalInput(iso?: string): string {
  const parsed = iso?.trim() ? new Date(iso) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` input value → UTC ISO-8601 instant, or `null` when invalid. */
export function dateTimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
