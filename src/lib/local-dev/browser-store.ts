const isBrowser = typeof window !== "undefined";

export function readBrowserStore<T>(key: string): T[] {
  if (!isBrowser) return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeBrowserStore<T>(key: string, items: T[]): void {
  if (!isBrowser) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

export function clearBrowserStore(key: string): void {
  if (!isBrowser) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}
