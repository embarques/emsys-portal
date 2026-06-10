function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** API root from env (includes version prefix, e.g. https://api.example.com/v1). */
export function getConfiguredApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "");
}

/** Base URL used by browser and server API clients (direct calls; API CORS must allow the portal origin). */
export function getApiBaseUrl(): string {
  return getConfiguredApiBaseUrl();
}
