import { test as setup } from "@playwright/test";

import { AUTH_STATE_PATH, signInWithFirebase } from "./auth.fixture";

setup("authenticate with Firebase", async ({ page }) => {
  await signInWithFirebase(page);
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
