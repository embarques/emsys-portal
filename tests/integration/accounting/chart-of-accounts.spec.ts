import { expect, test } from "@playwright/test";

import { installAccountingApi } from "./accounting-api.fixture";

test.beforeEach(async ({ page }) => {
  await installAccountingApi(page);
  await page.goto("/accounting/accounts");
});

test("renders the independently paginated chart of accounts directory", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible();
  await expect(page.getByText("Accounts", { exact: true })).toBeVisible();
  await expect(page.getByText("Sales", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash", { exact: true })).toBeVisible();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
});

test("creates an account through the accounting API", async ({ page }) => {
  await page.getByRole("button", { name: "Add account" }).click();
  await page.getByLabel("Account name").fill("Storage Income");
  await page.getByLabel("Account type").selectOption("REVENUE");
  await page.getByLabel("Branch").selectOption("1");
  await page.getByLabel("Description").fill("Storage service revenue");

  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/accounting/account") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  await response;

  await expect(page.getByText("Storage Income", { exact: true })).toBeVisible();
  await expect(page.getByText("Account created.")).toBeVisible();
});
