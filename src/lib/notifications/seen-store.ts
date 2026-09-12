const SEEN_STORAGE_KEY = "emsys-notifications-seen-ids";

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  // Keep the set bounded so localStorage does not grow forever.
  const trimmed = Array.from(ids).slice(-400);
  window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(trimmed));
}

export function getSeenNotificationIds(): Set<string> {
  return readSeenIds();
}

export function markNotificationsSeen(ids: string[]) {
  if (ids.length === 0) return;
  const next = readSeenIds();
  for (const id of ids) next.add(id);
  writeSeenIds(next);
}

export function notificationActivityId(activityId: string) {
  return `activity:${activityId}`;
}

export function notificationCheckId(checkId: string) {
  return `check:${checkId}`;
}
