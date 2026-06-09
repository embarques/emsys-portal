import { store } from "@/lib/store/store";

type IdTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

let idTokenProvider: IdTokenProvider | null = null;

export function registerIdTokenProvider(provider: IdTokenProvider) {
  idTokenProvider = provider;
}

export function clearIdTokenProvider() {
  idTokenProvider = null;
}

export async function resolveIdToken(forceRefresh = false): Promise<string | null> {
  if (idTokenProvider) {
    return idTokenProvider(forceRefresh);
  }

  return store.getState().auth.idToken;
}
