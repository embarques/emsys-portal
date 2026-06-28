import { expect, test } from "@playwright/test";

import { gotoWorkspace, waitForApiResponse, workspaceMain } from "../workspace.fixture";

test.beforeEach(async ({ page }) => {
  await gotoWorkspace(page, "/accounting/accounts");
});

test("renders the live paginated chart of accounts directory", async ({ page }) => {
  const main = workspaceMain(page);

  await expect(main.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible();
  await expect(main.getByText("Accounts", { exact: true })).toBeVisible();
  await expect(main.getByText("Loading accounts…")).toHaveCount(0, { timeout: 30_000 });
  await expect(main.getByText("Route not found")).toHaveCount(0);
  await expect(main.getByText(/Showing \d+ of \d+ accounts/).first()).toBeVisible();
  await expect(main.getByText(/Page \d+ of \d+/)).toBeVisible({ timeout: 15_000 });
});

test("creates and deletes an account through the authenticated API", async ({ page }) => {
  const main = workspaceMain(page);
  const accountName = `Playwright Account ${Date.now()}`;

  await main.getByRole("button", { name: "Add account" }).click();

  const dialog = page.getByRole("dialog", { name: "Create account" });
  await dialog.getByLabel("Account name", { exact: true }).fill(accountName);
  await dialog.getByLabel("Account type", { exact: true }).selectOption("REVENUE");
  await dialog.getByLabel("Description", { exact: true }).fill("Created by Playwright integration testing");

  const createResponse = waitForApiResponse(page, "/accounting/account", "POST", { requireOk: false });
  await dialog.getByRole("button", { name: "Create account" }).click();
  const response = await createResponse;
  expect(response.ok(), `Create account failed with HTTP ${response.status()}`).toBe(true);

  await expect(page.getByText("Account created.")).toBeVisible();

  await main.getByPlaceholder("Search by account…").fill(accountName);
  const row = main.locator("tr").filter({ hasText: accountName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Delete account" }).click();

  const deleteResponse = waitForApiResponse(page, "/accounting/account/", "DELETE", { requireOk: false });
  await page.getByRole("dialog", { name: "Delete account?" }).getByRole("button", { name: "Delete" }).click();
  const deleted = await deleteResponse;
  expect(deleted.ok(), `Delete account failed with HTTP ${deleted.status()}`).toBe(true);
  await expect(row).toHaveCount(0);
});

test("opens the route in a workspace tab", async ({ page }) => {
  await expect(page).toHaveURL(/\/accounting\/accounts\?.*tab=\d+/);
  await expect(workspaceMain(page).locator("[data-tab-id]").filter({ hasText: "Chart of Accounts" })).toBeVisible();
});
