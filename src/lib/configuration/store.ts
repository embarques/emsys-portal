import { DEFAULT_USER_PREFERENCES, type UserPreferenceValues } from "./types";

let snapshot: UserPreferenceValues = { ...DEFAULT_USER_PREFERENCES };
const listeners = new Set<() => void>();

export function subscribeConfigurationStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConfigurationSnapshot() {
  return snapshot;
}

export function getConfigurationServerSnapshot() {
  return DEFAULT_USER_PREFERENCES;
}

export function syncConfigurationStore(next: UserPreferenceValues) {
  snapshot = { ...next };
  listeners.forEach((listener) => listener());
}

export function updateConfigurationTheme(theme: UserPreferenceValues["theme"]) {
  syncConfigurationStore({ ...snapshot, theme });
}
