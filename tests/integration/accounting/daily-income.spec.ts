import { expect, test } from "@playwright/test";

import {
  gotoWorkspace,
  waitForWorkspaceShell,
  waitForWorkspaceTabUrl,
  workspaceMain,
} from "../workspace.fixture";

test.beforeEach(async ({ page }) => {
  await gotoWorkspace(page, "/accounting/daily-income");
});

test("uses bearer authentication for EMSYS API requests", async ({ page }) => {
  const permissionsRequest = page.waitForRequest((request) =>
    request.url().includes("/users/permissions"),
  );

  await page.reload();
  await waitForWorkspaceTabUrl(page, "/accounting/daily-income");
  await waitForWorkspaceShell(page);

  const request = await permissionsRequest;

  expect(request.headers().authorization).toMatch(/^Bearer\s+\S+$/);
  expect(request.headers()["x-company-id"]).toBeTruthy();
});

test("renders live closeout totals and its transaction directory", async ({ page }) => {
  const main = workspaceMain(page);

  await expect(main.getByRole("heading", { name: "Daily Income" })).toBeVisible();
  await expect(main.getByText("Total income")).toBeVisible();
  await expect(main.getByText("Total expenses")).toBeVisible();
  await expect(main.getByText("Net (income − expenses)")).toBeVisible();
  await expect(main.getByText("Invoice payments")).toBeVisible();
  await expect(main.getByText("Transactions", { exact: true })).toBeVisible();
  await expect(main.getByText(/No closeout for this date|(?:OPEN|CLOSED) · #/)).toBeVisible();
});

test("opens the route in a workspace tab", async ({ page }) => {
  await expect(page).toHaveURL(/\/accounting\/daily-income\?.*tab=\d+/);
  await expect(workspaceMain(page).locator("[data-tab-id]").filter({ hasText: "Daily Income" })).toBeVisible();
});
