import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

test("loan entry uses dedicated create/payment mutations and retains failed payment input", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emsys-loan-entry-"));
  let browser;
  try {
    const fixtures = path.resolve("tests/browser/fixtures");
    const hooks = path.join(fixtures, "loan-entry-hooks.ts");
    const aliases = Object.fromEntries(["@/lib/api/axios", "@/lib/api/api-error", "@/lib/accounting/daily-income/hooks", "@/lib/accounting/loans/hooks", "@/lib/auth/hooks/use-auth", "@/lib/store/store", "@/components/app-shell/feedback-provider"].map((key) => [`${key}$`, hooks]));
    const compiler = webpackPackage.webpack({ mode: "development", devtool: false,
      plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      entry: path.join(fixtures, "loan-entry.tsx"), output: { path: directory, filename: "fixture.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@/lib/i18n$": path.join(fixtures, "print-signatures-i18n.ts"), "@": path.resolve("src") } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(fixtures, "typescript-loader.mjs") }] },
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => error || stats?.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : resolve()));
    await new Promise((resolve) => compiler.close(resolve));
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(7000);
    await page.route("http://localhost/**", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.goto("http://localhost/fixture");
    await page.evaluate(() => { window.visual = true; });
    await page.addStyleTag({ content: ".hidden { display:none }" });
    await page.addScriptTag({ content: await readFile(path.join(directory, "fixture.js"), "utf8") });
    await page.getByRole("button", { name: "Register new loan", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("#loan-employee").click();
    await page.getByRole("option", { name: "Ana", exact: true }).click();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.locator("#loan-account").click();
    await page.getByRole("option", { name: "Employee loans (New York)", exact: true }).click();
    await dialog.getByRole("combobox", { name: "Source asset account", exact: false }).click();
    await page.getByRole("option", { name: "Cash", exact: true }).click();
    await dialog.getByLabel("Principal amount", { exact: false }).fill("250");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByRole("button", { name: "Create loan", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await page.evaluate(() => { window.loanEntryFailure = true; });
    await page.getByRole("button", { name: "Register loan payment", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.locator("#loan-payment-employee").click();
    await page.getByRole("option", { name: "Ana", exact: true }).click();
    await dialog.locator("#loan-payment-received-account").click();
    await page.getByRole("option", { name: "Cash", exact: true }).click();
    await dialog.locator("#loan-payment-amount").fill("25");
    await dialog.locator("#loan-payment-reference").fill("PAY-25");
    await dialog.locator("form").evaluate((form) => form.requestSubmit());
    await dialog.getByText("Payment could not be saved", { exact: true }).waitFor();
    assert.equal(await dialog.locator("#loan-payment-reference").inputValue(), "PAY-25");
    await dialog.locator("form").evaluate((form) => form.requestSubmit());
    await dialog.waitFor({ state: "detached" });
    const requests = await page.evaluate(() => window.loanEntryRequests);
    assert.deepEqual(requests.map((request) => request.kind), ["issue", "payment", "payment"]);
    assert.equal(requests[0].values.principalAmount, 250);
    assert.equal(requests[0].values.sourceAccountId, 3);
    assert.equal(requests[2].values.employeeId, 1);
    assert.equal(requests[2].values.amount, 25);
    assert.equal(requests[2].values.receivedAccountId, 3);
    assert.equal(requests[2].values.allocationMode, "oldest-first");
  } finally { await browser?.close(); await rm(directory, { recursive: true, force: true }); }
});
