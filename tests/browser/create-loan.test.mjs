import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let browser;
let directory;
let script;
let css;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-create-loan-test-"));
  const hooks = path.resolve("tests/browser/fixtures/create-loan-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/create-loan.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/api/axios$": hooks,
      "@/lib/accounting/daily-income/hooks$": hooks,
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/print-signatures-i18n.ts"),
      "@": path.resolve("src"),
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("tests/browser/fixtures/typescript-loader.mjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString()));
      else resolve();
    });
  }));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture(flags = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(7000);
  page.on("pageerror", error => console.error(error.message));
  await page.context().route("http://localhost/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://localhost/fixture");
  await page.evaluate(values => Object.assign(window, { visual: true }, values), flags);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.getByRole("dialog").waitFor();
  return page;
}
async function details(page) {
  const dialog = page.getByRole("dialog");
  await dialog.locator("#loan-employee").click();
  await page.getByRole("option", { name: "Ana", exact: true }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Loan account", exact: false }).click();
  await page.getByRole("option", { name: "Employee loans (New York)", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Source asset account", exact: false }).click();
  await page.getByRole("option", { name: "Cash", exact: true }).click();
  await dialog.getByLabel("Principal amount", { exact: false }).fill("250.50");
  await dialog.getByLabel("Transaction date", { exact: false }).fill("2026-10-30");
  await dialog.getByLabel("Reference number", { exact: true }).fill("LN-100");
  return dialog;
}
test("loan wizard validates, reviews, preserves fields on failure, and blocks duplicate submissions", async () => {
  const page = await fixture({ loanSubmitFails: true });
  try {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByText("Employee is required.", { exact: true }).waitFor();
    await details(page);
    assert.equal(await dialog.locator('input[type="date"]:visible').count(), 1);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByText("Journal entry summary", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("$250.50", { exact: true }).count(), 3);
    await dialog.getByRole("button", { name: "Create loan", exact: true }).click();
    await dialog.getByText("Loan could not be saved", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Previous", exact: true }).click();
    assert.equal(await dialog.getByLabel("Reference number", { exact: true }).inputValue(), "LN-100");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await dialog.waitFor({ state: "detached" });
    const submissions = await page.evaluate(() => window.loanSubmissions);
    assert.equal(submissions.length, 2);
    assert.equal(submissions[1].principalAmount, 250.50);
    assert.equal(submissions[1].transactionDate, "2026-10-30");
    assert.equal(submissions[1].sourceAccountId, 3);
  } finally { await page.close(); }
});

test("inactive closeout blocks advancement and layout fits a phone", async () => {
  const page = await fixture({ noCloseout: true });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await details(page);
    assert.equal(await dialog.getByRole("button", { name: "Next", exact: true }).isDisabled(), true);
    await dialog.getByText("An active Daily Income closeout is required", { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.loanSubmissions?.length ?? 0), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  } finally { await page.close(); }
});
