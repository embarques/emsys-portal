import { expect, type Locator, type Page, type Response, type TestInfo } from "@playwright/test";

import { attachApiCurlToTest, logApiResponse, waitForApiResponse } from "../workspace.fixture";

type CloseoutAttemptResult = {
  ok: boolean;
  createStatus?: number;
  reopenStatus?: number;
};

async function selectFirstRealOption(select: Locator, fieldName: string) {
  const optionCount = await select.locator("option").count();
  if (optionCount <= 1) {
    throw new Error(
      `No ${fieldName} options loaded (found ${optionCount} option(s)). Ensure the API returns at least one ${fieldName}.`,
    );
  }
  await expect(select.locator("option").nth(1)).toBeAttached({ timeout: 30_000 });
  const value = await select.locator("option").nth(1).getAttribute("value");
  if (!value) {
    throw new Error(`Expected at least one selectable ${fieldName} option.`);
  }
  await select.selectOption(value);
  return value;
}

async function getBranchCodes(main: Locator) {
  const options = await main.locator("#daily-branch option").all();
  const codes: string[] = [];

  for (const option of options) {
    const value = await option.getAttribute("value");
    if (value) codes.push(value);
  }

  return codes;
}

function isoDateDaysAgo(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function configuredBranchCode() {
  return process.env.PLAYWRIGHT_DAILY_INCOME_BRANCH?.trim() || null;
}

/** Pin branch via PLAYWRIGHT_DAILY_INCOME_BRANCH, or all loaded branches when unset. */
export function configuredDailyIncomeBranch() {
  return configuredBranchCode();
}

export function logDailyIncomeBranchPlan(branchCodes: string[]) {
  const configured = configuredBranchCode();
  if (configured) {
    console.log(`Running test for one branch: ${configured}`);
    return;
  }

  if (branchCodes.length === 0) {
    console.log("Running test for all branches: (none loaded from Daily Income)");
    return;
  }

  console.log(`Running test for all branches: ${branchCodes.join(", ")}`);
}

/** Per-branch progress line — skipped when a single branch is pinned via env. */
export function logRunningTestForBranch(branchCode: string, branchCodes: string[] = []) {
  const configured = configuredBranchCode();
  if (configured) {
    return;
  }

  const index = branchCodes.indexOf(branchCode);
  const progress = index >= 0 && branchCodes.length > 1 ? ` (${index + 1}/${branchCodes.length})` : "";
  console.log(`Running test for ${branchCode} branch${progress}`);
}

export async function listDailyIncomeBranchCodes(main: Locator) {
  return getBranchCodes(main);
}

export async function resolveDailyIncomeBranchesForTest(main: Locator) {
  const configured = configuredBranchCode();
  if (configured) return [configured];
  return listDailyIncomeBranchCodes(main);
}

function configuredInvoiceNumber() {
  return process.env.PLAYWRIGHT_DAILY_INCOME_INVOICE_NUMBER?.trim() || null;
}

/** Optional override for debugging only — the test normally picks today, then recent days. */
function configuredCloseoutDateOverride() {
  return process.env.PLAYWRIGHT_DAILY_INCOME_DATE?.trim() || null;
}

function isIncomeStatementFetch(response: Response) {
  const method = response.request().method();
  const url = response.url();
  if (!url.includes("/income-statements")) return false;
  if (url.includes("/income-statements/search")) return method === "POST";
  if (/\/income-statements\/\d+/.test(url)) return method === "GET";
  return method === "GET" && url.includes("/income-statements?");
}

async function waitForIncomeStatementFetch(page: Page) {
  return page.waitForResponse(
    (response) => isIncomeStatementFetch(response),
    { timeout: 30_000 },
  );
}

async function logIncomeStatementResponse(response: Response, context: string) {
  const postData = response.request().postData();
  if (postData) {
    console.log(`[playwright:api] income-statements request body (${context}): ${postData}`);
  }
  await logApiResponse(response, `income-statements (${context})`);
}

async function waitForCloseoutBadge(main: Locator) {
  await expect(main.getByText(/No closeout for this date|(?:OPEN|CLOSED) · #/)).toBeVisible({
    timeout: 15_000,
  });
}

function isoDateOffset(isoDate: string, dayOffset: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayOffset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Re-fetch the closeout for the current branch/date (e.g. after HTTP 409 "already exists"). */
async function refreshDailyIncomeStatement(page: Page, main: Locator) {
  const date = await main.locator("#daily-date").inputValue();
  if (!date) return false;

  const neighborDate = isoDateOffset(date, -1);
  console.log(
    `[playwright:daily-income] Refreshing closeout state (${neighborDate} → ${date}) after duplicate create.`,
  );

  if (!(await setDailyIncomeDate(page, main, neighborDate))) {
    return false;
  }

  return setDailyIncomeDate(page, main, date);
}

async function responseIndicatesExistingCloseout(response: Response) {
  if (response.status() !== 409) return false;

  try {
    const body = await response.text();
    return body.includes("income statement already exists");
  } catch {
    return false;
  }
}

async function setDailyIncomeDate(page: Page, main: Locator, isoDate: string): Promise<boolean> {
  try {
    const dateInput = main.locator("#daily-date");
    const currentDate = await dateInput.inputValue();
    if (currentDate === isoDate) {
      await waitForCloseoutBadge(main);
      if (await main.getByText("No closeout for this date").isVisible()) {
        return refreshDailyIncomeStatement(page, main);
      }
      return true;
    }

    const fetchPromise = waitForIncomeStatementFetch(page);
    await dateInput.fill(isoDate);
    await dateInput.blur();
    const fetchResponse = await fetchPromise;
    if (!fetchResponse.ok()) {
      await logIncomeStatementResponse(fetchResponse, `date=${isoDate}`);
      return false;
    }
    await waitForCloseoutBadge(main);
    return true;
  } catch (error) {
    console.log(`[playwright:daily-income] setDailyIncomeDate(${isoDate}) failed:`, error);
    return false;
  }
}

async function selectBranchAndWait(page: Page, main: Locator, branchCode: string): Promise<boolean> {
  try {
    const currentBranch = await main.locator("#daily-branch").inputValue();
    if (currentBranch === branchCode) {
      await waitForCloseoutBadge(main);
      return true;
    }

    const fetchPromise = waitForIncomeStatementFetch(page);
    await main.locator("#daily-branch").selectOption(branchCode);
    const fetchResponse = await fetchPromise;
    if (!fetchResponse.ok()) {
      await logIncomeStatementResponse(fetchResponse, `branch=${branchCode}`);
      return false;
    }
    await logIncomeStatementResponse(fetchResponse, `branch=${branchCode}`);
    await waitForCloseoutBadge(main);
    return true;
  } catch (error) {
    console.log(`[playwright:daily-income] selectBranchAndWait(${branchCode}) failed:`, error);
    return false;
  }
}

async function selectBranchInCreateDialog(dialog: Locator, branchCode: string | null) {
  const branchSelect = dialog.locator("#statement-branch");
  if (branchCode) {
    const option = branchSelect.locator("option").filter({ hasText: new RegExp(`^${branchCode}\\s*—`) });
    if (await option.count()) {
      const value = await option.first().getAttribute("value");
      if (value) {
        await branchSelect.selectOption(value);
        return;
      }
    }
  }

  if (!(await branchSelect.inputValue())) {
    await selectFirstRealOption(branchSelect, "branch");
  }
}

async function tryCreateCloseout(page: Page, main: Locator): Promise<CloseoutAttemptResult> {
  if (!(await main.getByText("No closeout for this date").isVisible())) {
    return { ok: false };
  }

  const branchCode = await main.locator("#daily-branch").inputValue();
  const date = await main.locator("#daily-date").inputValue();
  console.log(
    `[playwright:daily-income] No closeout for branch=${branchCode || "(none)"} date=${date}; creating daily income.`,
  );

  await main.getByRole("button", { name: "Create closeout" }).click();
  const dialog = page.getByRole("dialog", { name: "Create daily income" });
  await expect(dialog).toBeVisible();

  await selectBranchInCreateDialog(dialog, branchCode || null);

  const statementDate = dialog.locator("#statement-date");
  if ((await statementDate.inputValue()) !== date) {
    await statementDate.fill(date);
  }

  const createResponse = waitForApiResponse(page, "/income-statements", "POST", { requireOk: false });
  await dialog.getByRole("button", { name: "Save daily income" }).click();
  const created = await createResponse;

  if (!created.ok()) {
    const alreadyExists = await responseIndicatesExistingCloseout(created);
    await logApiResponse(created, alreadyExists ? "create income-statement conflict (already exists)" : "create income-statement failed", {
      includeCurl: !alreadyExists,
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    if (alreadyExists) {
      console.log(
        "[playwright:daily-income] Closeout already exists for this branch/date — loading it instead of creating.",
      );
      return ensureCloseoutVisibleAfterExisting(page, main);
    }

    return { ok: false, createStatus: created.status() };
  }

  await expect(page.getByText("Daily income created.")).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 15_000 });
  console.log(`[playwright:daily-income] Created OPEN closeout for branch=${branchCode} date=${date}.`);
  return { ok: true };
}

async function tryReopenCloseout(page: Page, main: Locator): Promise<CloseoutAttemptResult> {
  const reopenButton = main.getByRole("button", { name: "Reopen day" });
  if (!(await reopenButton.isVisible())) {
    return { ok: false };
  }

  const date = await main.locator("#daily-date").inputValue();
  console.log(`[playwright:daily-income] Closeout is CLOSED for date=${date}; reopening.`);

  const reopenResponse = waitForApiResponse(page, "/income-statements/", "POST", { requireOk: false });
  await reopenButton.click();
  const reopened = await reopenResponse;

  if (!reopened.ok()) {
    await logApiResponse(reopened, "reopen income-statement failed");
    return { ok: false, reopenStatus: reopened.status() };
  }

  await expect(page.getByText("Daily income opened.")).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 15_000 });
  return { ok: true };
}

