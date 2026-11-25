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

/** Reads the amount the clearance breakdown shows for the row starting with a label. */
const breakdownAmount = (page, label) => page.evaluate(label => {
  const term = [...document.querySelectorAll("dt")].find(node => node.textContent?.trim().startsWith(label));
  return term?.nextElementSibling?.textContent?.trim() ?? null;
}, label);

/** Reads the full label of a breakdown row, including its payment count. */
const breakdownLabel = (page, label) => page.evaluate(label => {
  const term = [...document.querySelectorAll("dt")].find(node => node.textContent?.trim().startsWith(label));
  return term?.textContent?.replace(/\s+/g, " ").trim() ?? null;
}, label);

test("the money grid reports posted figures that reconcile with the charge", async () => {
  const page = await fixture({ paymentSummary: PARTIALLY_CLEARED });
  try {
    await page.getByText("Outstanding Balance", { exact: true }).waitFor();
    // 1,000 charged less 300 cleared leaves 700 posted; pending checks are
    // reported separately rather than folded into these figures.
    assert.equal(await cellAmount(page, "Cost"), "$1,000.00");
    assert.equal(await cellAmount(page, "Total Paid"), "−$300.00");
    assert.equal(await cellAmount(page, "Outstanding Balance"), "$700.00");
  } finally {
    await page.close();
  }
});

test("several pending payments are totalled and counted with the balance after clearing", async () => {
  const page = await fixture({ paymentSummary: PARTIALLY_CLEARED });
  try {
    await page.getByText("Payments waiting to clear", { exact: true }).waitFor();
    assert.equal(await breakdownAmount(page, "Total waiting to clear"), "$250.00");
    assert.equal(await breakdownLabel(page, "Total waiting to clear"), "Total waiting to clear · 2 payments");
    assert.equal(await breakdownAmount(page, "Balance after clearing"), "$450.00");
    assert.ok(await page.getByText(/received from the client but have not cleared yet/).isVisible());
  } finally {
    await page.close();
  }
});

test("a single pending payment uses the singular count", async () => {
  const page = await fixture({ paymentSummary: { ...PARTIALLY_CLEARED, pendingClearance: 100, pendingClearanceCount: 1, balanceAfterClearance: 600 } });
  try {
    await page.getByText("Payments waiting to clear", { exact: true }).waitFor();
    assert.equal(await breakdownLabel(page, "Total waiting to clear"), "Total waiting to clear · 1 payment");
    assert.equal(await breakdownAmount(page, "Balance after clearing"), "$600.00");
  } finally {
    await page.close();
  }
});

test("client payment and payment clearance read as separate statuses", async () => {
  const page = await fixture({ paymentSummary: PARTIALLY_CLEARED });
  try {
    await page.getByText("Client Payment", { exact: true }).waitFor();
    await page.getByText("Payment Clearance", { exact: true }).waitFor();
    await page.getByText("Partially paid", { exact: true }).waitFor();
    await page.getByText("Partially cleared", { exact: true }).waitFor();
    // The posted-balance status row is unchanged.
    await page.getByText("Payment Status", { exact: true }).waitFor();
    await page.getByText("Open", { exact: true }).waitFor();
  } finally {
    await page.close();
  }
});

test("a fully pending check keeps the posted balance and clears to zero", async () => {
  const page = await fixture({
    payment: 0, balance: 1000,
    paymentSummary: { ...PARTIALLY_CLEARED, totalPaid: 0, outstandingBalance: 1000, pendingClearance: 1000, pendingClearanceCount: 1, balanceAfterClearance: 0, customerStatus: "PAID", clearanceStatus: "OUTSTANDING" },
  });
  try {
    await page.getByText("Paid", { exact: true }).waitFor();
    assert.equal(await cellAmount(page, "Total Paid"), "$0.00");
    assert.equal(await cellAmount(page, "Outstanding Balance"), "$1,000.00");
    assert.equal(await breakdownAmount(page, "Total waiting to clear"), "$1,000.00");
    assert.equal(await breakdownAmount(page, "Balance after clearing"), "$0.00");
  } finally {
    await page.close();
  }
});

test("an invoice with no pending clearance hides the breakdown entirely", async () => {
  const page = await fixture({
    payment: 1000, balance: 0, paidStatus: "CLOSED",
    paymentSummary: { ...PARTIALLY_CLEARED, totalPaid: 1000, outstandingBalance: 0, pendingClearance: 0, pendingClearanceCount: 0, balanceAfterClearance: 0, customerStatus: "PAID", clearanceStatus: "CLEARED" },
  });
  try {
    await page.getByText("Outstanding Balance", { exact: true }).waitFor();
    assert.equal(await page.getByText("Payments waiting to clear", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Balance after clearing", { exact: true }).count(), 0);
    await page.getByText("Cleared", { exact: true }).waitFor();
  } finally {
    await page.close();
  }
});

test("an API response without the summary renders the stored totals and no pending amount", async () => {
  const page = await fixture({ payment: 200, balance: 300, paymentSummary: undefined });
  try {
    await page.getByText("Outstanding Balance", { exact: true }).waitFor();
    assert.equal(await cellAmount(page, "Total Paid"), "−$200.00");
    assert.equal(await cellAmount(page, "Outstanding Balance"), "$300.00");
    assert.equal(await page.getByText("Payments waiting to clear", { exact: true }).count(), 0);
  } finally {
    await page.close();
  }
});

test("Spanish renders translated payment clearance copy", async () => {
  const page = await fixture({ locale: "es", paymentSummary: PARTIALLY_CLEARED });
  try {
    await page.getByText("Total pagado", { exact: true }).waitFor();
    await page.getByText("Saldo pendiente", { exact: true }).waitFor();
    await page.getByText("Pagos por compensar", { exact: true }).waitFor();
    assert.equal(await breakdownLabel(page, "Total por compensar"), "Total por compensar · 2 pagos");
    assert.equal(await breakdownAmount(page, "Saldo después de compensar"), "$450.00");
    await page.getByText("Pago del cliente", { exact: true }).waitFor();
    await page.getByText("Compensación parcial", { exact: true }).waitFor();
    assert.ok(await page.getByText(/aún no se han compensado/).isVisible());
  } finally {
    await page.close();
  }
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
