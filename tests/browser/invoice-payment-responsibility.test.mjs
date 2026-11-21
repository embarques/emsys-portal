import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

let browser, directory, script;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-initial-responsibility-"));
  const mocks = path.resolve("tests/browser/fixtures/invoice-payment-mocks.tsx");
  const alias = Object.fromEntries([
    "@/lib/accounting/daily-income/use-responsibility-access", "@/lib/auth/hooks/use-auth", "@/components/app-shell/feedback-provider",
    "@/lib/employees/hooks/use-employees", "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes", "@/lib/accounting/chart-accounts/hooks/use-chart-accounts",
    "@/lib/accounting/daily-income/hooks", "@/components/accounting/register-invoice-transaction-fields",
  ].map((name) => [`${name}$`, mocks]));
  const compiler = webpackPackage.webpack({ mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({}) })],
    entry: path.resolve("tests/browser/fixtures/invoice-payment.tsx"), output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...alias, "@/lib/i18n$": path.resolve("tests/browser/fixtures/responsibility-i18n.ts"), "@": path.resolve("src") } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("tests/browser/fixtures/typescript-loader.mjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString())) : resolve())));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
async function fixture(width, hash = "") {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => { process.stderr.write(`${error.stack}\n`); });
  await page.goto(`about:blank#${hash}`); await page.setContent('<div id="root"></div>'); await page.addScriptTag({ content: script });
  await page.locator("#collector").waitFor(); return page;
}

test("initial collector defaults to invoice, then stays independent through refresh and navigation", async () => {
  for (const width of [1200, 390]) {
    const page = await fixture(width);
    try {
      await page.waitForFunction(() => document.getElementById("collector").textContent === "88");
      await page.getByText("Choose collector", { exact: true }).click();
      await page.getByLabel("Amount").fill("10");
      await page.getByText("Change invoice party", { exact: true }).click();
      await page.getByText("Refresh", { exact: true }).click();
      assert.equal(await page.locator("#collector").textContent(), "99");
      await page.getByText("Toggle step", { exact: true }).click();
      await page.getByText("Toggle step", { exact: true }).click();
      assert.equal(await page.locator("#collector").textContent(), "99");
      assert.equal(await page.getByLabel("Amount").inputValue(), "10");
      await page.getByText("Post", { exact: true }).click();
      await page.waitForFunction(() => document.getElementById("posted").textContent.length > 0);
      const values = JSON.parse(await page.locator("#posted").textContent());
      assert.equal(values.employeeId, 99); assert.equal(values.invoiceResponsibility.employee.id, 77);
      assert.equal(values.amount, 10); assert.equal(await page.locator("#error").textContent(), "");
    } finally { await page.close(); }
  }
});

test("without payment assignment authority, the initial collector defaults to linked self", async () => {
  const page = await fixture(1200, "self");
  try {
    await page.waitForFunction(() => document.getElementById("collector").textContent === "self");
    await page.getByLabel("Amount").fill("10"); await page.getByText("Post", { exact: true }).click();
    await page.waitForFunction(() => document.getElementById("posted").textContent.length > 0);
    const values = JSON.parse(await page.locator("#posted").textContent());
    assert.equal(values.employeeId, undefined); assert.equal(values.invoiceResponsibility.employee.id, 88);
  } finally { await page.close(); }
});

test("an untouched initial collector follows merchandise changes until explicitly overridden", async () => {
  for (const width of [1200, 390]) {
    const page = await fixture(width);
    try {
      await page.waitForFunction(() => document.getElementById("collector").textContent === "88");
      await page.getByText("Change invoice party", { exact: true }).click();
      await page.waitForFunction(() => document.getElementById("collector").textContent === "77");
      await page.getByText("Refresh", { exact: true }).click();
      await page.getByText("Post", { exact: true }).click();
      await page.waitForFunction(() => document.getElementById("posted").textContent.length > 0);
      const values = JSON.parse(await page.locator("#posted").textContent());
      assert.equal(values.employeeId, 77);
      assert.equal(values.invoiceResponsibility.employee.id, 77);
      assert.equal(values.amount, 0);
    } finally { await page.close(); }
  }
});
