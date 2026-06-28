import { expect, type Locator, type Page } from "@playwright/test";

import { waitForApiResponse } from "../workspace.fixture";

async function selectFirstRealOption(select: Locator) {
  await expect(select.locator("option").nth(1)).toBeAttached({ timeout: 30_000 });
  const value = await select.locator("option").nth(1).getAttribute("value");
  if (!value) {
    throw new Error("Expected at least one selectable option.");
  }
  await select.selectOption(value);
  return value;
}

function isoDateDaysAgo(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

async function setDailyIncomeDate(page: Page, main: Locator, isoDate: string): Promise<boolean> {
  try {
    const searchPromise = waitForApiResponse(page, "/income-statements/search", "POST", {
      requireOk: false,
    });
    await main.locator("#daily-date").fill(isoDate);
    await searchPromise;
    await expect(main.getByText(/No closeout for this date|(?:OPEN|CLOSED) · #/)).toBeVisible({
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function tryCreateCloseout(page: Page, main: Locator): Promise<boolean> {
  if (!(await main.getByText("No closeout for this date").isVisible())) {
    return false;
  }

  await main.getByRole("button", { name: "Create closeout" }).click();
  const dialog = page.getByRole("dialog", { name: "Create daily income" });
  await expect(dialog).toBeVisible();

  const branchSelect = dialog.locator("#statement-branch");
  if (!(await branchSelect.inputValue())) {
    await selectFirstRealOption(branchSelect);
  }

  const createResponse = waitForApiResponse(page, "/income-statements", "POST", { requireOk: false });
  await dialog.getByRole("button", { name: "Save daily income" }).click();
  const created = await createResponse;

  if (!created.ok()) {
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    return false;
  }

  await expect(page.getByText("Daily income created.")).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 15_000 });
  return true;
}

async function tryReopenCloseout(page: Page, main: Locator): Promise<boolean> {
  const reopenButton = main.getByRole("button", { name: "Reopen day" });
  if (!(await reopenButton.isVisible())) {
    return false;
  }

  const reopenResponse = waitForApiResponse(page, "/income-statements/", "POST", { requireOk: false });
  await reopenButton.click();
  const reopened = await reopenResponse;
  if (!reopened.ok()) {
    return false;
  }
  await expect(page.getByText("Daily income opened.")).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText(/^OPEN · #/)).toBeVisible({ timeout: 15_000 });
  return true;
}

/**
 * Ensures an OPEN daily closeout exists for the selected branch.
 * Tries today, then walks back up to 14 days to find or create one.
 */
export async function ensureOpenDailyCloseout(page: Page, main: Locator) {
  await expect(main.locator("#daily-branch")).not.toHaveValue("", { timeout: 30_000 });
  await expect(main.getByText(/No closeout for this date|(?:OPEN|CLOSED) · #/)).toBeVisible({
    timeout: 30_000,
  });

  for (let offset = 0; offset <= 14; offset += 1) {
    if (offset > 0) {
      const changed = await setDailyIncomeDate(page, main, isoDateDaysAgo(offset));
      if (!changed) continue;
    }

    if (await main.getByText(/^OPEN · #/).isVisible()) {
      return;
    }

    if (await tryReopenCloseout(page, main)) {
      return;
    }

    if (offset === 0 && (await tryCreateCloseout(page, main))) {
      return;
    }
  }

  throw new Error(
    "Unable to find or open a daily closeout in the last 14 days. Ensure the Playwright test user can create or reopen daily income closeouts.",
  );
}

type RegisterInvoiceTransactionOptions = {
  amount: string;
  refNumber?: string;
  description?: string;
};

/** Step 2 of the add-transaction wizard for INITIAL-PAYMENT (Register invoice). */
export async function fillRegisterInvoiceTransactionForm(
  dialog: Locator,
  options: RegisterInvoiceTransactionOptions,
) {
  await selectFirstRealOption(dialog.locator("#journal-employee"));
  await dialog.locator("#journal-amount").fill(options.amount);
  await selectFirstRealOption(dialog.locator("#journal-invoice"));
  await dialog.locator("#journal-payment").selectOption({ label: "CASH" });

  if (options.refNumber) {
    await dialog.locator("#journal-reference").fill(options.refNumber);
  }

  if (options.description) {
    await dialog.locator("#journal-description").fill(options.description);
  }
}

export async function openRegisterInvoiceTransactionWizard(page: Page, main: Locator) {
  await expect(main.getByRole("button", { name: "Add transaction" })).toBeEnabled({ timeout: 15_000 });
  await main.getByRole("button", { name: "Add transaction" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add transaction" })).toBeVisible();
  await dialog.getByRole("radio", { name: "Register invoice" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Invoice information")).toBeVisible();

  return dialog;
}
