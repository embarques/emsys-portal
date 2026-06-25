import { expect, type Page } from "@playwright/test";

export const AUTH_STATE_PATH = "playwright/.auth/user.json";

export function getTestCredentials() {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL?.trim();
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set in .env.local.",
    );
  }

  return { email, password };
}

export async function signInWithFirebase(page: Page) {
  const { email, password } = getTestCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByText("Loading...", { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
}

export async function ensureAuthenticated(page: Page) {
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}
