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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-payment-summary-"));
  const stubs = path.resolve("tests/browser/fixtures/invoice-payment-summary-stubs.tsx");
  const i18n = path.resolve("tests/browser/fixtures/invoice-payment-summary-i18n.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    entry: path.resolve("tests/browser/fixtures/invoice-payment-summary.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": stubs,
      "@/components/invoices/invoice-line-items-section$": stubs,
      "@/components/invoices/invoice-documents-section$": stubs,
      "@/components/invoices/invoice-activity-section$": stubs,
      "@/components/invoices/invoice-barcode-status-section$": stubs,
      "@/components/invoices/invoice-comments-section$": stubs,
      "@/components/invoices/invoice-package-tracker-section$": stubs,
      "@/components/invoices/invoice-payments-section$": stubs,
      "@/components/addresses/address-action-row$": stubs,
      "@/components/phones/phone-action-row$": stubs,
      "@/components/app-shell/table-selection-actions-menu$": stubs,
      "@/lib/i18n$": i18n,
      "@/lib/i18n/translate-current$": i18n,
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

// $1,000 invoice: $300 cleared, two checks totalling $250 still waiting.
const PARTIALLY_CLEARED = {
  invoiceTotal: 1000, discount: 0, totalPaid: 300, outstandingBalance: 700,
  pendingClearance: 250, pendingClearanceCount: 2, balanceAfterClearance: 450,
  customerStatus: "PARTIALLY_PAID", clearanceStatus: "PARTIALLY_CLEARED",
};

async function fixture(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
  await page.evaluate(options => {
    window.invoicePaymentSummaryFixture = { locale: "en", payment: 300, balance: 700, paidStatus: "OPEN", ...options };
    window.process = { env: { NODE_ENV: "development" } };
  }, options);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.getByText("INV-7001").first().waitFor();
  return page;
}

/** Reads the amount a totals cell shows for its label. */
const cellAmount = (page, label) => page.evaluate(label => {
  const heading = [...document.querySelectorAll("p")].find(node => node.textContent?.trim() === label);
  return heading?.nextElementSibling?.textContent?.trim() ?? null;
}, label);

const rowValue = (page, label) => page.getByText(label, { exact: true }).locator("..").locator(":scope > span").last();

test("an open invoice shows posted balance and the receipts awaiting clearance in order", async () => {
  const page = await fixture({ paymentSummary: PARTIALLY_CLEARED });
  try {
    assert.equal(await cellAmount(page, "Cost"), "$1,000.00");
    assert.equal(await cellAmount(page, "Total Paid"), "−$300.00");
    assert.equal(await rowValue(page, "Payment Status").innerText(), "Open");
    assert.equal(await rowValue(page, "Outstanding Balance").innerText(), "$700.00");
    assert.equal(await rowValue(page, "Balance to be cleared").innerText(), "$250.00");
    const status = await page.getByText("Payment Status", { exact: true }).boundingBox();
    const outstanding = await page.getByText("Outstanding Balance", { exact: true }).boundingBox();
    const pending = await page.getByText("Balance to be cleared", { exact: true }).boundingBox();
    assert.ok(status.y < outstanding.y && outstanding.y < pending.y);
    assert.equal(await page.getByText("Payment Clearance", { exact: true }).count(), 0);
  } finally { await page.close(); }
});

test("a fully pending receipt keeps the invoice open until it posts", async () => {
  const page = await fixture({ payment: 0, balance: 1000, paymentSummary: {
    ...PARTIALLY_CLEARED, totalPaid: 0, outstandingBalance: 1000, pendingClearance: 1000,
    balanceAfterClearance: 0, customerStatus: "PAID", clearanceStatus: "OUTSTANDING",
  } });
  try {
    assert.equal(await rowValue(page, "Payment Status").innerText(), "Open");
    assert.equal(await rowValue(page, "Outstanding Balance").innerText(), "$1,000.00");
    assert.equal(await rowValue(page, "Balance to be cleared").innerText(), "$1,000.00");
  } finally { await page.close(); }
});

for (const [status, balance] of [["OPEN", 300], ["CLOSED", 0]]) {
  test(`legacy ${status} invoice uses stored balance and omits pending row`, async () => {
    const page = await fixture({ paidStatus: status, balance, paymentSummary: undefined });
    try {
      assert.equal(await rowValue(page, "Outstanding Balance").innerText(), `$${balance}.00`);
      assert.equal(await page.getByText("Balance to be cleared", { exact: true }).count(), 0);
    } finally { await page.close(); }
  });
}

test("Spanish distinguishes the posted and pending amounts", async () => {
  const page = await fixture({ locale: "es", paymentSummary: PARTIALLY_CLEARED });
  try {
    assert.equal(await rowValue(page, "Saldo pendiente").innerText(), "$700.00");
    assert.equal(await rowValue(page, "Saldo por compensar").innerText(), "$250.00");
  } finally { await page.close(); }
});

test("an invoice with accounting entries offers Delete disabled and says to void it", async () => {
  const page = await fixture({ paymentSummary: PARTIALLY_CLEARED, hasAccountingEntries: true });
  const remove = page.getByRole("button", { name: "Delete", exact: true });
  assert.equal(await remove.isDisabled(), true);
  assert.equal(await page.getByText("Void the invoice instead.", { exact: false }).count(), 1);
  await page.close();
});

test("an invoice without accounting entries can still be deleted", async () => {
  const page = await fixture({ paymentSummary: undefined, payment: 0, balance: 1000, hasAccountingEntries: false });
  assert.equal(await page.getByRole("button", { name: "Delete", exact: true }).isEnabled(), true);
  assert.equal(await page.getByText("Void the invoice instead.", { exact: false }).count(), 0);
  await page.close();
});

test("users without delete permission are not told about a delete they cannot make", async () => {
  const page = await fixture({ paymentSummary: PARTIALLY_CLEARED, hasAccountingEntries: true, canDelete: false });
  assert.equal(await page.getByRole("button", { name: "Delete", exact: true }).count(), 0);
  assert.equal(await page.getByText("Void the invoice instead.", { exact: false }).count(), 0);
  await page.close();
});

test("the void-instead explanation is translated", async () => {
  const page = await fixture({ locale: "es", paymentSummary: PARTIALLY_CLEARED, hasAccountingEntries: true });
  assert.equal(await page.getByText("Anule la factura en su lugar.", { exact: false }).count(), 1);
  await page.close();
});
