import type { FirebaseUserDocument } from "@/lib/auth/firebase/firebase-user-profile";

export const DEV_SESSION_STORAGE_KEY = "emsys:dev-session";

export type DevSession = FirebaseUserDocument & {
  idToken: string;
  /** Unix ms when the Firebase idToken should be treated as expired. */
  expiresAt: number;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Decode JWT `exp` (seconds) without verifying signature — dev expiry hint only. */
export function jwtExpiresAtMs(idToken: string): number | null {
  const parts = idToken.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (typeof payload.exp === "number" && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }

  return null;
}

export function tokenExpiresAtMs(idToken: string, expiresInSeconds?: number): number {
  const fromJwt = jwtExpiresAtMs(idToken);
  if (fromJwt) return fromJwt;

  if (typeof expiresInSeconds === "number" && expiresInSeconds > 0) {
    return Date.now() + expiresInSeconds * 1000;
  }

  return Date.now() + 55 * 60 * 1000;
}

export function isDevSessionValid(session: DevSession | null, skewMs = 60_000): boolean {
  if (!session?.idToken || !session.companyId) return false;
  return session.expiresAt > Date.now() + skewMs;
}

export function parseDevSession(raw: unknown): DevSession | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const idToken = readString(item.idToken);
  const companyId = readString(item.companyId);
  const email = readString(item.email);
  const name = readString(item.name);
  const expiresAt =
    typeof item.expiresAt === "number" && Number.isFinite(item.expiresAt)
      ? item.expiresAt
      : idToken
        ? jwtExpiresAtMs(idToken)
        : null;

  if (!idToken || !companyId || !email || !expiresAt) return null;

  return { idToken, companyId, email, name, expiresAt };
}

export function readDevSession(): DevSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = parseDevSession(JSON.parse(raw));
    return isDevSessionValid(session) ? session : null;
  } catch {
    return null;
  }
}

export function saveDevSession(session: DevSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearDevSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEV_SESSION_STORAGE_KEY);
}

export function devSessionFromProfile(input: {
  idToken: string;
  companyId: string;
  email: string;
  name?: string | null;
  expiresInSeconds?: number;
}): DevSession {
  return {
    idToken: input.idToken,
    companyId: input.companyId,
    email: input.email,
    name: input.name?.trim() ? input.name.trim() : null,
    expiresAt: tokenExpiresAtMs(input.idToken, input.expiresInSeconds),
  };
}
