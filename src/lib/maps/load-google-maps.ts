/**
 * Browser-only loader for the Google Maps JavaScript API.
 *
 * Loads the API once (idempotent) using the `places` library and the
 * `importLibrary` bootstrap. The key is read from
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and never hardcoded.
 */

const GOOGLE_MAPS_CALLBACK = "__emsysInitGoogleMaps";

let loaderPromise: Promise<void> | null = null;

export function getGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

/** True when a Google Maps API key is configured (autocomplete can be offered). */
export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

type GoogleMapsGlobal = {
  maps?: {
    importLibrary?: (name: string) => Promise<unknown>;
  };
};

function getGoogleGlobal(): GoogleMapsGlobal | undefined {
  return (globalThis as { google?: GoogleMapsGlobal }).google;
}

/**
 * Ensure the Google Maps JS API is loaded. Resolves once `importLibrary`
 * is available. Safe to call repeatedly — only one script tag is injected.
 */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (getGoogleGlobal()?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  loaderPromise = new Promise<void>((resolve, reject) => {
    const win = window as unknown as Record<string, unknown>;

    win[GOOGLE_MAPS_CALLBACK] = () => {
      delete win[GOOGLE_MAPS_CALLBACK];
      resolve();
    };

    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      libraries: "places",
      loading: "async",
      callback: GOOGLE_MAPS_CALLBACK,
    });

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loaderPromise = null;
      delete win[GOOGLE_MAPS_CALLBACK];
      reject(new Error("Failed to load the Google Maps script."));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
}

/** Load the Maps API then import a specific library (e.g. "places"). */
export async function importGoogleMapsLibrary<T = unknown>(name: string): Promise<T> {
  await loadGoogleMaps();
  const importLibrary = getGoogleGlobal()?.maps?.importLibrary;
  if (!importLibrary) {
    throw new Error("Google Maps importLibrary is unavailable.");
  }
  return importLibrary(name) as Promise<T>;
}
