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
  await page.locator("[data-type-option]").first().waitFor();
  return page;
}

test("desktop groups every action, keeps descriptions readable, and dispatches each action unchanged", async () => {
  const page = await fixture();
  try {
    assert.equal(await page.getByRole("region").count(), 6);
    assert.equal(await page.getByRole("region", { name: "Invoices", exact: true }).getByRole("button").count(), 4);
    const newInvoice = page.getByRole("button", { name: "New invoice", exact: true });
    const description = newInvoice.getByText("Register a new invoice and its initial payment", { exact: true });
    assert.equal(await description.isVisible(), true);
    assert.equal(await page.getByText("Register a new invoice and its initial payment", { exact: true }).count(), 1);
    const payment = page.getByRole("button", { name: "Invoice payment", exact: true });
    assert.equal(await payment.getByText("Record a payment for an existing invoice", { exact: true }).isVisible(), true);
    await payment.focus();
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
      assert.equal(await page.getByRole("region", { name: category, exact: true }).count(), 1);
      for (const [label, value] of Object.entries(options)) {
        await page.getByRole("button", { name: label, exact: true }).click();
        assert.equal(await page.locator("#selection").textContent(), value);
      }
    }
    await page.screenshot({ path: path.join(tmpdir(), "emsys-transaction-picker-desktop.png") });
  } finally { await page.close(); }
});

test("restricted inventory and loan actions remain disabled", async () => {
  const page = await fixture("restricted");
  try {
    assert.equal(await page.getByRole("button", { name: "Inventory payment", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Inventory movement", exact: true }).isEnabled(), true);
    for (const name of ["New loan", "Loan payment"]) assert.equal(await page.getByRole("button", { name, exact: true }).isDisabled(), true);
    assert.equal(await page.locator("#selection").textContent(), "");
  } finally { await page.close(); }
});

test("mobile and phone layouts show grouped actions with readable Spanish descriptions and no horizontal overflow", async () => {
  for (const hash of ["es", "es-phone"]) {
    const page = await fixture(hash, 390);
    try {
      assert.equal(await page.getByRole("region").count(), 6);
      const invoice = page.getByRole("button", { name: "Nueva factura", exact: true });
      const description = invoice.getByText("Registrar una nueva factura y su pago inicial", { exact: true });
      assert.equal(await description.isVisible(), true);
      assert.ok(await description.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)) >= 14);
      await page.getByRole("button", { name: "Pago de préstamo", exact: true }).click();
      assert.equal(await page.locator("#selection").textContent(), "LOAN-PAYMENT");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(tmpdir(), `emsys-transaction-picker-${hash}.png`), fullPage: true });
    } finally { await page.close(); }
  }
});

test("returning from a transaction keeps its group visible", async () => {
  const page = await fixture("expense");
  try {
    assert.equal(await page.getByRole("region", { name: "Income & expenses" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Expense", exact: true }).isVisible(), true);
  } finally { await page.close(); }
});

test("picker focuses the current choice and arrow navigation skips restricted actions", async () => {
  const page = await fixture("restricted-expense");
  try {
    const expense = page.getByRole("button", { name: "Expense", exact: true });
    assert.equal(await expense.locator(".lucide-check").count(), 1);
    assert.equal(await expense.evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("button", { name: "Inventory movement", exact: true }).evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("button", { name: "Transfer between accounts", exact: true }).evaluate((element) => document.activeElement === element), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#selection").textContent(), "TRANSFER");
  } finally { await page.close(); }
});


test("selected form replaces the picker and section links scroll only its body", async () => {
  for (const width of [1200, 390]) {
    const page = await fixture("inline", width);
    try {
      await page.getByRole("button", { name: "New invoice", exact: true }).click();
      const panel = page.getByRole("region", { name: "Transaction type", exact: true });
      const nav = panel.getByRole("navigation", { name: "New invoice" });
      await nav.getByRole("button", { name: "Payment & references", exact: true }).waitFor();
      assert.equal(await panel.getByRole("button", { name: "Invoice payment", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Invoices", exact: true }).count(), 0);
      assert.equal(await page.getByText("Choose a transaction type", { exact: true }).count(), 0);
      const body = panel.locator("[data-form-body]");
      const navTop = (await nav.boundingBox()).y;
      await nav.getByRole("button", { name: "Payment & references", exact: true }).focus();
      await page.keyboard.press("Enter");
      assert.ok(await body.evaluate((element) => element.scrollTop) > 300, JSON.stringify(await body.evaluate((element) => ({ top: element.scrollTop, height: element.clientHeight, scroll: element.scrollHeight, parent: element.parentElement.clientHeight }))));
      assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-form-section")), true);
      assert.equal((await nav.boundingBox()).y, navTop);
      assert.equal(await page.locator("#selection").textContent(), "");
      await nav.getByRole("button", { name: "New invoice", exact: true }).click();
      assert.equal(await body.evaluate((element) => element.scrollTop), 0);
      await page.getByRole("button", { name: "Toggle customers" }).click();
      await nav.getByRole("button", { name: "Customers", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(tmpdir(), `emsys-transaction-inline-${width}.png`) });
      await page.getByRole("button", { name: "Change transaction", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Invoice payment", exact: true }).isVisible(), true);
      assert.equal(await page.getByRole("region", { name: "Income & expenses", exact: true }).getByRole("button", { name: "Expense", exact: true }).isVisible(), true);
    } finally { await page.close(); }
  }
});

test("keyboard navigation into a new section scrolls that section to the top of the form body, clicks do not", async () => {
  const page = await fixture("inline");
  try {
    await page.getByRole("button", { name: "New invoice", exact: true }).click();
    const body = page.locator("[data-form-body]");
    const offsetFromTop = (name) => page.evaluate((title) => {
      const section = Array.from(document.querySelectorAll("[data-form-section]")).find((element) => element.querySelector("h3")?.textContent === title);
      return Math.round(section.getBoundingClientRect().top - document.querySelector("[data-form-body]").getBoundingClientRect().top);
    }, name);
    await page.getByLabel("Assignment field").click();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.closest("label")?.textContent), "Invoice details field");
    assert.equal(await offsetFromTop("Invoice details"), 16);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.closest("label")?.textContent), "Invoice notes field");
    assert.equal(await offsetFromTop("Invoice details"), 16);
    await page.keyboard.press("Tab");
    assert.equal(await offsetFromTop("Invoice amount"), 16);
    const scrollTop = await body.evaluate((element) => element.scrollTop);
    await page.getByLabel("Invoice amount field").click();
    assert.equal(await body.evaluate((element) => element.scrollTop), scrollTop);
  } finally { await page.close(); }
});