async function tryEnsureOpenOnCurrentDate(page: Page, main: Locator): Promise<CloseoutAttemptResult> {
  await waitForCloseoutBadge(main);

  try {
    await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 8_000 });
    return { ok: true };
  } catch {
    // Not open yet — reopen or create below.
  }

  const reopened = await tryReopenCloseout(page, main);
  if (reopened.ok) return reopened;

  return tryCreateCloseout(page, main);
}

async function ensureCloseoutVisibleAfterExisting(page: Page, main: Locator): Promise<CloseoutAttemptResult> {
  if (await refreshDailyIncomeStatement(page, main)) {
    try {
      await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 8_000 });
      return { ok: true };
    } catch {
      return tryReopenCloseout(page, main);
    }
  }

  return { ok: false };
}

function buildDatesToTry() {
  const defaults = Array.from({ length: 15 }, (_, offset) => isoDateDaysAgo(offset));
  const override = configuredCloseoutDateOverride();
  if (!override) return defaults;

  return [override, ...defaults.filter((date) => date !== override)];
}

async function getBranchCodesToTry(main: Locator) {
  const configured = configuredBranchCode();
  if (configured) return [configured];

  return getBranchCodes(main);
}

async function ensureOpenDailyCloseoutOnBranch(
  page: Page,
  main: Locator,
  branchCode: string,
  dates: string[],
  branchCodes: string[] = [],
  logBranch = true,
) {
  if (logBranch) {
    logRunningTestForBranch(branchCode, branchCodes);
  }

  if (!(await selectBranchAndWait(page, main, branchCode))) {
    return { ok: false as const };
  }

  let lastCreateStatus: number | undefined;
  let lastReopenStatus: number | undefined;
  let sawForbiddenMessage = false;

  for (const isoDate of dates) {
    if (!(await setDailyIncomeDate(page, main, isoDate))) {
      continue;
    }

    const result = await tryEnsureOpenOnCurrentDate(page, main);
    if (result.ok) {
      const branch = await main.locator("#daily-branch").inputValue();
      const date = await main.locator("#daily-date").inputValue();
      console.log(`[playwright:daily-income] OPEN closeout ready (branch=${branch}, date=${date}).`);
      return { ok: true as const };
    }

    if (result.createStatus) {
      lastCreateStatus = result.createStatus;
      if (result.createStatus === 403) {
        sawForbiddenMessage = true;
        break;
      }
    }
    if (result.reopenStatus) lastReopenStatus = result.reopenStatus;
    if (await main.getByText(/This action is forbidden/i).isVisible()) {
      sawForbiddenMessage = true;
    }
  }

  return {
    ok: false as const,
    lastCreateStatus,
    lastReopenStatus,
    sawForbiddenMessage,
  };
}

