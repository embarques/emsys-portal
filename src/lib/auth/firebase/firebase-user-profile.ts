import { doc, getDocFromServer } from "firebase/firestore";
import type { User } from "firebase/auth";

import { getFirebaseDb } from "@/lib/auth/firebase/firebase-config";

const FIRESTORE_PROFILE_TIMEOUT_MS = 5_000;

function isFirestoreProfileDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_FIRESTORE_PROFILE === "true";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Firestore profile request timed out")), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/** Firestore `users/{uid}` document — only these fields are supported. */
export type FirebaseUserDocument = {
  companyId: string | null;
  email: string | null;
  name: string | null;
};

const EMPTY_PROFILE: FirebaseUserDocument = {
  companyId: null,
  email: null,
  name: null,
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseFirebaseUserDocument(
  data: Record<string, unknown> | undefined,
): FirebaseUserDocument {
  if (!data) return EMPTY_PROFILE;

  return {
    companyId: readString(data.companyId),
    email: readString(data.email),
    name: readString(data.name),
  };
}

export async function readFirebaseUserDocument(uid: string): Promise<FirebaseUserDocument> {
  const db = getFirebaseDb();
  if (!db || isFirestoreProfileDisabled()) return EMPTY_PROFILE;

  try {
    const snapshot = await withTimeout(
      getDocFromServer(doc(db, "users", uid)),
      FIRESTORE_PROFILE_TIMEOUT_MS,
    );
    if (!snapshot.exists()) return EMPTY_PROFILE;
    return parseFirebaseUserDocument(snapshot.data());
  } catch (error) {
    // Firestore is optional — companyId can come from the Firebase JWT claim.
    console.warn("Firestore profile unavailable; falling back to JWT claims.", error);
    return EMPTY_PROFILE;
  }
}

export function mergeFirebaseUserProfile(
  authUser: User,
  document: FirebaseUserDocument,
  options?: { claimCompanyId?: unknown },
): FirebaseUserDocument {
  const claimCompanyId = readString(options?.claimCompanyId);

  return {
    companyId: claimCompanyId ?? document.companyId,
    email: document.email ?? authUser.email,
    name:
      document.name ?? (authUser.displayName?.trim() ? authUser.displayName.trim() : null),
  };
}
