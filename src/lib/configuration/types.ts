export type ThemePreference = "light" | "dark" | "system";
export type LanguagePreference = "en" | "es";

export const MIN_MAX_WORKSPACE_TABS = 1;
export const MAX_MAX_WORKSPACE_TABS = 50;
export const DEFAULT_MAX_WORKSPACE_TABS = 20;

export type UserPreference = {
  id: number;
  user: { id: number };
  language: LanguagePreference;
  theme: ThemePreference;
  maxWorkspaceTabs: number;
  createdAt: string;
  updatedAt: string;
};

export type UserPreferenceValues = Pick<UserPreference, "language" | "theme" | "maxWorkspaceTabs">;

export const CONFIGURATION_LANGUAGES = [
  { value: "en", labelKey: "shell.language.en" },
  { value: "es", labelKey: "shell.language.es" },
] as const;

export const CONFIGURATION_THEMES = [
  { value: "light", label: "Light", description: "Bright background with dark text" },
  { value: "dark", label: "Dark", description: "Dark background with light text" },
  { value: "system", label: "System", description: "Match your device appearance" },
] as const;

export const DEFAULT_USER_PREFERENCES: UserPreferenceValues = {
  language: "en",
  theme: "system",
  maxWorkspaceTabs: DEFAULT_MAX_WORKSPACE_TABS,
};

export function normalizeMaxWorkspaceTabs(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_WORKSPACE_TABS;
  return Math.min(MAX_MAX_WORKSPACE_TABS, Math.max(MIN_MAX_WORKSPACE_TABS, Math.round(parsed)));
}
