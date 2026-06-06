export type ThemePreference = "light" | "dark";
export type LanguagePreference = "en" | "es";

export type UserConfiguration = {
  username: string;
  password: string;
  displayName: string;
  language: LanguagePreference;
  theme: ThemePreference;
};

export type UserConfigurationFormValues = {
  username: string;
  password: string;
  displayName: string;
  language: LanguagePreference;
  theme: ThemePreference;
};

export const CONFIGURATION_LANGUAGES: { value: LanguagePreference; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
];

export const CONFIGURATION_THEMES: { value: ThemePreference; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Bright background with dark text" },
  { value: "dark", label: "Dark", description: "Dark background with light text" },
];

export const DEFAULT_USER_CONFIGURATION: UserConfiguration = {
  username: "admin",
  password: "admin123",
  displayName: "Hector Mejia",
  language: "en",
  theme: "light",
};

export function configurationToFormValues(config: UserConfiguration): UserConfigurationFormValues {
  return {
    username: config.username,
    password: "",
    displayName: config.displayName,
    language: config.language,
    theme: config.theme,
  };
}

export function formValuesToConfiguration(
  values: UserConfigurationFormValues,
  existingPassword: string
): UserConfiguration {
  if (!values.username.trim()) {
    throw new Error("Username is required.");
  }

  if (!values.displayName.trim()) {
    throw new Error("Display name is required.");
  }

  const password = values.password.trim() || existingPassword;
  if (!password) {
    throw new Error("Password is required.");
  }

  return {
    username: values.username.trim(),
    password,
    displayName: values.displayName.trim(),
    language: values.language,
    theme: values.theme,
  };
}

export function getDisplayNameInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function getLanguageLabel(language: LanguagePreference): string {
  return CONFIGURATION_LANGUAGES.find((entry) => entry.value === language)?.label ?? language;
}
