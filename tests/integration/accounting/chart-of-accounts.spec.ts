import { expect, test } from "@playwright/test";

import { ensureAuthenticated } from "../auth.fixture";

test.beforeEach(async ({ page }) => {
  await page.goto("/accounting/accounts");
  await ensureAuthenticated(page);
});

test("renders the live paginated chart of accounts directory", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible();
  await expect(page.getByText("Accounts", { exact: true })).toBeVisible();
  await expect(page.getByText(/Showing \d+ of \d+ accounts/).first()).toBeVisible();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
});

test("creates and deletes an account through the authenticated API", async ({ page }) => {
  const accountName = `Playwright Account ${Date.now()}`;

  await page.getByRole("button", { name: "Add account" }).click();

  const dialog = page.getByRole("dialog", { name: "Create account" });
  await dialog.getByLabel("Account name", { exact: true }).fill(accountName);
  await dialog.getByLabel("Account type", { exact: true }).selectOption("REVENUE");
  await dialog.getByLabel("Description", { exact: true }).fill("Created by Playwright integration testing");

  const createResponse = page.waitForResponse((candidate) =>
    candidate.url().includes("/accounting/account") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await createResponse).ok()).toBe(true);

  await expect(page.getByText("Account created.")).toBeVisible();

  await page.getByPlaceholder("Search by account…").fill(accountName);
  const row = page.locator("tr").filter({ hasText: accountName });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete account" }).click();

  const deleteResponse = page.waitForResponse((candidate) =>
    candidate.url().includes("/accounting/account/") && candidate.request().method() === "DELETE",
  );
  await page.getByRole("dialog", { name: "Delete account?" }).getByRole("button", { name: "Delete" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(row).toHaveCount(0);
});
