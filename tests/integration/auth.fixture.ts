import fs from "node:fs";
import path from "node:path";

import { expect, type BrowserContext, type Page } from "@playwright/test";

export const AUTH_STATE_PATH = "playwright/.auth/user.json";
const DEV_SESSION_STORAGE_KEY = "emsys:dev-session";

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

export function getTestCompanyId() {
  const companyId = process.env.PLAYWRIGHT_TEST_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error(
      "PLAYWRIGHT_TEST_COMPANY_ID must be set in .env.local (EMSYS company id for the test user).",
    );
  }
  return companyId;
}

function configuredApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/+$/, "");
}

function jwtExpiresAtMs(idToken: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { exp?: number };
    if (typeof payload.exp === "number" && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    // fall through
  }
  return Date.now() + 55 * 60 * 1000;
}

async function mintTestApiToken(email: string, password: string) {
  const response = await fetch(`${configuredApiBaseUrl()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`POST /auth/token failed with HTTP ${response.status}: ${text || "(empty body)"}`);
  }

  const json = JSON.parse(text) as {
    data?: { idToken?: string };
    response?: { idToken?: string };
    idToken?: string;
  };
  const idToken = json.data?.idToken ?? json.response?.idToken ?? json.idToken;
  if (!idToken) {
    throw new Error("POST /auth/token did not return idToken.");
  }
  return idToken;
}

/** Inject dev session before navigation so AuthProvider sees it on first paint. */
export async function injectDevSessionInitScript(page: Page) {
  const { email, password } = getTestCredentials();
  const companyId = getTestCompanyId();
  const idToken = await mintTestApiToken(email, password);
  const expiresAt = jwtExpiresAtMs(idToken);

  await page.addInitScript(
    ({ storageKey, session }) => {
      sessionStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      storageKey: DEV_SESSION_STORAGE_KEY,
      session: { idToken, companyId, email, name: null, expiresAt },
    },
  );
}

/** Same EMSYS API token as manual dev login (not Firebase JWT). */
export async function signInWithDevSession(page: Page) {
  const { email, password } = getTestCredentials();
  const companyId = getTestCompanyId();
  const idToken = await mintTestApiToken(email, password);
  const expiresAt = jwtExpiresAtMs(idToken);

  await page.goto("/");
  await page.evaluate(
    ({ storageKey, session }) => {
      sessionStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      storageKey: DEV_SESSION_STORAGE_KEY,
      session: { idToken, companyId, email, name: null, expiresAt },
    },
  );

  const sessionReady = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "GET" && candidate.url().includes("/users/permissions"),
    { timeout: 45_000 },
  );

  await page.reload();

  const permissions = await sessionReady;
  if (!permissions.ok()) {
    throw new Error(`Session not ready: /users/permissions returned HTTP ${permissions.status()}.`);
  }

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(page.getByText("Loading...", { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
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

/** Write browser storage (incl. dev session) for reuse via `storageState` in tests. */
export async function persistAuthStorageState(context: BrowserContext, page: Page) {
  const devSessionValue = await page.evaluate(
    (storageKey) => sessionStorage.getItem(storageKey),
    DEV_SESSION_STORAGE_KEY,
  );

  const state = await context.storageState();
  if (devSessionValue) {
    for (const origin of state.origins) {
      if (origin.origin.includes("127.0.0.1:3100")) {
        origin.sessionStorage = [{ name: DEV_SESSION_STORAGE_KEY, value: devSessionValue }];
      }
    }
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state, null, 2));
}

export async function ensureAuthenticated(page: Page) {
  const devLogin = page.getByRole("heading", { name: "Dev session login" });
  if (await devLogin.isVisible().catch(() => false)) {
    await signInWithDevSession(page);
    return;
  }

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}