/**
 * Ensures an OPEN daily closeout exists for the configured branch (or all branches).
 * Picks the date automatically: today first, then walks back up to 14 days.
 * Creates or reopens a closeout when the page shows "No closeout for this date" or CLOSED.
 */
export async function ensureOpenDailyCloseout(page: Page, main: Locator) {
  await expect(main.locator("#daily-branch")).not.toHaveValue("", { timeout: 30_000 });

  const configuredBranch = configuredBranchCode();
  const branchCodes = await getBranchCodesToTry(main);
  const dates = buildDatesToTry();
  let lastCreateStatus: number | undefined;
  let lastReopenStatus: number | undefined;
  let sawForbiddenMessage = false;

  logDailyIncomeBranchPlan(branchCodes);
  console.log(
    `[playwright:daily-income] Looking for OPEN closeout (dates=${dates[0]} … ${dates.at(-1)}).`,
  );

  for (const branchCode of branchCodes) {
    const result = await ensureOpenDailyCloseoutOnBranch(
      page,
      main,
      branchCode,
      dates,
      branchCodes,
      !configuredBranch,
    );
    if (result.ok) {
      return;
    }

    if (result.lastCreateStatus) {
      lastCreateStatus = result.lastCreateStatus;
      if (result.lastCreateStatus === 403) {
        sawForbiddenMessage = true;
      }
    }
    if (result.lastReopenStatus) lastReopenStatus = result.lastReopenStatus;
    if (result.sawForbiddenMessage) sawForbiddenMessage = true;
  }

  const hints = ["Unable to find or open an OPEN daily closeout after trying create/reopen."];

  if (configuredBranch) {
    hints.push(`Branch: PLAYWRIGHT_DAILY_INCOME_BRANCH=${configuredBranch}.`);
  } else {
    hints.push("Set PLAYWRIGHT_DAILY_INCOME_BRANCH in .env.local to pin a branch (recommended).");
  }

  hints.push(
    `Dates tried (newest first): ${dates.slice(0, 5).join(", ")}${dates.length > 5 ? ", …" : ""}.`,
    "The test creates a closeout when the page shows “No closeout for this date”, or reopens a CLOSED one.",
    "Grant the Playwright test user permission to create/reopen daily income closeouts if create/reopen returned HTTP 403.",
    "See PLAYWRIGHT.md — Register invoice transaction test.",
  );

  if (lastCreateStatus) hints.push(`Last create closeout response: HTTP ${lastCreateStatus}.`);
  if (lastReopenStatus) hints.push(`Last reopen closeout response: HTTP ${lastReopenStatus}.`);
  if (sawForbiddenMessage) {
    hints.push('The page showed "This action is forbidden".');
  }

  throw new Error(hints.join(" "));
}

