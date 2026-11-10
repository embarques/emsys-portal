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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-line-items-"));
  const state = path.resolve("tests/browser/fixtures/invoice-line-items-state.ts");
  const i18n = path.resolve("tests/browser/fixtures/invoice-line-items-i18n.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    entry: path.resolve("tests/browser/fixtures/invoice-line-items.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": state,
      "@/lib/invoices/api/invoices-api$": state,
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

async function fixture(options = {}) {
  const page = await browser.newPage({ viewport: { width: options.width ?? 1280, height: 900 } });
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
  await page.evaluate(options => {
    window.invoiceLineItemsFixture = { requests: 0, failNext: false, empty: false, denied: false, companyId: "company", rowClicks: 0, rowDoubleClicks: 0, locale: "en", ...options };
    window.process = { env: { NODE_ENV: "development" } };
  }, options);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.locator("td p[title]").waitFor();
  return page;
}
const trigger = page => page.getByRole("button", { name: "View line items for invoice INV-123", exact: true });

test("line items load on demand, show details/barcodes and reuse the cache without opening the invoice row", async () => {
  const page = await fixture();
  try {
    assert.equal(await page.evaluate(() => window.invoiceLineItemsFixture.requests), 0);
    await trigger(page).click();
    const dialog = page.getByRole("dialog", { name: "Line items", exact: true });
    await dialog.getByText("Kitchen supplies and clothing", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("Small parcel", { exact: true }).count(), 1);
    assert.equal(await dialog.getByText("$25.00", { exact: true }).count(), 1);
    assert.equal(await dialog.getByText("$50.00", { exact: true }).count(), 1);
    await dialog.getByText("Small parcel", { exact: true }).dblclick();
    await dialog.getByRole("button", { name: "View 1 barcode", exact: true }).click();
    await dialog.getByText("INV-123-1", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("EN TRANSITO", { exact: true }).count(), 1);
    await page.screenshot({ path: path.join(tmpdir(), "emsys-invoice-line-items-desktop.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await trigger(page).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    const state = await page.evaluate(() => window.invoiceLineItemsFixture);
    assert.equal(state.requests, 1);
    assert.equal(state.rowClicks, 0);
    assert.equal(state.rowDoubleClicks, 0);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await trigger(page).evaluate(node => document.activeElement === node), true);
  } finally { await page.close(); }
});

test("failed detail reads support retry and empty invoices have an explicit empty state", async () => {
  const page = await fixture({ failNext: true, empty: true });
  try {
    await trigger(page).click();
    await page.getByRole("alert").getByText("Fixture invoice unavailable", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByText("No line items", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.invoiceLineItemsFixture.requests), 2);
  } finally { await page.close(); }
});

test("invoice view permission gates the action and company changes close the sheet and separate cached details", async () => {
  const denied = await fixture({ denied: true });
  try {
    assert.equal(await trigger(denied).count(), 0);
    assert.equal(await denied.evaluate(() => window.invoiceLineItemsFixture.requests), 0);
  } finally { await denied.close(); }
  const page = await fixture();
  try {
    await trigger(page).click();
    await page.getByText("Kitchen supplies and clothing", { exact: true }).waitFor();
    await page.evaluate(() => window.invoiceLineItemsFixture.changeCompany());
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await trigger(page).click();
    await page.getByText("Kitchen supplies and clothing", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.invoiceLineItemsFixture.requests), 2);
  } finally { await page.close(); }
});

test("line-item sheet fits a mobile viewport", async () => {
  const page = await fixture({ width: 390 });
  try {
    await trigger(page).click();
    await page.getByText("Kitchen supplies and clothing", { exact: true }).waitFor();
    const bounds = await page.getByRole("dialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
    const overflows = await page.getByRole("dialog").evaluate(node => node.scrollWidth > node.clientWidth);
    assert.equal(overflows, false);
    await page.screenshot({ path: path.join(tmpdir(), "emsys-invoice-line-items-mobile.png"), fullPage: true });
  } finally { await page.close(); }
});

test("line-item action and sheet are localized in Spanish", async () => {
  const page = await fixture({ locale: "es" });
  try {
    await page.getByRole("button", { name: "Ver artículos de la factura INV-123", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Artículos de la factura", exact: true });
    await dialog.getByText("Kitchen supplies and clothing", { exact: true }).waitFor();
    assert.equal(await dialog.getByText("Factura INV-123", { exact: true }).count(), 1);
    assert.equal((await dialog.textContent()).includes("{{"), false);
  } finally { await page.close(); }
});
