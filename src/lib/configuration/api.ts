import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { DEFAULT_USER_PREFERENCES, normalizeMaxWorkspaceTabs, type UserPreference, type UserPreferenceValues } from "./types";

type Envelope<T> = { success?: boolean; message?: string; data?: T };

function normalize(raw: Partial<UserPreference> | undefined): UserPreference {
  return {
    id: Number(raw?.id ?? 0),
    user: { id: Number(raw?.user?.id ?? 0) },
    language: raw?.language === "es" ? "es" : "en",
    theme: raw?.theme === "light" || raw?.theme === "dark" ? raw.theme : "system",
    maxWorkspaceTabs: normalizeMaxWorkspaceTabs(raw?.maxWorkspaceTabs),
    createdAt: raw?.createdAt ?? "",
    updatedAt: raw?.updatedAt ?? "",
  };
}

export async function fetchCurrentUserPreferences(): Promise<UserPreference> {
  const response = await apiClient.get<Envelope<UserPreference>>(API_ENDPOINTS.CURRENT_USER_PREFERENCES);
  return normalize(response.data ?? DEFAULT_USER_PREFERENCES);
}

export async function updateCurrentUserPreferences(values: UserPreferenceValues): Promise<UserPreference> {
  const response = await apiClient.put<Envelope<UserPreference>>(API_ENDPOINTS.CURRENT_USER_PREFERENCES, values);
  if (response.success === false) throw new Error(response.message || "Unable to save preferences.");
  return normalize(response.data);
}
