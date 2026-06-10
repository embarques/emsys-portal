import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { isAuthBypassEnabled } from "@/lib/auth/utils/auth-bypass";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let initFailed = false;

function isFirebaseConfigValid(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

function initializeFirebase() {
  if (typeof window === "undefined" || isAuthBypassEnabled() || initFailed) {
    return { app: null, auth: null, db: null };
  }

  if (!isFirebaseConfigValid()) {
    return { app: null, auth: null, db: null };
  }

  if (!app) {
    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
    } catch (error) {
      initFailed = true;
      console.error("Failed to initialize Firebase:", error);
      app = null;
      authInstance = null;
      dbInstance = null;
    }
  }

  return { app, auth: authInstance, db: dbInstance };
}

export function getFirebaseAuth(): Auth | null {
  const { auth } = initializeFirebase();
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  const { db } = initializeFirebase();
  return db;
}

export default app;
