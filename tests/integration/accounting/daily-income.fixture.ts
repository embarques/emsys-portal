import { expect, type Locator, type Page, type Response, type TestInfo } from "@playwright/test";

import { attachApiCurlToTest, logApiResponse, waitForApiResponse } from "../workspace.fixture";

async function selectSearchableOption(page: Page, trigger: Locator, label: string) {
  await trigger.click();
  const option = page.locator("[cmdk-item]").filter({ hasText: label }).first();
  await expect(option).toBeAttached({ timeout: 30_000 });
  await option.click();
}

async function selectFirstSearchableOption(page: Page, trigger: Locator, fieldName: string) {
  await trigger.click();
  const firstOption = page.locator("[cmdk-item]").first();
  await expect(firstOption).toBeAttached({ timeout: 30_000 });
  const optionCount = await page.locator("[cmdk-item]").count();
  if (optionCount === 0) {
    throw new Error(`No ${fieldName} options loaded.`);
  }
  await firstOption.click();
}

async function selectFirstTransactionAssignee(page: Page, dialog: Locator) {
  const field = dialog.locator("#journal-employee");
  await field.click();
  const firstOption = page.locator("[cmdk-item]").first();
  await expect(firstOption).toBeAttached({ timeout: 30_000 });
  const optionCount = await page.locator("[cmdk-item]").count();
  if (optionCount === 0) {
    throw new Error(
      "No employee or employee group options loaded. Ensure the API returns at least one employee or employee group.",
    );
  }
  await firstOption.click();
  await expect(field).not.toHaveValue("");
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
  await expect(main.getByText(/No closeout for this date|(?:Active|Inactive) · #/)).toBeVisible({
    timeout: 15_000,
  });
}

