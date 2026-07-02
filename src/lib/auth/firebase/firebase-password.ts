import { updatePassword } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/auth/firebase/firebase-config";

export async function changeCurrentUserPassword(password: string): Promise<void> {
  const user = getFirebaseAuth()?.currentUser;

  if (!user) {
    throw new Error("Your Firebase session is unavailable. Sign in again and retry.");
  }

  await updatePassword(user, password);
}
