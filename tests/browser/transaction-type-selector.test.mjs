import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let browser, directory, script, css;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-transaction-picker-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    entry: path.resolve("tests/browser/fixtures/transaction-type-selector.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/transaction-type-selector-i18n.ts"),
      "@": path.resolve("src"),
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("tests/browser/fixtures/typescript-loader.mjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString())) : resolve())));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });

async function fixture(hash = "", width = 1200) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`about:blank#${hash}`);
  await page.setContent(`<style>${css}</style><div id="root"></div>`);
  await page.addScriptTag({ content: script });
  await page.getByRole("button", { name: /Invoices|Facturas/, exact: true }).waitFor();
  return page;
}

test("desktop shows one category, exposes help on keyboard focus, and dispatches each action unchanged", async () => {
  const page = await fixture();
  try {
    assert.equal(await page.locator('[role="region"]:visible').count(), 1);
    assert.equal(await page.locator('[role="region"]:visible').getByRole("button").count(), 4);
    const invoices = await page.getByRole("button", { name: "Invoices", exact: true }).boundingBox();
    const actions = await page.locator('[role="region"]:visible').boundingBox();
    assert.ok(actions.x > invoices.x + invoices.width);
    const payment = page.getByRole("button", { name: "Invoice payment", exact: true });
    await payment.focus();
    assert.equal(await page.getByText("Record a payment for an existing invoice", { exact: true }).last().isVisible(), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#selection").textContent(), "PAYMENT");
    const categories = {
      Invoices: { "New invoice": "INITIAL-PAYMENT", "Invoice payment": "PAYMENT", Discount: "DISCOUNT", Surcharge: "SURCHARGE" },
      "Income & expenses": { Income: "SALES", Expense: "EXPENSE" },
      Inventory: { "Inventory movement": "INVENTORY", "Inventory payment": "INVENTORY-PAYMENT" },
      Loans: { "New loan": "LOAN-ISSUE", "Loan payment": "LOAN-PAYMENT" },
      "Account transfers": { "Transfer between accounts": "TRANSFER" },
    };
    for (const [category, options] of Object.entries(categories)) {
      await page.getByRole("button", { name: category, exact: true }).click();
      assert.equal(await page.locator('[role="region"]:visible').count(), 1);
      for (const [label, value] of Object.entries(options)) {
        await page.getByRole("button", { name: label, exact: true }).click();
        assert.equal(await page.locator("#selection").textContent(), value);
      }
    }
    await page.getByRole("button", { name: "Invoices", exact: true }).click();
    await page.screenshot({ path: path.join(tmpdir(), "emsys-transaction-picker-desktop.png") });
  } finally { await page.close(); }
});

test("restricted inventory and loan actions remain disabled", async () => {
  const page = await fixture("restricted");
  try {
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Inventory payment", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Inventory movement", exact: true }).isEnabled(), true);
    await page.getByRole("button", { name: "Loans", exact: true }).click();
    for (const name of ["New loan", "Loan payment"]) assert.equal(await page.getByRole("button", { name, exact: true }).isDisabled(), true);
    assert.equal(await page.locator("#selection").textContent(), "");
  } finally { await page.close(); }
});

test("mobile and phone layouts keep descriptions visible, switch categories, and fit Spanish text", async () => {
  for (const hash of ["es", "es-phone"]) {
    const page = await fixture(hash, 390);
    try {
      assert.equal(await page.locator('[role="region"]:visible').count(), 1);
      assert.equal(await page.getByText("Registrar una nueva factura y su pago inicial", { exact: true }).first().isVisible(), true);
      await page.getByRole("button", { name: "Préstamos", exact: true }).click();
      assert.equal(await page.locator('[role="region"]:visible').count(), 1);
      const loans = page.getByRole("button", { name: "Préstamos", exact: true });
      assert.equal(await loans.getAttribute("aria-expanded"), "true");
      assert.equal(await page.getByRole("button", { name: "Facturas", exact: true }).getAttribute("aria-expanded"), "false");
      const header = await loans.boundingBox();
      const panel = await page.locator('[role="region"]:visible').boundingBox();
      assert.ok(panel.y >= header.y + header.height);
      await page.getByRole("button", { name: "Pago de préstamo", exact: true }).click();
      assert.equal(await page.locator("#selection").textContent(), "LOAN-PAYMENT");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(tmpdir(), `emsys-transaction-picker-${hash}.png`) });
    } finally { await page.close(); }
  }
});

test("returning from a transaction opens its category", async () => {
  const page = await fixture("expense");
  try {
    assert.equal(await page.getByRole("region", { name: "Income & expenses" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Expense", exact: true }).isVisible(), true);
  } finally { await page.close(); }
});
