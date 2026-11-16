type FixtureUser = { uid: string; email: string; displayName: string; getIdToken: (force?: boolean) => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: { companyId: string }; expirationTime: string }> };
let listener: ((user: FixtureUser | null) => Promise<void>) | null = null;
const auth: { currentUser: FixtureUser | null } = { currentUser: null };
const companies = new Map<string, string>();
const delayed = new Map<string, (token: string) => void>();
const userEvents = new Map<string, Promise<void>>();
let holdRefresh = false;
let refreshResolve: ((token: string) => void) | null = null;
let bootstrapResolve: ((session: object | null) => void) | null = null;
let bootstrapPromise: Promise<object | null> | null = null;
let holdLogout = false;
let logoutResolve: (() => void) | null = null;
let devLoginResolve: (() => void) | null = null;

export const browserLocalPersistence = {};
export const getFirebaseAuth = () => auth;
export const isAuthBypassEnabled = () => new URLSearchParams(window.location.search).get("mode") === "dev";
export const readDevEnvDefaults = () => ({});
export const resolveInitialDevSession = () => {
  bootstrapPromise = new Promise<object | null>(resolve => { bootstrapResolve = resolve; });
  return bootstrapPromise;
};
export async function establishDevSession(input: { email: string; companyId: string }) {
  if (input.email.startsWith("delayed")) await new Promise<void>(resolve => { devLoginResolve = resolve; });
  return { idToken: "dev-fixture-token", email: input.email, companyId: input.companyId, name: input.email, expiresAt: Date.now() + 3600000 };
}
export async function setPersistence() {}
export async function signInWithEmailAndPassword() {}
export async function signOut() {
  if (holdLogout) await new Promise<void>(resolve => { logoutResolve = resolve; });
  await emit(null);
}
export function onIdTokenChanged(_auth: unknown, callback: typeof listener) {
  listener = callback;
  queueMicrotask(() => { void callback?.(auth.currentUser); });
  return () => { if (listener === callback) listener = null; };
}
export async function readFirebaseUserDocument(uid: string) {
  return { companyId: companies.get(uid), email: `${uid}@fixture.test`, name: uid };
}
export function mergeFirebaseUserProfile(_user: unknown, document: object) { return document; }
export function useUserPermissions() {
  return { data: { permissions: [], role: null }, isLoading: false, isPending: false, error: null };
}
export async function emit(uid: string | null, options: { companyId?: string; token?: string; delay?: boolean } = {}) {
  let tokenPromise: Promise<string>;
  if (uid) {
    companies.set(uid, options.companyId ?? "company-a");
    tokenPromise = options.delay ? new Promise(resolve => delayed.set(uid, resolve)) : Promise.resolve(options.token ?? `token-${uid}`);
    auth.currentUser = { uid, email: `${uid}@fixture.test`, displayName: uid,
      getIdToken: force => force && holdRefresh ? new Promise(resolve => { refreshResolve = resolve; }) : tokenPromise,
      getIdTokenResult: async () => ({ claims: { companyId: companies.get(uid)! }, expirationTime: new Date(Date.now() + 3600000).toISOString() }),
    };
  } else auth.currentUser = null;
  const event = listener?.(auth.currentUser) ?? Promise.resolve();
  if (uid) userEvents.set(uid, event);
  await event;
}
export const authBoundary = {
  emit,
  releaseUser: async (uid: string) => { delayed.get(uid)?.(`token-${uid}`); delayed.delete(uid); await userEvents.get(uid); },
  holdRefresh: () => { holdRefresh = true; },
  holdLogout: () => { holdLogout = true; },
  logoutWaiting: () => logoutResolve !== null,
  releaseLogout: () => { holdLogout = false; logoutResolve?.(); logoutResolve = null; },
  devLoginWaiting: () => devLoginResolve !== null,
  releaseDevLogin: () => { devLoginResolve?.(); devLoginResolve = null; },
  refreshWaiting: () => refreshResolve !== null,
  releaseRefresh: () => { holdRefresh = false; refreshResolve?.("late-refreshed-token"); refreshResolve = null; },
  releaseBootstrap: async () => { bootstrapResolve?.({ idToken: "old-bootstrap-token", email: "old@fixture.test", companyId: "old-company", expiresAt: Date.now() + 3600000 }); bootstrapResolve = null; await bootstrapPromise; },
};
