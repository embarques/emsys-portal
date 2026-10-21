import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { injectDevSessionInitScript } from "../auth.fixture";
import { primeWorkspaceTabs, workspaceMain } from "../workspace.fixture";

// Opt in only with an isolated, provisioned local API/Rust/company fixture.
// This test neither creates financial records nor changes company settings.
test("prints a selected invoice through the external report engine", async ({ page }, testInfo) => {
  test.skip(process.env.PLAYWRIGHT_EXTERNAL_REPORT_TEST !== "true", "Requires the isolated external-report stack.");
  test.setTimeout(90_000);
  const api = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://invalid.example");
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(api.hostname.replace(/\.$/, ""));
  const number = process.env.PLAYWRIGHT_EXTERNAL_INVOICE_NUMBER ?? "EXT-1001";

  await primeWorkspaceTabs(page);
  await injectDevSessionInitScript(page);
  const sessionReady = page.waitForResponse((response) => response.request().method() === "GET" && response.url().includes("/users/permissions"));
  await page.goto("/invoices");
  expect((await sessionReady).status()).toBe(200);
  const main = workspaceMain(page);
  await main.getByRole("textbox", { name: "Search invoices", exact: true }).fill(number);
  const row = main.getByRole("row").filter({ hasText: number });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await row.getByRole("checkbox").check();

  const responses: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/reports/invoices")) responses.push(request.url());
  });
  const resultPromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/reports/invoices"));
  const reportTabPromise = page.context().waitForEvent("page");
  // Headless Chromium attributes PDF popup downloads to the opener page.
  const reportDownloadPromise = page.waitForEvent("download");
  await main.getByRole("button", { name: "Print", exact: true }).click();
  const response = await resultPromise;
  expect(response.status()).toBe(201);
  const result = await response.json();
  expect(result.data.engine).toBe("external");
  expect(responses).toHaveLength(1);
  expect(await reportTabPromise).not.toBe(page);
  const download = await reportDownloadPromise;
  expect(download.url()).toBe(result.data.url);
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await testInfo.attach("external-invoice.pdf", { body: bytes, contentType: "application/pdf" });
});
