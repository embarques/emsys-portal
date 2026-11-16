import { store } from "@/lib/store/store";

type IdTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

let idTokenProvider: IdTokenProvider | null = null;

export function getAuthContextVersion(): number {
  return store.getState().auth.contextVersion;
}

export function isAuthContextCurrent(version: number): boolean {
  return getAuthContextVersion() === version;
}

export function registerIdTokenProvider(provider: IdTokenProvider) {
  idTokenProvider = provider;
}

export function clearIdTokenProvider() {
  idTokenProvider = null;
}

export async function resolveIdToken(forceRefresh = false): Promise<string | null> {
  // During sign-out Firebase may still expose the old user until its async cleanup completes.
  if (!store.getState().auth.idToken) return null;
  if (idTokenProvider) {
    return idTokenProvider(forceRefresh);
  }

  return store.getState().auth.idToken;
}