/** Ensures an OPEN closeout on one branch (logs "Running test for … branch" unless logBranch is false). */
export async function ensureOpenDailyCloseoutForBranch(
  page: Page,
  main: Locator,
  branchCode: string,
  branchCodes: string[] = [branchCode],
  logBranch = true,
) {
  await expect(main.locator("#daily-branch")).not.toHaveValue("", { timeout: 30_000 });
  const result = await ensureOpenDailyCloseoutOnBranch(
    page,
    main,
    branchCode,
    buildDatesToTry(),
    branchCodes,
    logBranch,
  );
  if (result.ok) return;

  throw new Error(
    `Unable to find or open an OPEN daily closeout for branch ${branchCode}.` +
      (result.lastCreateStatus ? ` Last create response: HTTP ${result.lastCreateStatus}.` : ""),
  );
}

type RegisterInvoiceTransactionOptions = {
  amount: string;
  cost?: string;
  invoiceNumber?: string;
  refNumber?: string;
  description?: string;
};

/** Wait until the closeout badge and transaction list have finished loading. */
export async function waitForCloseoutTransactionsReady(main: Locator) {
  await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText("Loading transactions")).toHaveCount(0, { timeout: 30_000 });
}

/** Step 2 of the add-transaction wizard for INITIAL-PAYMENT (Register invoice). */
export async function fillRegisterInvoiceTransactionForm(
  dialog: Locator,
  options: RegisterInvoiceTransactionOptions,
) {
  await selectFirstRealOption(dialog.locator("#journal-employee"), "employee");

  const invoiceNumber =
    options.invoiceNumber ??
    configuredInvoiceNumber() ??
    `PW-INV-${Date.now()}`;
  await dialog.locator("#journal-invoice-number").fill(invoiceNumber);
  await dialog.locator("#journal-invoice-cost").fill(options.cost ?? options.amount ?? "1.00");
  await dialog.locator("#journal-amount").fill(options.amount ?? "1.00");
  await dialog.locator("#journal-payment").selectOption({ label: "CASH" });

  await expect(dialog.locator("#journal-employee")).not.toHaveValue("");
  await expect(dialog.locator("#journal-invoice-number")).toHaveValue(invoiceNumber);
  await expect(dialog.locator("#journal-invoice-cost")).not.toHaveValue("");
  await expect(dialog.locator("#journal-payment")).not.toHaveValue("");

  if (options.refNumber) {
    await dialog.locator("#journal-reference").fill(options.refNumber);
  }

  if (options.description) {
    await dialog.locator("#journal-description").fill(options.description);
  }

  const costValue = Number.parseFloat(options.cost ?? options.amount ?? "1.00");
  const amountValue = Number.parseFloat(options.amount ?? "1.00");
  if (Number.isFinite(costValue) && Number.isFinite(amountValue)) {
    const balanceLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(costValue - amountValue);
    await expect(dialog.locator("#journal-invoice-balance")).toHaveValue(balanceLabel);
  }
}

