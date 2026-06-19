function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** API root from env (includes version prefix, e.g. https://api.example.com/v1). */
export function getConfiguredApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "");
}

function isLocalApiHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * In development, route browser requests through the Next.js dev server proxy
 * (`/api/proxy/*`) so unreachable/upstream errors surface as real HTTP statuses
 * instead of opaque browser CORS/network errors.
 */
export function shouldUseDevProxy(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.NEXT_PUBLIC_API_USE_DEV_PROXY === "false") return false;

  const configured = getConfiguredApiBaseUrl();
  if (!configured) return false;

  try {
    const url = new URL(configured);
    return !isLocalApiHost(url.hostname);
  } catch {
    return false;
  }
}

/** Same-origin proxy path configured in next.config.js rewrites. */
export const DEV_API_PROXY_PATH = "/api/proxy";

/** Base URL used by browser and server API clients. */
export function getApiBaseUrl(): string {
  if (shouldUseDevProxy() && typeof window !== "undefined") {
    return DEV_API_PROXY_PATH;
  }

  return getConfiguredApiBaseUrl();
}

/** Destination for Next.js dev proxy rewrites (direct EMSYS API root). */
export function getDevProxyDestination(): string {
  return getConfiguredApiBaseUrl();
}
