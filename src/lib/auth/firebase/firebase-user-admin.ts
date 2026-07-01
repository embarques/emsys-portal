import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
} from "firebase/auth";

import { firebaseConfig, getFirebaseAuth } from "@/lib/auth/firebase/firebase-config";

export async function createSecondaryFirebaseUser(email: string, password: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("Firebase user creation is browser-only.");

  const appName = `emsys-user-create-${crypto.randomUUID()}`;
  const secondaryApp = initializeApp(firebaseConfig, appName);

  try {
    const credential = await createUserWithEmailAndPassword(
      getAuth(secondaryApp),
      email.trim(),
      password,
    );
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function sendUserPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Authentication is not available.");
  await sendPasswordResetEmail(auth, email.trim());
}
