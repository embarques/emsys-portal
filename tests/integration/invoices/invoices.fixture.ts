import { expect, type Locator, type Page, type Response } from "@playwright/test";

import { attachApiCurlToTest, logApiResponse, waitForApiResponse } from "../workspace.fixture";

const UNVERIFIED_SENDER_STEP_ERROR =
  "Verify the sender's address before saving. Open the sender and update it with a Google-suggested address.";

export type InvoiceCreateWizardOptions = {
  invoiceNumber?: string;
  description?: string;
  quantity?: string;
  unitPrice?: string;
};

function defaultInvoiceNumber() {
  return `PW-INV-${Date.now()}`;
}

function searchableSelectRoot(wizard: Locator, fieldId: string) {
  const label = wizard.locator(`label[for="${fieldId}"]`);

  if (fieldId === "senderId" || fieldId === "receiverId") {
    return label.locator('xpath=ancestor::div[contains(@class,"space-y-1")][1]');
  }

  return label.locator("xpath=..");
}

async function dismissOpenPopovers(page: Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

async function openSearchableSelect(wizard: Locator, fieldId: string) {
  const field = searchableSelectRoot(wizard, fieldId);
  await field.scrollIntoViewIfNeeded();
  await field.getByRole("button", { name: /Open options/i }).click();
}

function isPlaceholderOption(label: string) {
  const normalized = label.trim();
  if (!normalized) return true;
  if (/^Select /i.test(normalized)) return true;
  if (/^No (pickup|receiver|route)$/i.test(normalized)) return true;
  return false;
}

async function selectSearchableOptionByIndex(
  page: Page,
  wizard: Locator,
  fieldId: string,
  optionIndex: number,
  fieldName: string,
) {
  await page.keyboard.press("Escape");
  await openSearchableSelect(wizard, fieldId);

  const options = page.getByRole("option");
  await expect(options.first()).toBeAttached({ timeout: 30_000 });
  await expect
    .poll(async () => options.count(), { timeout: 30_000 })
    .toBeGreaterThan(1);

  let realIndex = 0;
  const count = await options.count();
  if (count === 0) {
    throw new Error(`No ${fieldName} options visible after opening ${fieldId}.`);
  }

  for (let i = 0; i < count; i += 1) {
    const option = options.nth(i);
    const label = ((await option.innerText()) ?? "").trim();
    if (!label || isPlaceholderOption(label)) continue;

    if (realIndex === optionIndex) {
      await option.click();
      await dismissOpenPopovers(page);
      return label.split(/\s{2,}/)[0] ?? label;
    }

    realIndex += 1;
  }

  throw new Error(`No ${fieldName} option at index ${optionIndex} (found ${realIndex} selectable option(s)).`);
}

async function selectFirstSearchableOption(
  page: Page,
  wizard: Locator,
  fieldId: string,
  fieldName: string,
) {
  return selectSearchableOptionByIndex(page, wizard, fieldId, 0, fieldName);
}

export async function openAddInvoiceWizard(page: Page, main: Locator) {
  await expect(main.getByRole("heading", { name: "Invoices" })).toBeVisible({ timeout: 30_000 });
  await main.getByRole("button", { name: "Add invoice" }).click();

  const wizard = page.getByTestId("invoice-form-wizard");
  await expect(wizard).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Add invoice" }).first()).toBeVisible();
  await expect(wizard.getByText("Step 1 of 5")).toBeVisible();

  return wizard;
}

export async function activateInvoicesDirectoryTab(page: Page) {
  const invoicesTab = page.locator("[data-tab-id]").filter({ hasText: "Invoices" }).first();
  await expect(invoicesTab).toBeVisible({ timeout: 15_000 });
  await invoicesTab.locator("button").first().click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({ timeout: 15_000 });
}

export async function fillInvoiceWizardStep1(
  page: Page,
  wizard: Locator,
  options: Pick<InvoiceCreateWizardOptions, "invoiceNumber"> = {},
) {
  const invoiceNumber = options.invoiceNumber ?? defaultInvoiceNumber();

  await wizard.locator("#invoiceNumber").fill(invoiceNumber);
  await expect(wizard.locator("#date")).not.toHaveValue("");
  await dismissOpenPopovers(page);
  await selectFirstSearchableOption(page, wizard, "containerId", "container");

  const nextButton = wizard.getByRole("button", { name: "Next" });
  await nextButton.scrollIntoViewIfNeeded();
  await nextButton.click();
  await expect(wizard.getByText("Step 2 of 5")).toBeVisible({ timeout: 10_000 });

  return invoiceNumber;
}

export async function fillInvoiceWizardStep2(page: Page, wizard: Locator) {
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await selectSearchableOptionByIndex(page, wizard, "senderId", attempt, "sender");
    await wizard.getByRole("button", { name: "Next" }).click();

    const stepError = wizard.getByText(UNVERIFIED_SENDER_STEP_ERROR);
    if (await stepError.isVisible().catch(() => false)) {
      continue;
    }

    await expect(wizard.getByText("Step 3 of 5")).toBeVisible({ timeout: 10_000 });
    return;
  }

  throw new Error(
    "Could not select a sender that passes validation. Verify a sender address in the app or set PLAYWRIGHT_INVOICE_SENDER in .env.local.",
  );
}

