"use client";

import {
  browserLocalPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { CanceledError } from "axios";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { clearIdTokenProvider, getAuthContextVersion, isAuthContextCurrent, registerIdTokenProvider } from "@/lib/api/auth-transport";
import { subscribeAuthQueryBoundary } from "@/lib/auth/utils/auth-query-boundary";
import { getFirebaseAuth } from "@/lib/auth/firebase/firebase-config";
import {
  mergeFirebaseUserProfile,
  readFirebaseUserDocument,
  type FirebaseUserDocument,
} from "@/lib/auth/firebase/firebase-user-profile";
import { useUserPermissions } from "@/lib/auth/hooks/use-user-permissions";
import { permissionIsGranted, permissionKey } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";
import { isAuthBypassEnabled } from "@/lib/auth/utils/auth-bypass";
import {
  establishDevSession,
  readDevEnvDefaults,
  resolveInitialDevSession,
} from "@/lib/auth/utils/dev-auth";
import {
  clearDevSession,
  isDevSessionValid,
  readDevSession,
  saveDevSession,
  type DevSession,
} from "@/lib/auth/utils/dev-session";
import { store } from "@/lib/store/store";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearAuthTransport, setAuthTransport } from "@/lib/store/auth/auth-slice";

export type DevSessionInput = {
  email: string;
  password: string;
  companyId: string;
  name?: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  role: string | null;
  roleId: number | string | null;
  roleLoading: boolean;
  companyId: string | null;
  permissions: Permission[];
  permissionsLoading: boolean;
  permissionsError: unknown;
  error: Error | null;
  isAuthenticated: boolean;
  isAuthBypass: boolean;
  devSessionExpiresAt: number | null;
  displayName: string | null;
  email: string | null;
  hasPermission: (name: string, resourceType: string) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithDevSession: (input: DevSessionInput) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function resolveFirebaseUserProfile(user: User): Promise<FirebaseUserDocument> {
  try {
    const [tokenResult, document] = await Promise.all([
      user.getIdTokenResult(),
      readFirebaseUserDocument(user.uid),
    ]);

    return mergeFirebaseUserProfile(user, document, {
      claimCompanyId: tokenResult.claims.companyId,
    });
  } catch (error) {
    console.error("Error resolving Firebase user profile:", error);
    return mergeFirebaseUserProfile(user, EMPTY_PROFILE);
  }
}

const EMPTY_PERMISSIONS: Permission[] = [];

const EMPTY_PROFILE: FirebaseUserDocument = {
  companyId: null,
  email: null,
  name: null,
};

function profileFromDevSession(session: DevSession): FirebaseUserDocument {
  return {
    companyId: session.companyId,
    email: session.email,
    name: session.name,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FirebaseUserDocument | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [devSessionExpiresAt, setDevSessionExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const isAuthBypass = isAuthBypassEnabled();
  const dispatch = useAppDispatch();
  const contextVersion = useAppSelector((state) => state.auth.contextVersion);
  const queryClient = useQueryClient();
  const devSignInAttempt = useRef(0);

  useEffect(() => subscribeAuthQueryBoundary(queryClient), [queryClient]);

  const companyId = profile?.companyId ?? null;

  const permissionsQuery = useUserPermissions(
    !profileLoading && Boolean(idToken) && Boolean(companyId),
  );

  const permissions = permissionsQuery.data?.permissions ?? EMPTY_PERMISSIONS;
  const apiRole = permissionsQuery.data?.role ?? null;
  const role = apiRole?.name ?? null;
  const roleId = apiRole?.id ?? null;
  const permissionsSkipped = profileLoading || !idToken || !companyId;
  const permissionsLoading =
    profileLoading ||
    (!permissionsSkipped && (permissionsQuery.isLoading || permissionsQuery.isPending));
  const roleLoading = permissionsLoading;

  const applyDevSession = useCallback(
    (session: DevSession) => {
      setIdToken(session.idToken);
      setProfile(profileFromDevSession(session));
      setDevSessionExpiresAt(session.expiresAt);
      saveDevSession(session);
      dispatch(
        setAuthTransport({
          idToken: session.idToken,
          companyId: session.companyId,
          actorId: `dev:${session.email?.trim().toLowerCase() ?? ""}`,
        }),
      );
    },
    [dispatch],
  );

  const clearLocalSession = useCallback(() => {
    setUser(null);
    setLoading(false);
    setProfileLoading(false);
    setIdToken(null);
    setProfile(null);
    setDevSessionExpiresAt(null);
    dispatch(clearAuthTransport());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthBypass) return;

    let cancelled = false;

    const init = async () => {
      let version = getAuthContextVersion();
      setLoading(true);
      setProfileLoading(true);
      setError(null);

      try {
        const session = await resolveInitialDevSession();
        if (cancelled || !isAuthContextCurrent(version)) return;

        if (session) {
          applyDevSession(session);
        } else {
          clearDevSession();
          clearLocalSession();
        }
        version = getAuthContextVersion();
      } catch (initError) {
        if (cancelled || !isAuthContextCurrent(version)) return;
        console.error("Dev session bootstrap failed:", initError);
        if (!cancelled) {
          clearDevSession();
          clearLocalSession();
          version = getAuthContextVersion();
          setError(
            initError instanceof Error
              ? initError
              : new Error("Unable to start dev session."),
          );
        }
      } finally {
        if (!cancelled && isAuthContextCurrent(version)) {
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [applyDevSession, clearLocalSession, isAuthBypass]);

  useEffect(() => {
    if (isAuthBypass) return;

    const auth = getFirebaseAuth();
    if (!auth) {
      setUser(null);
      setIdToken(null);
      setProfile(null);
      clearLocalSession();
      setLoading(false);
      setProfileLoading(false);
      setError(new Error("Firebase auth is not available in this environment."));
      return;
    }

    setLoading(true);
    setProfileLoading(true);

    let generation = 0;
    let disposed = false;
    const unsubscribe = onIdTokenChanged(
      auth,
      async (currentUser) => {
        if (disposed || currentUser?.uid !== auth.currentUser?.uid) return;
        const currentGeneration = ++generation;
        const current = () => !disposed && currentGeneration === generation;
        let version = getAuthContextVersion();
        try {
          if (store.getState().auth.actorId !== (currentUser?.uid ?? null)) clearLocalSession();
          version = getAuthContextVersion();
          setUser(currentUser);
          setError(null);
          setLoading(false);

          if (!currentUser) {
            setIdToken(null);
            setProfile(null);
            clearLocalSession();
            version = getAuthContextVersion();
            setProfileLoading(false);
            return;
          }

          setProfileLoading(true);
          const [token, resolvedProfile] = await Promise.all([
            currentUser.getIdToken(),
            resolveFirebaseUserProfile(currentUser),
          ]);
          if (!current() || !isAuthContextCurrent(version) || auth.currentUser?.uid !== currentUser.uid) return;
          setIdToken(token);
          setProfile(resolvedProfile);
          dispatch(
            setAuthTransport({
              idToken: token,
              companyId: resolvedProfile.companyId,
              actorId: currentUser.uid,
            }),
          );
          version = getAuthContextVersion();
        } catch (nextError) {
          if (!current() || !isAuthContextCurrent(version)) return;
          console.error("Error handling Firebase auth state:", nextError);
          setError(
            nextError instanceof Error
              ? nextError
              : new Error("Unable to initialize authenticated session."),
          );
          setIdToken(null);
          setProfile(null);
          clearLocalSession();
          version = getAuthContextVersion();
        } finally {
          if (current() && isAuthContextCurrent(version)) setProfileLoading(false);
        }
      },
      (nextError) => {
        if (disposed) return;
        generation += 1;
        setError(nextError);
        setUser(null);
        setIdToken(null);
        setProfile(null);
        clearLocalSession();
        setLoading(false);
        setProfileLoading(false);
      },
    );

    return () => { disposed = true; generation += 1; unsubscribe(); };
  }, [clearLocalSession, dispatch, isAuthBypass]);

  useEffect(() => {
    const actorId = isAuthBypass ? `dev:${profile?.email?.trim().toLowerCase() ?? ""}` : user?.uid ?? null;
    const matchesScope = () => {
      const current = store.getState().auth;
      return current.actorId === actorId && current.companyId === companyId;
    };
    if (isAuthBypass) {
      if (!idToken || !devSessionExpiresAt) return;

      const refreshIfNeeded = async () => {
        if (!matchesScope()) return;
        const version = getAuthContextVersion();
        const session = readDevSession();
        if (session && isDevSessionValid(session)) return;

        const env = readDevEnvDefaults();
        if (!env.email || !env.password || !companyId) return;

        try {
          const next = await establishDevSession({
            email: env.email,
            password: env.password,
            companyId,
            name: profile?.name,
          });
          if (!isAuthContextCurrent(version)) return;
          applyDevSession(next);
        } catch (refreshError) {
          if (!isAuthContextCurrent(version)) return;
          console.warn("Dev token refresh failed:", refreshError);
        }
      };

      const onVisible = () => {
        if (document.visibilityState === "visible") {
          void refreshIfNeeded();
        }
      };

      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }

    if (!user) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleRefresh = async () => {
      const version = getAuthContextVersion();
      if (cancelled || !matchesScope()) return;
      try {
        const tokenResult = await user.getIdTokenResult();
        if (cancelled || !isAuthContextCurrent(version)) return;

        const expiresAt = new Date(tokenResult.expirationTime).getTime();
        const refreshInMs = Math.max(expiresAt - Date.now() - 5 * 60 * 1000, 60 * 1000);

        refreshTimer = setTimeout(async () => {
          if (cancelled || !matchesScope()) return;
          const version = getAuthContextVersion();
          try {
            const refreshedToken = await user.getIdToken(true);
            if (cancelled || !isAuthContextCurrent(version)) return;
            setIdToken(refreshedToken);
            dispatch(
              setAuthTransport({
                idToken: refreshedToken,
                companyId,
                actorId: user.uid,
              }),
            );
          } catch (refreshError) {
            if (cancelled || !isAuthContextCurrent(version)) return;
            console.error("Error refreshing Firebase ID token:", refreshError);
            setError(
              refreshError instanceof Error
                ? refreshError
                : new Error("Token refresh failed."),
            );
          }

          if (!cancelled) {
            void scheduleRefresh();
          }
        }, refreshInMs);
      } catch (refreshError) {
        if (cancelled || !isAuthContextCurrent(version)) return;
        console.error("Error scheduling Firebase ID token refresh:", refreshError);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        if (cancelled || !matchesScope()) return;
        const version = getAuthContextVersion();
        void user.getIdToken().then((nextToken) => {
          if (cancelled || !isAuthContextCurrent(version)) return;
          setIdToken(nextToken);
          dispatch(
            setAuthTransport({
              idToken: nextToken,
              companyId,
              actorId: user.uid,
            }),
          );
        }).catch((refreshError) => {
          if (cancelled || !isAuthContextCurrent(version)) return;
          setError(refreshError instanceof Error ? refreshError : new Error("Token refresh failed."));
        });
      }
    };

    void scheduleRefresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [
    applyDevSession,
    companyId,
    devSessionExpiresAt,
    dispatch,
    idToken,
    isAuthBypass,
    profile?.name,
    profile?.email,
    user,
  ]);

  const signInWithDevSession = useCallback(
    async (input: DevSessionInput) => {
      if (!isAuthBypass) {
        throw new Error("Dev session sign-in is only available in bypass mode.");
      }

      const attempt = ++devSignInAttempt.current;
      const version = getAuthContextVersion();
      const session = await establishDevSession(input);
      if (attempt !== devSignInAttempt.current || !isAuthContextCurrent(version)) throw new CanceledError();
      applyDevSession(session);
      setLoading(false);
      setProfileLoading(false);
    },
    [applyDevSession, isAuthBypass],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (isAuthBypass) {
        const env = readDevEnvDefaults();
        await signInWithDevSession({
          email,
          password,
          companyId: env.companyId ?? "",
          name: env.name,
        });
        return;
      }

      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase auth is not available.");
      }

      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    },
    [isAuthBypass, signInWithDevSession],
  );

  const signOut = useCallback(async () => {
    devSignInAttempt.current += 1;
    if (isAuthBypass) {
      clearDevSession();
      clearLocalSession();
      return;
    }

    const auth = getFirebaseAuth();
    clearLocalSession();
    if (!auth) return;
    await firebaseSignOut(auth);
  }, [clearLocalSession, isAuthBypass]);

  const getIdToken = useCallback(
    async (forceRefresh = false) => {
      const version = getAuthContextVersion();
      const transport = store.getState().auth;
      if (!transport.idToken || transport.companyId !== companyId) return null;
      if (isAuthBypass) {
        if (transport.actorId !== `dev:${profile?.email?.trim().toLowerCase() ?? ""}`) return null;
        if (!forceRefresh) return transport.idToken;

        const env = readDevEnvDefaults();
        const cached = readDevSession();
        const email = cached?.email ?? env.email;
        if (!email || !env.password || !companyId) return idToken;

        const session = await establishDevSession({
          email,
          password: env.password,
          companyId,
          name: profile?.name,
        });
        if (!isAuthContextCurrent(version)) return null;
        applyDevSession(session);
        return session.idToken;
      }

      const currentUser = getFirebaseAuth()?.currentUser ?? user;
      if (!currentUser || currentUser.uid !== transport.actorId) return null;

      const token = await currentUser.getIdToken(forceRefresh);
      if (!isAuthContextCurrent(version)) return null;
      setIdToken(token);
      dispatch(setAuthTransport({ idToken: token, companyId, actorId: currentUser.uid }));
      return token;
    },
    [applyDevSession, companyId, dispatch, idToken, isAuthBypass, profile?.name, profile?.email, user],
  );

  const refreshToken = useCallback(() => getIdToken(true), [getIdToken]);

  useEffect(() => {
    registerIdTokenProvider((forceRefresh) => getIdToken(forceRefresh));
    return () => clearIdTokenProvider();
  }, [getIdToken]);

  const email = profile?.email ?? user?.email ?? null;
  const displayName = profile?.name ?? user?.displayName ?? null;
  const permissionSet = useMemo(
    () => new Set(permissions.map(permissionKey)),
    [permissions],
  );

  const hasPermission = useCallback(
    (name: string, resourceType: string) =>
      permissionIsGranted({ name, resourceType }, permissionSet),
    [permissionSet],
  );

  const hasAnyPermission = useCallback(
    (permissionList: Permission[]) =>
      permissionList.some((permission) =>
        hasPermission(permission.name, permission.resourceType),
      ),
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (permissionList: Permission[]) =>
      permissionList.every((permission) =>
        hasPermission(permission.name, permission.resourceType),
      ),
    [hasPermission],
  );

  const isAuthenticated = isAuthBypass
    ? Boolean(idToken && companyId)
    : Boolean(user);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      role,
      roleId,
      roleLoading,
      companyId,
      permissions,
      permissionsLoading,
      permissionsError: permissionsQuery.error,
      error,
      isAuthenticated,
      isAuthBypass,
      devSessionExpiresAt,
      displayName,
      email,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      signIn,
      signInWithDevSession,
      signOut,
      getIdToken,
      refreshToken,
    }),
    [
      user,
      loading,
      role,
      roleId,
      roleLoading,
      companyId,
      permissions,
      permissionsLoading,
      permissionsQuery.error,
      error,
      isAuthenticated,
      isAuthBypass,
      devSessionExpiresAt,
      displayName,
      email,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      signIn,
      signInWithDevSession,
      signOut,
      getIdToken,
      refreshToken,
    ],
  );

  return <AuthContext.Provider value={value}>
    {/* Reset observers/local views at identity boundaries so keepPreviousData cannot retain prior tenant rows. */}
    <React.Fragment key={contextVersion}>{children}</React.Fragment>
  </AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
