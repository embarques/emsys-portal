import { expect, test } from "@playwright/test";

import { ensureAuthenticated, installDevAuth } from "../auth.fixture";
import { installAccountingApi } from "./accounting-api.fixture";

test.beforeEach(async ({ page }) => {
  await installDevAuth(page);
  await installAccountingApi(page);
  await page.goto("/accounting/daily-income");
  await ensureAuthenticated(page);
});

test("renders closeout totals and its paginated transaction directory", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Daily Income" })).toBeVisible();
  await expect(page.getByText("Total income")).toBeVisible();
  await expect(page.getByText("$350.00", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Total expenses")).toBeVisible();
  await expect(page.getByText("$505.50", { exact: true })).toBeVisible();
  await expect(page.getByText("-$155.50", { exact: true })).toBeVisible();
  await expect(page.getByText("$170.00", { exact: true })).toBeVisible();
  await expect(page.getByText("Transactions", { exact: true })).toBeVisible();
  await expect(page.getByText("INC-1001", { exact: true })).toBeVisible();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
});

test("creates an income transaction through the accounting API", async ({ page }) => {
  await page.getByRole("button", { name: "Add transaction" }).click();

  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Transaction", { exact: true }).selectOption("SALES");
  await dialog.getByLabel("Employee", { exact: true }).selectOption("1");
  await dialog.getByLabel("Account", { exact: true }).selectOption("101");
  await dialog.getByLabel("Amount", { exact: true }).fill("125.50");
  await dialog.getByLabel("Reference number", { exact: true }).fill("INC-2002");
  await dialog.getByLabel("Description", { exact: true }).fill("Warehouse income");

  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/accounting/journal") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save transaction" }).click();
  await response;

  await expect(page.getByText("INC-2002", { exact: true })).toBeVisible();
  await expect(page.getByText("Transaction created.")).toBeVisible();
});
