import { expect, type Page } from "@playwright/test";

import { ensureAuthenticated } from "./auth.fixture";

const WORKSPACE_TABS_STORAGE_KEY = "emsys-workspace-tabs";
const WORKSPACE_TAB_PARAM = "tab";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Clear persisted tabs so each test starts with a single fresh workspace tab. */
export async function primeWorkspaceTabs(page: Page) {
  await page.addInitScript((storageKey) => {
    window.sessionStorage.removeItem(storageKey);
  }, WORKSPACE_TABS_STORAGE_KEY);
}

/** Active workspace panel inside the dashboard shell (desktop tabs). */
export function workspaceMain(page: Page) {
  return page.getByRole("main");
}

export async function waitForWorkspaceTabUrl(page: Page, pathname: string) {
  const pathPattern = escapeRegExp(pathname);
  await expect(page).toHaveURL(new RegExp(`${pathPattern}\\?.*${WORKSPACE_TAB_PARAM}=\\d+`), {
    timeout: 30_000,
  });
}

export async function waitForWorkspaceShell(page: Page) {
  await expect(page.getByText("Loading workspace…", { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByText("Select a page from the sidebar to open a workspace tab.")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(workspaceMain(page).locator("[data-tab-id]").first()).toBeVisible({
    timeout: 15_000,
  });
}

type GotoWorkspaceOptions = {
  /** API path fragment to wait for (e.g. `/accounting/accounts`). Ignores page navigations. */
  waitForApiGet?: string;
};

function isApiResponse(url: string, apiPath: string, method: string) {
  if (!url.includes(apiPath)) return false;

  // Dev proxy requests — preferred in Playwright runs.
  if (url.includes("/api/proxy/")) return true;

  // Direct API host (non-proxy mode).
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname === "127.0.0.1" || hostname === "localhost") return false;
    return pathname.includes(apiPath);
  } catch {
    return false;
  }
}

export function waitForApiResponse(
  page: Page,
  apiPath: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  options: { requireOk?: boolean } = {},
) {
  const requireOk = options.requireOk ?? true;

  return page.waitForResponse(
    (response) => {
      if (response.request().method() !== method) return false;
      if (!isApiResponse(response.url(), apiPath, method)) return false;
      return requireOk ? response.ok() : true;
    },
    { timeout: 30_000 },
  );
}

/**
 * Open a dashboard workspace route on desktop (tabbed UI).
 * Waits for tab URL sync, the tab bar, and the main workspace shell.
 */
export async function gotoWorkspace(page: Page, pathname: string, options: GotoWorkspaceOptions = {}) {
  await primeWorkspaceTabs(page);

  const responsePromise = options.waitForApiGet
    ? waitForApiResponse(page, options.waitForApiGet, "GET")
    : null;

  await page.goto(pathname);
  await ensureAuthenticated(page);
  await waitForWorkspaceTabUrl(page, pathname);
  await waitForWorkspaceShell(page);

  if (responsePromise) {
    await responsePromise;
  }
}
