import { expect, test } from "@playwright/test";

import { ensureAuthenticated } from "../auth.fixture";

test.beforeEach(async ({ page }) => {
  await page.goto("/accounting/daily-income");
  await ensureAuthenticated(page);
});

test("uses Firebase authentication for EMSYS API requests", async ({ page }) => {
  const permissionsRequest = page.waitForRequest((request) =>
    request.url().includes("/users/permissions"),
  );

  await page.reload();
  const request = await permissionsRequest;

  expect(request.headers().authorization).toMatch(/^Bearer\s+\S+$/);
  expect(request.headers()["x-company-id"]).toBeTruthy();
});

test("renders live closeout totals and its transaction directory", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Daily Income" })).toBeVisible();
  await expect(page.getByText("Total income")).toBeVisible();
  await expect(page.getByText("Total expenses")).toBeVisible();
  await expect(page.getByText("Net (income − expenses)")).toBeVisible();
  await expect(page.getByText("Invoice payments")).toBeVisible();
  await expect(page.getByText("Transactions", { exact: true })).toBeVisible();
  await expect(page.getByText(/No closeout for this date|(?:OPEN|CLOSED) · #/)).toBeVisible();
});