export async function expectRegisterInvoiceSuccessToast(page: Page, invoiceNumber: string) {
  await expect(
    page.getByText(`New invoice #${invoiceNumber} created and payment registered.`),
  ).toBeVisible({ timeout: 15_000 });
}

/** After a successful save, the wizard stays open with employee retained and invoice fields cleared. */
export async function expectRegisterInvoiceWizardReadyForNextEntry(dialog: Locator) {
  await expect(dialog.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  await expect(dialog.locator("#journal-employee")).not.toHaveValue("");
  await expect(dialog.locator("#journal-invoice-number")).toHaveValue("");
  await expect(dialog.locator("#journal-invoice-cost")).not.toHaveValue("15.00");
  await expect(dialog.locator("#journal-amount")).not.toHaveValue("10.00");
}

/**
 * Submit register-invoice and retry with other invoices when the API returns HTTP 403
 * (common when the first dropdown invoice is already registered or not eligible).
 */
export async function saveRegisterInvoiceTransaction(
  page: Page,
  dialog: Locator,
  options: RegisterInvoiceTransactionOptions & { maxAttempts?: number },
) {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastStatus = 0;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const invoiceNumber =
      options.invoiceNumber ??
      configuredInvoiceNumber() ??
      `PW-INV-${Date.now()}-${attempt}`;

    await fillRegisterInvoiceTransactionForm(dialog, { ...options, invoiceNumber });

    const createResponse = waitForApiResponse(page, "/journals", "POST", { requireOk: false });
    await dialog.getByRole("button", { name: "Save transaction" }).click();
    const response = await createResponse;
    lastStatus = response.status();
    lastResponse = response;

    if (response.ok()) {
      console.log(`[playwright:daily-income] Journal created with invoice number=${invoiceNumber}.`);
      return response;
    }

    await logApiResponse(response, `create journal failed (invoice ${invoiceNumber})`);

    if (response.status() !== 403) {
      throw new Error(`Create transaction failed with HTTP ${response.status()}.`);
    }

    await expect(dialog.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  }

  if (lastResponse && lastStatus === 403) {
    return lastResponse;
  }

  throw new Error(`Create transaction failed with HTTP ${lastStatus} after ${maxAttempts} invoice attempts.`);
}

export type DailyIncomeTransactionSpec = {
  /** Short id for --grep, e.g. register-invoice */
  slug: string;
  /** Radio label in the Add transaction wizard */
  label: string;
  /** Section heading after selecting the type */
  sectionTitle: string;
  /** Register invoice — new invoice number text field */
  needsRegisterInvoice?: boolean;
  /** Existing invoice dropdown (payment, discount, surcharge) */
  needsInvoice?: boolean;
  needsAccount?: boolean;
  needsSourceAccount?: boolean;
  needsPaymentMethod?: boolean;
};

/** One entry per journal transaction type — slug appears in test titles for independent runs. */
export const DAILY_INCOME_TRANSACTION_SPECS: DailyIncomeTransactionSpec[] = [
  {
    slug: "register-invoice",
    label: "Register invoice",
    sectionTitle: "Invoice information",
    needsRegisterInvoice: true,
    needsPaymentMethod: true,
  },
  {
    slug: "register-payment",
    label: "Register payment",
    sectionTitle: "Payment information",
    needsInvoice: true,
    needsPaymentMethod: true,
  },
  {
    slug: "register-expense",
    label: "Register expense",
    sectionTitle: "Expense information",
    needsAccount: true,
    needsSourceAccount: true,
  },
  {
    slug: "register-income",
    label: "Register income",
    sectionTitle: "Income information",
    needsAccount: true,
    needsPaymentMethod: true,
  },
  {
    slug: "apply-discount",
    label: "Apply discount",
    sectionTitle: "Discount information",
    needsInvoice: true,
    needsPaymentMethod: true,
  },
  {
    slug: "apply-surcharge",
    label: "Apply surcharge",
    sectionTitle: "Surcharge information",
    needsInvoice: true,
    needsPaymentMethod: true,
  },
  {
    slug: "transfer-account",
    label: "Transfer account",
    sectionTitle: "Transfer information",
    needsAccount: true,
    needsSourceAccount: true,
  },
  {
    slug: "register-loan",
    label: "Register loan",
    sectionTitle: "Loan information",
    needsAccount: true,
    needsSourceAccount: true,
  },
];

export async function prepareDailyIncomeCloseout(page: Page, main: Locator) {
  const branchCodes = await resolveDailyIncomeBranchesForTest(main);
  logDailyIncomeBranchPlan(branchCodes);

  const branchCode = branchCodes[0];
  logRunningTestForBranch(branchCode, branchCodes);

  await ensureOpenDailyCloseoutForBranch(page, main, branchCode, branchCodes, false);
  await waitForCloseoutTransactionsReady(main);

  return { branchCode, branchCodes };
}

export async function openRegisterInvoiceTransactionWizard(page: Page, main: Locator) {
  return openTransactionTypeWizard(page, main, DAILY_INCOME_TRANSACTION_SPECS[0]);
}

export async function openRegisterPaymentTransactionWizard(page: Page, main: Locator) {
  return openTransactionTypeWizard(page, main, DAILY_INCOME_TRANSACTION_SPECS[1]);
}

export async function openTransactionTypeWizard(page: Page, main: Locator, spec: DailyIncomeTransactionSpec) {
  return openAddTransactionWizard(page, main, spec.label, spec.sectionTitle, spec);
}

export async function openAddTransactionWizard(
  page: Page,
  main: Locator,
  transactionLabel: string,
  sectionTitle: string,
  spec?: Pick<DailyIncomeTransactionSpec, "needsRegisterInvoice" | "needsInvoice" | "needsAccount">,
) {
  await expect(main.getByRole("button", { name: "Add transaction" })).toBeEnabled({ timeout: 15_000 });
  await main.getByRole("button", { name: "Add transaction" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  await dialog.getByRole("radio", { name: transactionLabel }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText(sectionTitle)).toBeVisible();

  await expect(async () => {
    const employeeCount = await dialog.locator("#journal-employee option").count();
    expect(employeeCount, "employee dropdown options").toBeGreaterThan(1);

    if (spec?.needsRegisterInvoice) {
      await expect(dialog.locator("#journal-invoice-number")).toBeVisible();
      await expect(dialog.locator("#journal-invoice-cost")).toBeVisible();
    }

    if (spec?.needsInvoice) {
      const invoiceCount = await dialog.locator("#journal-invoice option").count();
      expect(invoiceCount, "invoice dropdown options").toBeGreaterThan(1);
    }

    if (spec?.needsAccount) {
      const accountCount = await dialog.locator("#journal-account option").count();
      expect(accountCount, "account dropdown options").toBeGreaterThan(1);
    }
  }).toPass({ timeout: 30_000 });

  return dialog;
}

type TransactionFormOptions = {
  amount?: string;
  cost?: string;
  invoiceNumber?: string;
  refNumber?: string;
  description?: string;
  invoiceOptionIndex?: number;
};

async function selectFirstAccountOption(select: Locator, fieldName: string) {
  const optionCount = await select.locator("option").count();
  if (optionCount <= 1) {
    throw new Error(
      `No ${fieldName} options loaded — GET /chart-accounts may be unavailable in this environment.`,
    );
  }

  await selectFirstRealOption(select, fieldName);
}

export async function fillTransactionForm(dialog: Locator, spec: DailyIncomeTransactionSpec, options: TransactionFormOptions = {}) {
  const amount = options.amount ?? "1.00";

  if (spec.needsRegisterInvoice) {
    await fillRegisterInvoiceTransactionForm(dialog, {
      amount,
      cost: options.cost ?? amount,
      invoiceNumber: options.invoiceNumber,
      refNumber: options.refNumber,
      description: options.description,
    });
    return;
  }

  await selectFirstRealOption(dialog.locator("#journal-employee"), "employee");
  await dialog.locator("#journal-amount").fill(amount);

  if (spec.needsInvoice) {
    const invoiceSelect = dialog.locator("#journal-invoice");
    const configuredInvoice = configuredInvoiceNumber();

    if (configuredInvoice) {
      const option = invoiceSelect.locator("option").filter({ hasText: configuredInvoice });
      await expect(option.first()).toBeAttached({ timeout: 30_000 });
      const invoiceValue = await option.first().getAttribute("value");
      if (!invoiceValue) {
        throw new Error(`Invoice option not found for PLAYWRIGHT_DAILY_INCOME_INVOICE_NUMBER=${configuredInvoice}.`);
      }
      await invoiceSelect.selectOption(invoiceValue);
    } else {
      const invoiceIndex = options.invoiceOptionIndex ?? 1;
      await expect(invoiceSelect.locator("option").nth(invoiceIndex)).toBeAttached({ timeout: 30_000 });
      const invoiceValue = await invoiceSelect.locator("option").nth(invoiceIndex).getAttribute("value");
      if (!invoiceValue) {
        throw new Error(`Expected invoice option at index ${invoiceIndex}.`);
      }
      await invoiceSelect.selectOption(invoiceValue);
    }
  }

  if (spec.needsAccount) {
    await selectFirstAccountOption(dialog.locator("#journal-account"), "account");
  }

  if (spec.needsSourceAccount) {
    await selectFirstAccountOption(dialog.locator("#journal-source"), "source account");
  }

  if (spec.needsPaymentMethod) {
    await dialog.locator("#journal-payment").selectOption({ label: "CASH" });
  }

  await expect(dialog.locator("#journal-employee")).not.toHaveValue("");

  if (spec.needsInvoice) {
    await expect(dialog.locator("#journal-invoice")).not.toHaveValue("");
  }

  if (spec.needsAccount) {
    await expect(dialog.locator("#journal-account")).not.toHaveValue("");
  }

  if (spec.needsSourceAccount) {
    await expect(dialog.locator("#journal-source")).not.toHaveValue("");
  }

  if (spec.needsPaymentMethod) {
    await expect(dialog.locator("#journal-payment")).not.toHaveValue("");
  }

  if (options.refNumber) {
    await dialog.locator("#journal-reference").fill(options.refNumber);
  }

  if (options.description) {
    await dialog.locator("#journal-description").fill(options.description);
  }
}

export async function saveJournalTransaction(
  page: Page,
  dialog: Locator,
  spec: DailyIncomeTransactionSpec,
  options: TransactionFormOptions & {
    maxInvoiceAttempts?: number;
    testInfo?: TestInfo;
  } = {},
) {
  if (spec.needsRegisterInvoice) {
    return saveRegisterInvoiceTransaction(page, dialog, {
      amount: options.amount ?? "1.00",
      cost: options.cost ?? options.amount ?? "1.00",
      invoiceNumber: options.invoiceNumber,
      refNumber: options.refNumber,
      description: options.description,
      maxAttempts: options.maxInvoiceAttempts,
    });
  }

  if (spec.needsInvoice) {
    return saveInvoiceJournalTransaction(page, dialog, spec, options);
  }

  await fillTransactionForm(dialog, spec, options);

  const createResponse = waitForApiResponse(page, "/journals", "POST", { requireOk: false });
  await dialog.getByRole("button", { name: "Save transaction" }).click();
  const response = await createResponse;

  if (!response.ok()) {
    await logApiResponse(response, `${spec.slug} journal`, { includeCurl: true });
    if (options.testInfo) {
      await attachApiCurlToTest(options.testInfo, response, spec.slug);
    }
  }

  return response;
}

async function saveInvoiceJournalTransaction(
  page: Page,
  dialog: Locator,
  spec: DailyIncomeTransactionSpec,
  options: TransactionFormOptions & {
    maxInvoiceAttempts?: number;
    testInfo?: TestInfo;
  },
) {
  const maxAttempts = options.maxInvoiceAttempts ?? (configuredInvoiceNumber() ? 1 : 5);
  const invoiceSelect = dialog.locator("#journal-invoice");
  const optionCount = await invoiceSelect.locator("option").count();
  const startIndex = options.invoiceOptionIndex ?? 1;
  const endIndex = Math.min(optionCount, startIndex + maxAttempts - 1);

  if (endIndex < startIndex) {
    throw new Error(`No invoice options loaded for ${spec.slug} transaction.`);
  }

  let lastStatus = 0;
  let lastResponse: Response | null = null;

  for (let invoiceIndex = startIndex; invoiceIndex <= endIndex; invoiceIndex += 1) {
    await fillTransactionForm(dialog, spec, { ...options, invoiceOptionIndex: invoiceIndex });

    const createResponse = waitForApiResponse(page, "/journals", "POST", { requireOk: false });
    await dialog.getByRole("button", { name: "Save transaction" }).click();
    const response = await createResponse;
    lastStatus = response.status();
    lastResponse = response;

    if (response.ok()) {
      const invoiceValue = await invoiceSelect.inputValue();
      console.log(
        `[playwright:daily-income] ${spec.slug} journal created with invoice index=${invoiceIndex} id=${invoiceValue}.`,
      );
      return response;
    }

    await logApiResponse(response, `${spec.slug} journal failed (invoice index ${invoiceIndex})`, {
      includeCurl: true,
    });

    if (options.testInfo) {
      await attachApiCurlToTest(options.testInfo, response, `${spec.slug}-invoice-${invoiceIndex}`);
    }

    if (response.status() !== 403) {
      throw new Error(`${spec.slug} transaction failed with HTTP ${response.status()}.`);
    }

    await expect(dialog.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  }

  if (lastResponse && lastStatus === 403) {
    return lastResponse;
  }

  throw new Error(
    `${spec.slug} transaction failed with HTTP ${lastStatus} after trying invoice options ${startIndex}–${endIndex}.`,
  );
}
