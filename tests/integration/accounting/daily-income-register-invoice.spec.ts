import { expect, test } from "@playwright/test";

import {
  ensureOpenDailyCloseoutForBranch,
  logDailyIncomeBranchPlan,
  logRunningTestForBranch,
  openRegisterInvoiceTransactionWizard,
  resolveDailyIncomeBranchesForTest,
  saveRegisterInvoiceTransaction,
  waitForCloseoutTransactionsReady,
} from "./daily-income.fixture";
import { gotoWorkspace, workspaceMain } from "../workspace.fixture";

test.describe("Daily income register invoice", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page, "/accounting/daily-income");
  });

  test("logs in, opens closeout, and registers an invoice transaction", async ({ page }) => {
    const main = workspaceMain(page);

    await expect(main.getByRole("heading", { name: "Daily Income" })).toBeVisible();

    const branchCodes = await resolveDailyIncomeBranchesForTest(main);
    logDailyIncomeBranchPlan(branchCodes);

    let lastResponse: Awaited<ReturnType<typeof saveRegisterInvoiceTransaction>> | null = null;
    let lastBranch: string | null = null;
    let lastError: unknown = null;

    for (const branchCode of branchCodes) {
      logRunningTestForBranch(branchCode, branchCodes);

      try {
        await ensureOpenDailyCloseoutForBranch(page, main, branchCode, branchCodes, false);
        await waitForCloseoutTransactionsReady(main);
        await expect(main.locator("#daily-branch")).toHaveValue(branchCode);

        const dialog = await openRegisterInvoiceTransactionWizard(page, main);
        const refNumber = `PW-${branchCode}-${Date.now()}`;

        const response = await saveRegisterInvoiceTransaction(page, dialog, {
          amount: "1.00",
          refNumber,
          description: `Playwright register invoice integration test (${branchCode})`,
        });

        lastResponse = response;
        lastBranch = branchCode;

        if (response.ok()) {
          expect(response.ok(), `Create transaction failed with HTTP ${response.status()}`).toBe(true);
          await expect(page.getByText(/New invoice #.+ created and payment registered\./)).toBeVisible({ timeout: 15_000 });
          await expect(main.getByText(refNumber)).toBeVisible({ timeout: 15_000 });
          await expect(main.getByText("Invoice", { exact: true }).first()).toBeVisible();
          console.log(`[playwright:daily-income] Register invoice succeeded on branch ${branchCode}.`);
          return;
        }

        if (response.status() === 403) {
          console.log(
            `[playwright:daily-income] Register invoice returned HTTP 403 on branch ${branchCode}; trying next branch.`,
          );
          continue;
        }

        expect(response.ok(), `Create transaction failed with HTTP ${response.status()}`).toBe(true);
      } catch (error) {
        lastError = error;
        console.log(`[playwright:daily-income] Register invoice failed on branch ${branchCode}:`, error);
      }
    }

    if (lastResponse && !lastResponse.ok() && lastResponse.status() === 403) {
      test.skip(
        true,
        `POST /journals returned HTTP 403 on all tried branches (${branchCodes.join(", ")}). Register an invoice manually on http://127.0.0.1:3100, then set PLAYWRIGHT_DAILY_INCOME_INVOICE_NUMBER in .env.local.`,
      );
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error(
      `Register invoice did not succeed on any branch (${branchCodes.join(", ")})` +
        (lastBranch && lastResponse ? `; last attempt branch=${lastBranch} HTTP ${lastResponse.status()}.` : "."),
    );
  });
});
