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
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { clearIdTokenProvider, registerIdTokenProvider } from "@/lib/api/auth-transport";
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
import { queryKeys } from "@/lib/query/query-keys";
import { useAppDispatch } from "@/lib/store/hooks";
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
    const tokenResult = await user.getIdTokenResult();
    const document = await readFirebaseUserDocument(user.uid);

    return mergeFirebaseUserProfile(user, document, {
      claimCompanyId: tokenResult.claims.companyId,
    });
  } catch (error) {
    console.error("Error resolving Firebase user profile:", error);
    return mergeFirebaseUserProfile(user, EMPTY_PROFILE);
  }
}

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
  const queryClient = useQueryClient();

  const companyId = profile?.companyId ?? null;

  const permissionsQuery = useUserPermissions(
    !profileLoading && Boolean(idToken) && Boolean(companyId),
  );

  const permissions = permissionsQuery.data?.permissions ?? [];
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
        }),
      );
    },
    [dispatch],
  );

  const clearLocalSession = useCallback(() => {
    setIdToken(null);
    setProfile(null);
    setDevSessionExpiresAt(null);
    dispatch(clearAuthTransport());
    queryClient.removeQueries({ queryKey: queryKeys.permissions.all });
  }, [dispatch, queryClient]);

  useEffect(() => {
    if (!isAuthBypass) return;

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setProfileLoading(true);
      setError(null);

      try {
        const session = await resolveInitialDevSession();
        if (cancelled) return;

        if (session) {
          applyDevSession(session);
        } else {
          clearDevSession();
          clearLocalSession();
        }
      } catch (initError) {
        console.error("Dev session bootstrap failed:", initError);
        if (!cancelled) {
          clearDevSession();
          clearLocalSession();
          setError(
            initError instanceof Error
              ? initError
              : new Error("Unable to start dev session."),
          );
        }
      } finally {
        if (!cancelled) {
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

    const unsubscribe = onIdTokenChanged(
      auth,
      async (currentUser) => {
        try {
          setUser(currentUser);
          setError(null);
          setLoading(false);

          if (!currentUser) {
            setIdToken(null);
            setProfile(null);
            clearLocalSession();
            setProfileLoading(false);
            return;
          }

          setProfileLoading(true);
          const [token, resolvedProfile] = await Promise.all([
            currentUser.getIdToken(),
            resolveFirebaseUserProfile(currentUser),
          ]);
          setIdToken(token);
          setProfile(resolvedProfile);
          dispatch(
            setAuthTransport({
              idToken: token,
              companyId: resolvedProfile.companyId,
            }),
          );
        } catch (nextError) {
          console.error("Error handling Firebase auth state:", nextError);
          setError(
            nextError instanceof Error
              ? nextError
              : new Error("Unable to initialize authenticated session."),
          );
          setIdToken(null);
          setProfile(null);
          clearLocalSession();
        } finally {
          setProfileLoading(false);
        }
      },
      (nextError) => {
        setError(nextError);
        setUser(null);
        setIdToken(null);
        setProfile(null);
        clearLocalSession();
        setLoading(false);
        setProfileLoading(false);
      },
    );

    return () => unsubscribe();
  }, [clearLocalSession, dispatch, isAuthBypass]);

  useEffect(() => {
    if (isAuthBypass) {
      if (!idToken || !devSessionExpiresAt) return;

      const refreshIfNeeded = async () => {
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
          applyDevSession(next);
        } catch (refreshError) {
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
      try {
        const tokenResult = await user.getIdTokenResult();
        if (cancelled) return;

        const expiresAt = new Date(tokenResult.expirationTime).getTime();
        const refreshInMs = Math.max(expiresAt - Date.now() - 5 * 60 * 1000, 60 * 1000);

        refreshTimer = setTimeout(async () => {
          try {
            const refreshedToken = await user.getIdToken(true);
            setIdToken(refreshedToken);
            dispatch(
              setAuthTransport({
                idToken: refreshedToken,
                companyId,
              }),
            );
          } catch (refreshError) {
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
        console.error("Error scheduling Firebase ID token refresh:", refreshError);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void user.getIdToken().then((nextToken) => {
          setIdToken(nextToken);
          dispatch(
            setAuthTransport({
              idToken: nextToken,
              companyId,
            }),
          );
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
    user,
  ]);

  const signInWithDevSession = useCallback(
    async (input: DevSessionInput) => {
      if (!isAuthBypass) {
        throw new Error("Dev session sign-in is only available in bypass mode.");
      }

      const session = await establishDevSession(input);
      applyDevSession(session);
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
    if (isAuthBypass) {
      clearDevSession();
      clearLocalSession();
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) return;

    clearLocalSession();
    await firebaseSignOut(auth);
  }, [clearLocalSession, isAuthBypass]);

  const getIdToken = useCallback(
    async (forceRefresh = false) => {
      if (isAuthBypass) {
        if (!forceRefresh) return idToken;

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
        applyDevSession(session);
        return session.idToken;
      }

      const currentUser = getFirebaseAuth()?.currentUser ?? user;
      if (!currentUser) return null;

      const token = await currentUser.getIdToken(forceRefresh);
      setIdToken(token);
      dispatch(setAuthTransport({ idToken: token, companyId }));
      return token;
    },
    [applyDevSession, companyId, dispatch, idToken, isAuthBypass, profile?.name, user],
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
