/**
 * Browser-only loader for the Google Maps JavaScript API.
 *
 * Loads the API once (idempotent) using the `places` library and the
 * `importLibrary` bootstrap. Callers supply the selected company's browser key.
 */

const GOOGLE_MAPS_CALLBACK = "__emsysInitGoogleMaps";

let loaderPromise: Promise<void> | null = null;
let loadedApiKey: string | null = null;

type GoogleMapsGlobal = {
  maps?: GoogleMapsCoreApi & {
    importLibrary?: (name: string) => Promise<unknown>;
  };
};

export type GoogleMapsCoreApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
  Marker: new (options: Record<string, unknown>) => unknown;
  SymbolPath: { CIRCLE: number };
};

function getGoogleGlobal(): GoogleMapsGlobal | undefined {
  return (globalThis as { google?: GoogleMapsGlobal }).google;
}

/** Core map classes from the loaded global `google.maps` namespace. */
export function getGoogleMapsCoreApi(): GoogleMapsCoreApi | null {
  const maps = getGoogleGlobal()?.maps;
  if (!maps?.Map || !maps.Marker || !maps.SymbolPath) {
    return null;
  }
  return maps;
}

/**
 * Ensure the Google Maps JS API is loaded. Resolves once `importLibrary`
 * is available. Safe to call repeatedly — only one script tag is injected.
 */
export function loadGoogleMaps(companyApiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  const apiKey = companyApiKey.trim();
  if (!apiKey) return Promise.reject(new Error("Google Maps is not configured for this company."));
  if (loadedApiKey && loadedApiKey !== apiKey) {
    return Promise.reject(new Error("Reload the page to use this company's Google Maps configuration."));
  }
  if (loadedApiKey === apiKey && getGoogleGlobal()?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  loadedApiKey = apiKey;
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
      loadedApiKey = null;
      script.remove();
      delete win[GOOGLE_MAPS_CALLBACK];
      reject(new Error("Failed to load the Google Maps script."));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
}

/** Load the Maps API then import a specific library (e.g. "places"). */
export async function importGoogleMapsLibrary<T = unknown>(name: string, apiKey: string): Promise<T> {
  await loadGoogleMaps(apiKey);
  const importLibrary = getGoogleGlobal()?.maps?.importLibrary;
  if (!importLibrary) {
    throw new Error("Google Maps importLibrary is unavailable.");
  }
  return importLibrary(name) as Promise<T>;
}