export async function fillInvoiceWizardStep3(
  wizard: Locator,
  options: Pick<InvoiceCreateWizardOptions, "description" | "quantity" | "unitPrice"> = {},
) {
  const description = options.description ?? "Playwright invoice integration test line item";
  const quantity = options.quantity ?? "1";
  const unitPrice = options.unitPrice ?? "10.00";

  const descriptionInput = wizard.locator('input[role="combobox"]').first();
  await descriptionInput.fill(description);

  const quantityInput = wizard.locator('input[id$="-quantity"]').first();
  await quantityInput.fill(quantity);

  const unitPriceInput = wizard.locator('input[id$="-unitPrice"]').first();
  await unitPriceInput.fill(unitPrice);

  await wizard.getByRole("button", { name: "Next" }).click();
  await expect(wizard.getByText("Step 4 of 5")).toBeVisible({ timeout: 10_000 });
}

export async function confirmInvoiceDailyIncomeRegistration(page: Page, wizard: Locator) {
  const foundBanner = wizard.getByText("Daily income entry found");

  if (!(await foundBanner.isVisible().catch(() => false))) {
    const registerButton = wizard.getByRole("button", { name: "Register daily income" });
    await expect(registerButton).toBeVisible({ timeout: 15_000 });
    await registerButton.click();

    const dialog = page.getByRole("dialog", { name: "Register daily income" });
    await expect(dialog).toBeVisible();
    await dialog.locator("#daily-income-payment-amount").fill("0");
    const createResponse = waitForApiResponse(page, "/journals", "POST", { requireOk: false });
    await dialog.getByRole("button", { name: "Register & continue" }).click();
    const response = await createResponse;
    expect(response.ok(), `Daily Income registration failed with HTTP ${response.status()}`).toBe(true);
  }

  await expect(foundBanner).toBeVisible({ timeout: 15_000 });
  const nextButton = wizard.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();
  await expect(wizard.getByText("Step 5 of 5")).toBeVisible({ timeout: 10_000 });
}

export async function saveInvoiceWizard(page: Page, wizard: Locator) {
  const saveButton = wizard.getByRole("button", { name: "Save invoice" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });

  const createResponse = waitForApiResponse(page, "/invoices", "POST", { requireOk: false });
  await saveButton.click();
  const response = await createResponse;

  if (!response.ok()) {
    await logApiResponse(response, "create invoice failed", { includeCurl: true });
  }

  return response;
}

export async function expectInvoiceCreateSuccessToast(page: Page, invoiceNumber: string) {
  await expect(page.getByText(`Invoice "${invoiceNumber}" was added.`)).toBeVisible({
    timeout: 15_000,
  });
}

export async function expectInvoiceWizardReadyForNextEntry(wizard: Locator) {
  await expect(wizard.getByText("Step 1 of 5")).toBeVisible({ timeout: 10_000 });
  await expect(wizard.locator("#invoiceNumber")).not.toHaveValue("");
}

export async function completeInvoiceCreateWizard(
  page: Page,
  wizard: Locator,
  options: InvoiceCreateWizardOptions = {},
) {
  const invoiceNumber = await fillInvoiceWizardStep1(page, wizard, options);
  await fillInvoiceWizardStep2(page, wizard);
  await fillInvoiceWizardStep3(wizard, options);
  await confirmInvoiceDailyIncomeRegistration(page, wizard);

  const response = await saveInvoiceWizard(page, wizard);

  return { invoiceNumber, response };
}

export async function searchInvoicesDirectory(main: Locator, query: string) {
  await main
    .getByPlaceholder("Search by invoice number, sender, receiver, or container…")
    .fill(query);
}

export async function attachInvoiceCreateCurl(
  testInfo: import("@playwright/test").TestInfo,
  response: Response,
) {
  await attachApiCurlToTest(testInfo, response, "create-invoice");
}
