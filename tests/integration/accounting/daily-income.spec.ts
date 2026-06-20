import { expect, test } from "@playwright/test";

import { installAccountingApi } from "./accounting-api.fixture";

test.beforeEach(async ({ page }) => {
  await installAccountingApi(page);
  await page.goto("/accounting/daily-income");
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
  await page.getByLabel("Transaction").selectOption("SALES");
  await page.getByLabel("Employee").selectOption("1");
  await page.getByLabel("Account", { exact: true }).selectOption("101");
  await page.getByLabel("Amount").fill("125.50");
  await page.getByLabel("Reference number").fill("INC-2002");
  await page.getByLabel("Description").fill("Warehouse income");

  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/accounting/journal") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save transaction" }).click();
  await response;

  await expect(page.getByText("INC-2002", { exact: true })).toBeVisible();
  await expect(page.getByText("Transaction created.")).toBeVisible();
});
