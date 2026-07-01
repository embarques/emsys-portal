import { expect, type Page, type Response, type TestInfo } from "@playwright/test";

import { ensureAuthenticated, getTestCredentials, injectDevSessionInitScript, signInWithDevSession } from "./auth.fixture";

const WORKSPACE_TABS_STORAGE_KEY = "emsys-workspace-tabs";
const WORKSPACE_TAB_PARAM = "tab";

/** Sidebar labels for common workspace routes (icon rail uses title=label). */
const WORKSPACE_SIDEBAR_LABELS: Record<string, string> = {
  "/accounting/daily-income": "Daily Income",
  "/accounting/accounts": "Chart of Accounts",
  "/customers": "Customers",
  "/orders": "Orders",
  "/invoices": "Invoices",
};

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
  await expect(page).toHaveURL(new RegExp(`${pathPattern}(?:\\?.*${WORKSPACE_TAB_PARAM}=\\d+)?`), {
    timeout: 30_000,
  });

  // Prefer tab URLs — auto-sync should add ?tab=N shortly after navigation.
  await expect(page).toHaveURL(new RegExp(`${pathPattern}\\?.*${WORKSPACE_TAB_PARAM}=\\d+`), {
    timeout: 15_000,
  });
}

export async function waitForWorkspaceShell(page: Page) {
  await expect(page.getByText("Loading workspace…", { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("workspace-empty-tabs")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(workspaceMain(page).locator("[data-tab-id]").first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Open a workspace route through sidebar navigation (matches real user flow). */
export async function openWorkspaceFromSidebar(page: Page, pathname: string) {
  const label = WORKSPACE_SIDEBAR_LABELS[pathname];
  if (!label) {
    throw new Error(`No sidebar label configured for workspace route: ${pathname}`);
  }

  if (pathname.startsWith("/accounting/")) {
    const accountingGroup = page.getByRole("button", { name: "Accounting" });
    if (await accountingGroup.isVisible()) {
      const expanded = await accountingGroup.getAttribute("aria-expanded");
      if (expanded !== "true") {
        await accountingGroup.click();
      }
    }
  }

  const link = page.getByRole("link", { name: label });
  const iconLink = page.locator(`a[title="${label}"]`);

  if (await link.isVisible()) {
    await link.click();
  } else {
    await iconLink.first().click();
  }
}

type GotoWorkspaceOptions = {
  /** API path fragment to wait for (e.g. `/chart-accounts`). Ignores page navigations. */
  waitForApiGet?: string;
};

function isApiResponse(url: string, apiPath: string, method: string) {
  if (!url.includes(apiPath)) return false;

  try {
    const { pathname } = new URL(url);
    const apiPathname = pathname.replace(/^\/api\/proxy/, "");

    // Avoid matching POST /income-statements/search when waiting for POST /income-statements.
    if (apiPath === "/income-statements" && method === "POST") {
      return /\/income-statements\/?$/.test(apiPathname);
    }

    if (apiPath === "/journals" && method === "POST") {
      return /\/journals\/?$/.test(apiPathname);
    }

    if (apiPath === "/income-statements/" && method === "POST") {
      return /\/income-statements\/\d+\/(?:open|close)\/?$/.test(apiPathname);
    }

    if (url.includes("/api/proxy/")) return true;

    const { hostname } = new URL(url);
    if (hostname === "127.0.0.1" || hostname === "localhost") return false;
    return apiPathname.includes(apiPath);
  } catch {
    if (apiPath === "/income-statements" && method === "POST" && url.includes("/search")) {
      return false;
    }
    if (apiPath === "/journals" && method === "POST" && url.includes("/search")) {
      return false;
    }
    return url.includes(apiPath);
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

function configuredApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/+$/, "");
}

function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Map browser proxy URL to direct EMSYS API URL for curl reproduction. */
function resolveDirectApiUrl(responseUrl: string) {
  const apiBase = configuredApiBaseUrl();

  try {
    const parsed = new URL(responseUrl);
    if (parsed.pathname.startsWith("/api/proxy/")) {
      const apiPath = parsed.pathname.replace(/^\/api\/proxy/, "");
      return `${apiBase}${apiPath}${parsed.search}`;
    }

    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      return responseUrl;
    }
  } catch {
    // fall through
  }

  return responseUrl;
}

function formatCurlHeader(name: string, value: string) {
  return `${name}: ${value}`;
}

/** Playwright request.headers() returns header values only (e.g. "Bearer …"), not "Name: value". */
function resolveAuthorizationHeader(headers: Record<string, string>) {
  const raw = headers.authorization ?? headers.Authorization ?? "";
  if (!raw) return "";

  const trimmed = raw.trim();
  if (/^authorization:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^bearer\s+/i.test(trimmed)) {
    return formatCurlHeader("Authorization", trimmed);
  }

  return formatCurlHeader("Authorization", `Bearer ${trimmed}`);
}

/** Build a copy-paste curl command that replays the failed EMSYS API request. */
export function buildApiCurlCommand(response: Response) {
  const request = response.request();
  const method = request.method().toUpperCase();
  const url = resolveDirectApiUrl(response.url());
  const headers = request.headers();
  const authorization = resolveAuthorizationHeader(headers);
  const companyId = headers["x-company-id"] ?? headers["X-Company-Id"] ?? "";
  const postData = request.postData();

  const parts = [`curl -sS -X ${method} ${shellSingleQuote(url)}`];

  if (authorization) {
    parts.push(`-H ${shellSingleQuote(authorization)}`);
  } else {
    parts.push(`-H ${shellSingleQuote("Authorization: Bearer <missing-from-request>")}`);
  }

  if (companyId) {
    parts.push(`-H ${shellSingleQuote(formatCurlHeader("x-company-id", companyId))}`);
  }

  parts.push(`-H ${shellSingleQuote("Content-Type: application/json")}`);

  if (postData && method !== "GET" && method !== "HEAD") {
    parts.push(`--data-raw ${shellSingleQuote(postData)}`);
  }

  const command = parts
    .map((part, index) => (index === 0 ? part : `  ${part}`))
    .join(parts.length > 1 ? " \\\n" : "");

  return `${command}\n# Hits ${url} directly (same path the dev proxy forwards to). Token expires ~1h.`;
}

/** Log EMSYS API response status and body snippet to the test console. */
export async function logApiResponse(
  response: Response,
  label: string,
  options: { includeCurl?: boolean } = {},
) {
  const status = response.status();
  const url = response.url();
  const requestHeaders = response.request().headers();
  const companyId = requestHeaders["x-company-id"] ?? "(missing)";
  const hasBearer = Boolean(requestHeaders.authorization?.startsWith("Bearer"));
  let body = "";

  try {
    body = await response.text();
  } catch {
    body = "(could not read response body)";
  }

  const snippet = body.length > 800 ? `${body.slice(0, 800)}…` : body || "(empty body)";
  const postData = response.request().postData();
  const requestBody = postData ? `\n  request: ${postData.slice(0, 800)}` : "";
  console.log(
    `[playwright:api] ${label}\n  ${response.request().method()} ${url}\n  HTTP ${status}\n  x-company-id=${companyId} bearer=${hasBearer}${requestBody}\n  ${snippet}`,
  );

  const includeCurl = options.includeCurl ?? !response.ok();
  if (includeCurl) {
    const curl = buildApiCurlCommand(response);
    console.log(
      "\n╔══════════════════════════════════════════════════════════════╗",
    );
    console.log("║  COPY CURL BELOW — paste into your terminal (ready to run)   ║");
    console.log(
      "╚══════════════════════════════════════════════════════════════╝",
    );
    console.log("# Includes Authorization: Bearer … and x-company-id headers.");
    console.log("# Token expires ~1h — re-run the test if curl returns auth errors.\n");
    console.log(curl);
    console.log("\n────────────────────────────────────────────────────────────────\n");
  }
}

/** Attach curl script to Playwright report (visible in UI output / attachments tab). */
export async function attachApiCurlToTest(testInfo: TestInfo, response: Response, name: string) {
  const curl = buildApiCurlCommand(response);
  const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-curl.sh`;

  await testInfo.attach(filename, {
    body: curl,
    contentType: "text/plain",
  });

  testInfo.annotations.push({
    type: "curl",
    description: `Reproduce API call — see attachment ${filename} or stdout above`,
  });
}

/** Wait until EMSYS session and x-company-id are ready (permissions request succeeds). */
export async function waitForSessionReady(page: Page) {
  const matchesPermissions = (candidate: Response) =>
    candidate.request().method() === "GET" &&
    candidate.url().includes("/users/permissions") &&
    isApiResponse(candidate.url(), "/users/permissions", "GET");

  let response = await page
    .waitForResponse(matchesPermissions, { timeout: 2_000 })
    .catch(() => null);

  if (!response) {
    response = await page.waitForResponse(matchesPermissions, { timeout: 45_000 });
  }

  const companyId = response.request().headers()["x-company-id"];
  console.log(
    `[playwright:auth] permissions HTTP ${response.status()} x-company-id=${companyId ?? "MISSING"} user=${getTestCredentials().email}`,
  );

  if (!response.ok()) {
    await logApiResponse(response, "permissions request failed");
    throw new Error(`Session not ready: permissions request returned HTTP ${response.status()}.`);
  }

  try {
    const raw = await response.json();
    const body =
      raw && typeof raw === "object" && "data" in raw
        ? (raw as { data: unknown }).data
        : raw && typeof raw === "object" && "response" in raw
          ? (raw as { response: unknown }).response
          : raw;
    const envelope = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const roleName = String(
      (envelope.role as { name?: string } | undefined)?.name ?? "(unknown role)",
    );
    const permissions = [
      ...(Array.isArray(envelope.permissions) ? envelope.permissions : []),
      ...(Array.isArray((envelope.role as { permissions?: unknown[] } | undefined)?.permissions)
        ? ((envelope.role as { permissions: unknown[] }).permissions ?? [])
        : []),
    ];
    const incomePermissions = permissions.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      const type = String(item.resourceType ?? item.resource_type ?? "").toLowerCase();
      return type.includes("income") || type.includes("journal");
    });
    console.log(
      `[playwright:auth] role=${roleName} income/journal permissions: ${JSON.stringify(incomePermissions).slice(0, 1200) || "(none)"}`,
    );
  } catch {
    console.log("[playwright:auth] could not parse permissions response body");
  }

  if (!companyId) {
    throw new Error(
      "Session not ready: x-company-id header missing on permissions request. Check Firebase users/{uid}.companyId or JWT claim.",
    );
  }

  return companyId;
}

/**
 * Open a dashboard workspace route on desktop (tabbed UI).
 * Waits for tab URL sync, the tab bar, and the main workspace shell.
 */
export async function gotoWorkspace(page: Page, pathname: string, options: GotoWorkspaceOptions = {}) {
  await primeWorkspaceTabs(page);
  await injectDevSessionInitScript(page);

  let sessionReady = waitForSessionReady(page);
  const responsePromise = options.waitForApiGet
    ? waitForApiResponse(page, options.waitForApiGet, "GET")
    : null;

  await page.goto(pathname, { waitUntil: "domcontentloaded" });
  await ensureAuthenticated(page);

  if (await page.getByRole("heading", { name: "Dev session login" }).isVisible().catch(() => false)) {
    await signInWithDevSession(page);
    sessionReady = waitForSessionReady(page);
    await page.goto(pathname, { waitUntil: "domcontentloaded" });
  }

  await sessionReady;

  await expect(page.getByText("Loading workspace…", { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });

  const emptyTabState = page.getByTestId("workspace-empty-tabs");
  if (await emptyTabState.isVisible()) {
    await openWorkspaceFromSidebar(page, pathname);
  }

  await waitForWorkspaceTabUrl(page, pathname);
  await waitForWorkspaceShell(page);

  if (responsePromise) {
    await responsePromise;
  }
}
