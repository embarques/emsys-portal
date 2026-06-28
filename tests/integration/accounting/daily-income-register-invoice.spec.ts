import { expect, test } from "@playwright/test";

import {
  ensureOpenDailyCloseout,
  fillRegisterInvoiceTransactionForm,
  openRegisterInvoiceTransactionWizard,
} from "./daily-income.fixture";
import { gotoWorkspace, waitForApiResponse, workspaceMain } from "../workspace.fixture";

test.describe("Daily income register invoice", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page, "/accounting/daily-income");
  });

  test("logs in, opens closeout, and registers an invoice transaction", async ({ page }) => {
    const main = workspaceMain(page);

    await expect(main.getByRole("heading", { name: "Daily Income" })).toBeVisible();
    await ensureOpenDailyCloseout(page, main);

    const dialog = await openRegisterInvoiceTransactionWizard(page, main);
    const refNumber = `PW-${Date.now()}`;

    await fillRegisterInvoiceTransactionForm(dialog, {
      amount: "125.50",
      refNumber,
      description: "Playwright register invoice integration test",
    });

    const createResponse = waitForApiResponse(page, "/journals", "POST", { requireOk: false });
    await dialog.getByRole("button", { name: "Save transaction" }).click();

    const response = await createResponse;
    expect(response.ok(), `Create transaction failed with HTTP ${response.status()}`).toBe(true);

    await expect(page.getByText("Transaction created.")).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText(refNumber)).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText("Invoice", { exact: true }).first()).toBeVisible();
  });
});
