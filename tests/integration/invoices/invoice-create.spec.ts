import { expect, test } from "@playwright/test";

import {
  activateInvoicesDirectoryTab,
  attachInvoiceCreateCurl,
  completeInvoiceCreateWizard,
  expectInvoiceCreateSuccessToast,
  expectInvoiceWizardReadyForNextEntry,
  openAddInvoiceWizard,
  searchInvoicesDirectory,
} from "./invoices.fixture";
import { gotoWorkspace, logApiResponse, workspaceMain } from "../workspace.fixture";

test.describe("Invoice create wizard", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await gotoWorkspace(page, "/invoices");
  });

  test("creates an invoice from the directory, saves to the API, and resets the wizard", async ({
    page,
  }, testInfo) => {
    const main = workspaceMain(page);

    await expect(main.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const wizard = await openAddInvoiceWizard(page, main);
    const invoiceNumber = `PW-INV-${Date.now()}`;

    const { response } = await completeInvoiceCreateWizard(page, wizard, { invoiceNumber });

    if (!response.ok()) {
      await attachInvoiceCreateCurl(testInfo, response);
    }

    if (response.status() === 403) {
      test.skip(
        true,
        "POST /invoices returned HTTP 403. Ensure the Playwright test user has invoice create permission.",
      );
    }

    expect(response.ok(), `Create invoice failed with HTTP ${response.status()}`).toBe(true);
    await logApiResponse(response, `create invoice #${invoiceNumber}`);

    await expectInvoiceCreateSuccessToast(page, invoiceNumber);
    await expectInvoiceWizardReadyForNextEntry(wizard);

    await activateInvoicesDirectoryTab(page);
    await searchInvoicesDirectory(workspaceMain(page), invoiceNumber);
    await expect(workspaceMain(page).getByText(invoiceNumber).first()).toBeVisible({
      timeout: 15_000,
    });

    console.log(`[playwright:invoices] Invoice #${invoiceNumber} created via POST /invoices.`);
  });
});
