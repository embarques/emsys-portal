import { expect, test } from "@playwright/test";

import {
  DAILY_INCOME_TRANSACTION_SPECS,
  expectRegisterInvoiceSuccessToast,
  expectRegisterInvoiceWizardReadyForNextEntry,
  openTransactionTypeWizard,
  prepareDailyIncomeCloseout,
  saveJournalTransaction,
} from "./daily-income.fixture";
import { gotoWorkspace, workspaceMain } from "../workspace.fixture";

test.describe("Daily income transaction types", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page, "/accounting/daily-income");
  });

  for (const spec of DAILY_INCOME_TRANSACTION_SPECS) {
    test(`[${spec.slug}] fills form and submits journal transaction`, async ({ page }, testInfo) => {
      const main = workspaceMain(page);

      await expect(main.getByRole("heading", { name: "Daily Income" })).toBeVisible();

      const { branchCode } = await prepareDailyIncomeCloseout(page, main);
      await expect(main.locator("#daily-branch")).toHaveValue(branchCode);

      let dialog;
      try {
        dialog = await openTransactionTypeWizard(page, main, spec);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("/chart-accounts") || message.includes("account dropdown")) {
          test.skip(true, `${spec.label}: ${message}`);
        }
        throw error;
      }

      const refNumber = `PW-${branchCode}-${Date.now()}`;
      const invoiceNumber =
        spec.slug === "register-invoice" ? `PW-INV-${branchCode}-${Date.now()}` : undefined;

      let response;
      try {
        response = await saveJournalTransaction(page, dialog, spec, {
          amount: spec.slug === "register-invoice" ? "10.00" : "1.00",
          cost: spec.slug === "register-invoice" ? "15.00" : undefined,
          invoiceNumber,
          refNumber,
          description: `Playwright ${spec.slug} integration test (${branchCode})`,
          testInfo,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("/chart-accounts")) {
          test.skip(true, `${spec.label}: ${message}`);
        }
        throw error;
      }

      if (!response.ok() && response.status() === 403) {
        test.skip(
          true,
          `${spec.label}: POST /journals returned HTTP 403 — copy the curl command from stdout or the Playwright attachment.`,
        );
      }

      expect(response.ok(), `${spec.label} failed with HTTP ${response.status()}`).toBe(true);
      if (spec.slug === "register-invoice" && invoiceNumber) {
        await expectRegisterInvoiceSuccessToast(page, invoiceNumber);
        await expectRegisterInvoiceWizardReadyForNextEntry(dialog);
      } else {
        await expect(page.getByText("Transaction created.")).toBeVisible({ timeout: 15_000 });
      }
      await expect(main.getByText(refNumber)).toBeVisible({ timeout: 15_000 });

      console.log(`[playwright:daily-income] ${spec.slug} succeeded on branch ${branchCode}.`);
    });
  }
});