async function setDailyIncomeDate(page: Page, main: Locator, isoDate: string): Promise<boolean> {
  try {
    const dateInput = main.locator("#daily-date");
    const currentDate = await dateInput.inputValue();
    if (currentDate === isoDate) {
      await waitForCloseoutBadge(main);
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

/** Fixtures consume periods prepared by the non-production CLI; never create or reopen them. */
export async function ensureOpenDailyCloseout(page: Page, main: Locator) {
  const branches = await resolveDailyIncomeBranchesForTest(main);
  logDailyIncomeBranchPlan(branches);
  for (const branch of branches) {
    if (!(await selectBranchAndWait(page, main, branch))) continue;
    const date = configuredCloseoutDateOverride() ?? isoDateDaysAgo(0);
    if (!(await setDailyIncomeDate(page, main, date))) continue;
    if (await main.getByRole("button", { name: "Add transaction", exact: true }).isEnabled().catch(() => false)) return;
  }
  throw new Error("No current active closeout. Run daily-income end-of-day in the approved test environment and set PLAYWRIGHT_DAILY_INCOME_DATE to its branch-local business date.");
}

export async function ensureOpenDailyCloseoutForBranch(
  page: Page,
  main: Locator,
  branchCode: string,
  branchCodes: string[] = [branchCode],
  logBranch = true,
) {
  if (logBranch) logRunningTestForBranch(branchCode, branchCodes);
  const date = configuredCloseoutDateOverride() ?? isoDateDaysAgo(0);
  if (!(await selectBranchAndWait(page, main, branchCode)) || !(await setDailyIncomeDate(page, main, date))) {
    throw new Error(`Unable to load closeout for ${branchCode} on ${date}.`);
  }
  await expect(main.getByRole("button", { name: "Add transaction", exact: true }),
    "Prepare the current branch-local period with the test environment CLI before running payment tests.").toBeEnabled();
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
  await expect(main.getByText(/^Active · #/)).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText("Loading transactions")).toHaveCount(0, { timeout: 30_000 });
}

/** Step 2 of the add-transaction wizard for INITIAL-PAYMENT (Register invoice). */
export async function fillRegisterInvoiceTransactionForm(
  page: Page,
  dialog: Locator,
  options: RegisterInvoiceTransactionOptions,
) {
  await selectFirstTransactionAssignee(page, dialog);
  await selectSearchableOption(page, dialog.locator("#journal-payment"), "CASH");

  const invoiceNumber =
    options.invoiceNumber ??
    configuredInvoiceNumber() ??
    `PW-INV-${Date.now()}`;
  await dialog.locator("#journal-invoice-number").fill(invoiceNumber);
  await dialog.locator("#journal-invoice-cost").fill(options.cost ?? options.amount ?? "1.00");
  await dialog.locator("#journal-amount").fill(options.amount ?? "1.00");

  await expect(dialog.locator("#journal-employee")).not.toHaveValue("");
  await expect(dialog.locator("#journal-invoice-number")).toHaveValue(invoiceNumber);
  await expect(dialog.locator("#journal-invoice-cost")).not.toHaveValue("");
  await expect(dialog.locator("#journal-payment")).not.toHaveValue("");

  if (options.refNumber) {
    await selectSearchableOption(page, dialog.locator("#journal-reference-mode"), "Enter your own");
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

/** After a successful save, the wizard stays open with employee and payment method retained. */
export async function expectRegisterInvoiceWizardReadyForNextEntry(page: Page, wizard: Locator) {
  await expect(page.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  await expect(wizard.locator("#journal-employee")).not.toHaveValue("");
  await expect(wizard.locator("#journal-payment")).not.toHaveValue("");
  await expect(wizard.locator("#journal-invoice-number")).toHaveValue("");
  await expect(wizard.locator("#journal-invoice-cost")).not.toHaveValue("15.00");
  await expect(wizard.locator("#journal-amount")).not.toHaveValue("10.00");
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

    await fillRegisterInvoiceTransactionForm(page, dialog, { ...options, invoiceNumber });

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

    await expect(page.getByRole("heading", { name: "Add transaction" })).toBeVisible();
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
  },
  {
    slug: "transfer-account",
    label: "Transfer account",
    sectionTitle: "Transfer information",
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

export async function resolveTransactionWizardSurface(page: Page) {
  const dialog = page.getByRole("dialog").filter({ has: page.getByTestId("transaction-wizard") });
  if ((await dialog.count()) > 0) {
    return dialog.first();
  }

  const tabWizard = page.getByTestId("transaction-wizard");
  await expect(tabWizard).toBeVisible({ timeout: 15_000 });
  return tabWizard;
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

  const wizard = await resolveTransactionWizardSurface(page);
  await expect(page.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  await wizard.getByRole("radio", { name: transactionLabel }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await expect(wizard.getByText(sectionTitle)).toBeVisible();

  await expect(async () => {
    await wizard.locator("#journal-employee").click();
    const assigneeCount = await page.locator("[cmdk-item]").count();
    expect(assigneeCount, "employee or employee group options").toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    if (spec?.needsRegisterInvoice) {
      await expect(wizard.locator("#journal-invoice-number")).toBeVisible();
      await expect(wizard.locator("#journal-invoice-cost")).toBeVisible();
    }

    if (spec?.needsInvoice) {
      await expect(wizard.locator("#journal-invoice")).toBeVisible();
      await wizard.locator("#journal-invoice").click();
      const invoiceCount = await page.locator("[cmdk-item]").count();
      expect(invoiceCount, "invoice dropdown options").toBeGreaterThan(1);
      await page.keyboard.press("Escape");
    }

    if (spec?.needsAccount) {
      await expect(wizard.locator("#journal-account")).toBeVisible();
      await wizard.locator("#journal-account").click();
      const accountCount = await page.locator("[cmdk-item]").count();
      expect(accountCount, "account dropdown options").toBeGreaterThan(1);
      await page.keyboard.press("Escape");
    }
  }).toPass({ timeout: 30_000 });

  return wizard;
}

type TransactionFormOptions = {
  amount?: string;
  cost?: string;
  invoiceNumber?: string;
  refNumber?: string;
  description?: string;
  invoiceOptionIndex?: number;
};


export async function fillTransactionForm(
  page: Page,
  dialog: Locator,
  spec: DailyIncomeTransactionSpec,
  options: TransactionFormOptions = {},
) {
  const amount = options.amount ?? "1.00";

  if (spec.needsRegisterInvoice) {
    await fillRegisterInvoiceTransactionForm(page, dialog, {
      amount,
      cost: options.cost ?? amount,
      invoiceNumber: options.invoiceNumber,
      refNumber: options.refNumber,
      description: options.description,
    });
    return;
  }

  await selectFirstTransactionAssignee(page, dialog);
  await dialog.locator("#journal-amount").fill(amount);

  if (spec.needsInvoice) {
    const invoiceSelect = dialog.locator("#journal-invoice");
    const configuredInvoice = configuredInvoiceNumber();

    if (configuredInvoice) {
      await invoiceSelect.click();
      const option = page.locator("[cmdk-item]").filter({ hasText: configuredInvoice }).first();
      await expect(option).toBeAttached({ timeout: 30_000 });
      await option.click();
    } else {
      await selectFirstSearchableOption(page, invoiceSelect, "invoice");
    }
  }

  if (spec.needsAccount) {
    await selectFirstSearchableOption(page, dialog.locator("#journal-account"), "account");
  }

  if (spec.needsSourceAccount) {
    await selectFirstSearchableOption(page, dialog.locator("#journal-source"), "source account");
  }

  if (spec.needsPaymentMethod) {
    await selectSearchableOption(page, dialog.locator("#journal-payment"), "CASH");
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
    await selectSearchableOption(page, dialog.locator("#journal-reference-mode"), "Enter your own");
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

  await fillTransactionForm(page, dialog, spec, options);

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
    await fillTransactionForm(page, dialog, spec, { ...options, invoiceOptionIndex: invoiceIndex });

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

    await expect(page.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  }

  if (lastResponse && lastStatus === 403) {
    return lastResponse;
  }

  throw new Error(
    `${spec.slug} transaction failed with HTTP ${lastStatus} after trying invoice options ${startIndex}–${endIndex}.`,
  );
}
