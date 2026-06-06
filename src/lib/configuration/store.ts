import {
  DEFAULT_USER_CONFIGURATION,
  type UserConfiguration,
} from "./types";

const STORAGE_KEY = "emsys-user-configuration";

let configurationStore: UserConfiguration = { ...DEFAULT_USER_CONFIGURATION };
let cachedSnapshot: UserConfiguration = configurationStore;
const serverSnapshot: UserConfiguration = { ...DEFAULT_USER_CONFIGURATION };
const listeners = new Set<() => void>();

function configurationsEqual(a: UserConfiguration, b: UserConfiguration): boolean {
  return (
    a.username === b.username &&
    a.password === b.password &&
    a.displayName === b.displayName &&
    a.language === b.language &&
    a.theme === b.theme
  );
}

function commitConfigurationStore(next: UserConfiguration, persist: boolean) {
  configurationStore = { ...next };
  cachedSnapshot = configurationStore;

  if (persist) {
    writeStoredConfiguration(configurationStore);
  }

  emit();
}

function emit() {
  listeners.forEach((listener) => listener());
}

function readStoredConfiguration(): UserConfiguration | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserConfiguration>;
    return {
      username: parsed.username?.trim() || DEFAULT_USER_CONFIGURATION.username,
      password: parsed.password || DEFAULT_USER_CONFIGURATION.password,
      displayName: parsed.displayName?.trim() || DEFAULT_USER_CONFIGURATION.displayName,
      language: parsed.language === "es" ? "es" : "en",
      theme: parsed.theme === "dark" ? "dark" : "light",
    };
  } catch {
    return null;
  }
}

function writeStoredConfiguration(config: UserConfiguration) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function subscribeConfigurationStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConfigurationSnapshot(): UserConfiguration {
  return cachedSnapshot;
}

export function getConfigurationServerSnapshot(): UserConfiguration {
  return serverSnapshot;
}

export function initializeConfigurationStore() {
  const stored = readStoredConfiguration();
  const next = stored ? { ...stored } : { ...DEFAULT_USER_CONFIGURATION };

  if (configurationsEqual(next, configurationStore)) {
    return;
  }

  commitConfigurationStore(next, false);
}

export function setConfigurationStore(next: UserConfiguration) {
  commitConfigurationStore(next, true);
}

export function resetConfigurationStore() {
  commitConfigurationStore({ ...DEFAULT_USER_CONFIGURATION }, true);
}
