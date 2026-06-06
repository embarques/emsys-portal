import {
  DEFAULT_USER_CONFIGURATION,
  type UserConfiguration,
} from "./types";

const STORAGE_KEY = "emsys-user-configuration";

let configurationStore: UserConfiguration = { ...DEFAULT_USER_CONFIGURATION };
const listeners = new Set<() => void>();

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
  return { ...configurationStore };
}

export function initializeConfigurationStore() {
  const stored = readStoredConfiguration();
  configurationStore = stored ? { ...stored } : { ...DEFAULT_USER_CONFIGURATION };
  emit();
}

export function setConfigurationStore(next: UserConfiguration) {
  configurationStore = { ...next };
  writeStoredConfiguration(configurationStore);
  emit();
}

export function resetConfigurationStore() {
  configurationStore = { ...DEFAULT_USER_CONFIGURATION };
  writeStoredConfiguration(configurationStore);
  emit();
}
