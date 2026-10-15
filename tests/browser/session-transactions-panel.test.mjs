import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { before, after, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import ts from "typescript";

const require = createRequire(import.meta.url);
const catalogs = { inventory: JSON.parse(readFileSync("src/locales/es/inventory.json", "utf8")), accounting: JSON.parse(readFileSync("src/locales/es/accounting.json", "utf8")), invoices: JSON.parse(readFileSync("src/locales/es/invoices.json", "utf8")) };
const translate = (key, params = {}) => {
 const text = key.split(".").reduce((value, part) => value?.[part], catalogs);
 assert.equal(typeof text, "string", `Missing translation ${key}`);
 return text.replace(/{{(\w+)}}/g, (_, key) => String(params[key]));
};
const cache = new Map();
function load(filename) {
 if (cache.has(filename)) return cache.get(filename);
 const module = { exports: {} };
 cache.set(filename, module.exports);
 const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
 function localRequire(name) {
  if (name === "@/lib/i18n") return { useTranslation: () => ({ t: translate }) };
  if (name === "@/hooks/use-form-viewport") return { useFormViewport: () => React.createRef() };
  if (name.startsWith("@/") || name.startsWith(".")) {
   const target = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(filename), name);
   const resolved = [target + ".ts", target + ".tsx"].find(file => { try { readFileSync(file); return true; } catch { return false; } });
   return load(resolved);
  }
  return require(name);
 }
 new Function("require", "module", "exports", source)(localRequire, module, module.exports);
 return module.exports;
}
const { SessionTransactionsLayout } = load(path.resolve("src/components/accounting/session-transactions-panel.tsx"));
const entries = Array.from({ length: 30 }, (_, index) => ({ journal: { id: String(index), transactionType: "INITIAL-PAYMENT", amount: 150, invoice: { number: String(80423 - index), cost: 200, balance: 50 }, paymentMethod: { name: "CASH" } }, values: {}, statementId: 32676, savedAt: index }));
let browser, css;
before(async () => {
 browser = await chromium.launch();
 css = (await postcss([tailwind()]).process('@import "tailwindcss";', { from: path.resolve("src/app/test-panel.css") })).css;
});
after(async () => { await browser?.close(); });

test("desktop list scrolls independently while totals remain visible; panel is hidden on mobile", async () => {
 const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
 try {
  const markup = renderToStaticMarkup(React.createElement(SessionTransactionsLayout, { entries, currency: "USD" }, React.createElement("div", { id: "wizard", style: { height: "560px" } }, "Wizard existente")));
  await page.setContent(`<style>${css}</style><div style="padding:20px;--form-viewport-inset:40px">${markup}</div>`);
  const panel = page.getByRole("complementary", { name: "Mis transacciones" });
  await panel.waitFor({ state: "visible" });
  // Match useFormViewport after the desktop toolbar changes the grid top offset.
  await panel.evaluate(el => { const grid = el.parentElement.parentElement; grid.style.setProperty("--form-viewport-inset", `${grid.getBoundingClientRect().top + 20}px`); });
  const list = page.getByRole("region", { name: "Transacciones guardadas" });
  const footer = panel.locator("footer");
  const original = await footer.boundingBox();
  assert.ok(original.y + original.height <= 900);
  const main = await page.locator("#wizard").boundingBox();
  const right = await panel.boundingBox();
  assert.equal(right.height, main.height);
  assert.equal(right.y, main.y);
  const bottomSpace = await panel.evaluate(el => {
    const grid = el.parentElement.parentElement;
    return grid.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
  });
  assert.equal(bottomSpace, 128);
  await page.locator("#wizard").evaluate(el => { el.style.height = "650px"; });
  assert.equal((await panel.boundingBox()).height, 650);
  await page.locator("#wizard").evaluate(el => { el.style.height = "560px"; });
  assert.ok(await list.evaluate(el => el.scrollHeight > el.clientHeight));
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  assert.ok(await list.evaluate(el => el.scrollTop > 0));
  assert.deepEqual(await footer.boundingBox(), original);
  assert.ok((await footer.innerText()).includes("$6,000.00"));
  assert.ok((await panel.innerText()).includes("Efectivo"));
  assert.equal(await page.locator("#wizard").count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await panel.isVisible(), false);
  assert.equal(await page.locator("#wizard").isVisible(), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  const inactive = renderToStaticMarkup(React.createElement(SessionTransactionsLayout, { entries, currency: "USD", active: false }, React.createElement("div", { id: "wizard" }, "Select transaction type")));
  await page.setContent(`<style>${css}</style>${inactive}`);
  assert.equal(await page.getByRole("complementary", { name: "Mis transacciones" }).isVisible(), false);
  assert.equal(await page.getByRole("button", { name: "Mostrar transacciones" }).count(), 0);
  assert.equal(await page.locator("#wizard").isVisible(), true);
 } finally { await page.close(); }
});

test("each transaction type renders its relevant summary without invoice client details", () => {
 const types = ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE", "EXPENSE", "SALES", "TRANSFER", "INVENTORY", "LOAN"];
 const mixed = types.map((type, index) => ({ ...entries[0], journal: { ...entries[0].journal, id: String(index), transactionType: type, account: { name: "Cuenta de ejemplo" }, sourceAccount: { name: "Banco de origen" }, inventoryItemName: "Cinta", inventoryQuantity: 2, inventoryDirection: "received", invoice: { ...entries[0].journal.invoice, sender: { name: "NO MOSTRAR CLIENTE" } } } }));
 const markup = renderToStaticMarkup(React.createElement(SessionTransactionsLayout, { entries: mixed, currency: "USD" }, "Wizard"));
 assert.ok(markup.includes("Cinta"));
 assert.ok(markup.includes("Banco de origen"));
 assert.ok(!markup.includes("NO MOSTRAR CLIENTE"));
});
