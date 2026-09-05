export type LegacySyncResource = "pickups" | "invoices";

const STORAGE_PREFIX = "emsys.legacy-sync.lastSyncedAt";
const LAST_SYNCED_KEYS = ["lastSyncedAt", "lastSyncAt", "legacySyncedAt", "syncedAt"] as const;

const DATE_LOCALE_TAGS: Record<string, string> = {
  en: "en-US",
  es: "es-US",
};

function storageKey(companyId: string, resource: LegacySyncResource): string {
  return `${STORAGE_PREFIX}.${companyId}.${resource}`;
}

export function parseLastSyncedAt(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    return Number.isFinite(Date.parse(trimmed)) ? trimmed : undefined;
  }

  if (!raw || typeof raw !== "object") return undefined;

  const item = raw as Record<string, unknown>;
  for (const key of LAST_SYNCED_KEYS) {
    const parsed = parseLastSyncedAt(item[key]);
    if (parsed) return parsed;
  }

  return undefined;
}

export function latestTimestamp(...values: Array<string | null | undefined>): string | null {
  let latest: { iso: string; time: number } | null = null;

  for (const value of values) {
    const parsed = parseLastSyncedAt(value);
    if (!parsed) continue;
    const time = Date.parse(parsed);
    if (!Number.isFinite(time)) continue;
    if (!latest || time > latest.time) {
      latest = { iso: parsed, time };
    }
  }

  return latest?.iso ?? null;
}

export function readLastLegacySyncedAt(
  companyId: string,
  resource: LegacySyncResource,
): string | null {
  if (typeof window === "undefined" || !companyId.trim()) return null;

  try {
    return parseLastSyncedAt(window.localStorage.getItem(storageKey(companyId, resource))) ?? null;
  } catch {
    return null;
  }
}

export function writeLastLegacySyncedAt(
  companyId: string,
  resource: LegacySyncResource,
  iso: string,
): void {
  const parsed = parseLastSyncedAt(iso);
  if (typeof window === "undefined" || !companyId.trim() || !parsed) return;

  try {
    window.localStorage.setItem(storageKey(companyId, resource), parsed);
  } catch {
    // Ignore quota / private-mode failures; the in-memory stamp still displays.
  }
}

export function formatLastSyncedAt(iso: string, locale = "en"): string {
  const parsed = parseLastSyncedAt(iso);
  if (!parsed) return "";

  return new Intl.DateTimeFormat(DATE_LOCALE_TAGS[locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}
