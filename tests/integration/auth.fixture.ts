import type { Page } from "@playwright/test";

const DEV_SESSION_STORAGE_KEY = "emsys:dev-session";

export const PLAYWRIGHT_DEV_SESSION = {
  idToken: "playwright-id-token",
  companyId: "playwright-company",
  email: "playwright@emsys.test",
  name: "Playwright User",
};

/** Seed a valid dev bypass session before the app reads sessionStorage. */
export async function installDevAuth(page: Page) {
  await page.addInitScript(({ storageKey, session }) => {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        ...session,
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );
  }, {
    storageKey: DEV_SESSION_STORAGE_KEY,
    session: PLAYWRIGHT_DEV_SESSION,
  });
}

export async function ensureAuthenticated(page: Page) {
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/login"),
    undefined,
    { timeout: 15_000 },
  );
}
