/**
 * @deprecated Auth runs in global-setup.ts. Kept so `playwright test auth.setup.ts` still works in CLI.
 */
import { test as setup } from "@playwright/test";

import { persistAuthStorageState, signInWithDevSession } from "./auth.fixture";

setup("authenticate with EMSYS API session", async ({ page, context }) => {
  await signInWithDevSession(page);
  await persistAuthStorageState(context, page);
});
