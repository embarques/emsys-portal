import { expect, test } from "@playwright/test";

import { ensureAuthenticated, installDevAuth } from "../auth.fixture";
import { installAccountingApi } from "./accounting-api.fixture";

test.beforeEach(async ({ page }) => {
  await installDevAuth(page);
  await installAccountingApi(page);
  await page.goto("/accounting/accounts");
  await ensureAuthenticated(page);
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

  const dialog = page.getByRole("dialog", { name: "Create account" });
  await dialog.getByLabel("Account name", { exact: true }).fill("Storage Income");
  await dialog.getByLabel("Account type", { exact: true }).selectOption("REVENUE");
  await dialog.getByLabel("Branch", { exact: true }).selectOption("1");
  await dialog.getByLabel("Description", { exact: true }).fill("Storage service revenue");

  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/accounting/account") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  await response;

  await expect(page.getByText("Storage Income", { exact: true })).toBeVisible();
  await expect(page.getByText("Account created.")).toBeVisible();
});
