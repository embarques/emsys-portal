/** Same-origin dev proxy prefix (see next.config.js rewrites). */
export const DEV_API_PROXY_PREFIX = "/api";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Remote API root from env (includes version prefix, e.g. https://api.example.com/v1). */
export function getConfiguredApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "");
}

/**
 * Base URL used by browser API clients.
 * In local dev, cross-origin API hosts are routed through the Next.js `/api` proxy
 * to avoid browser CORS blocks.
 */
export function getApiBaseUrl(): string {
  const configured = getConfiguredApiBaseUrl();

  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "development" &&
    configured.startsWith("http")
  ) {
    return DEV_API_PROXY_PREFIX;
  }

  return configured;
}
