import { chromium, type FullConfig } from "@playwright/test";

import { persistAuthStorageState, signInWithDevSession } from "./auth.fixture";

/** Runs once before tests (after webServer). Replaces auth.setup.ts to avoid UI-mode teardown bugs. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) {
    throw new Error("playwright.config.ts must define use.baseURL for global auth setup.");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await signInWithDevSession(page);
    await persistAuthStorageState(context, page);
  } finally {
    await context.close();
    await browser.close();
  }
}
