import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

let browser;
let directory;
let script;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-invoice-form-test-"));
  const hooks = path.resolve("tests/browser/fixtures/invoice-form-hooks.ts");
  const appointmentHooks = path.resolve("tests/browser/fixtures/appointment-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/invoice-form.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/company/hooks/use-current-company$": appointmentHooks,
      "@/lib/layout/hooks/use-workspace-tabs$": appointmentHooks,
      "@/lib/customers/hooks/use-apply-customer-on-tab-return$": appointmentHooks,
      "@/lib/orders/hooks/use-orders$": hooks,
      "@/lib/employees/hooks/use-employees$": hooks,
      "@/lib/containers/hooks/use-containers$": hooks,
      "@/lib/items/hooks/use-items$": hooks,
      "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes$": hooks,
      "@/lib/inventory/hooks/use-inventory$": path.resolve("tests/browser/fixtures/inventory-hooks.ts"),
      "@/lib/auth/hooks/use-auth$": path.resolve("tests/browser/fixtures/documents-auth.ts"),
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/i18n.ts"),
      "@/lib/branches/hooks/use-branches$": hooks,
      "@/lib/customers/hooks/use-customers$": path.resolve("tests/browser/fixtures/invoice-form-customers.ts"),
      "@/hooks/use-address-autocomplete$": path.resolve("tests/browser/fixtures/address-autocomplete.ts"),
      "@": path.resolve("src"),
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/,
      use: path.resolve("tests/browser/fixtures/typescript-loader.mjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString()));
      else resolve();
    });
  }));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture({ manualNumber = true, step = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => console.error(error));
  page.setDefaultTimeout(5000);
  await page.setContent('<div id="root"></div>');
  await page.evaluate((step) => { document.documentElement.dataset.step = String(step); }, step);
  if (!manualNumber) await page.evaluate(() => { window.readOnly = true; });
  await page.addStyleTag({ content: ".hidden {display:none}" });
  await page.addScriptTag({ content: script });
  await page.locator(step === 2 ? "#pickupId" : "#pickupSource").waitFor();
  return page;
}

async function choosePickup(page, label) {
  await page.locator("#pickupId").click();
  await page.getByRole("option", { name: new RegExp(label) }).click();
}

test("a pickup with one receiver fills that receiver without asking", async () => {
  const page = await fixture({ step: 2 });
  try {
    await choosePickup(page, "#101");
    await page.waitForFunction(() => document.getElementById("selected-receiver")?.textContent === "receiver-maria");
    assert.equal(await page.locator("#pickupReceiverId").count(), 0);
  } finally { await page.close(); }
});

test("a pickup with several receivers asks which receiver the invoice is for", async () => {
  const page = await fixture({ step: 2 });
  try {
    await choosePickup(page, "#102");
    await focusedId(page, "pickupReceiverId");
    assert.equal(await page.locator("#selected-receiver").textContent(), "");
    await page.getByRole("option", { name: /Jose Receiver/ }).click();
    await page.waitForFunction(() => document.getElementById("selected-receiver")?.textContent === "receiver-jose");

    await choosePickup(page, "#101");
    await page.waitForFunction(() => document.getElementById("selected-receiver")?.textContent === "receiver-maria");
    await page.locator("#pickupReceiverId").waitFor({ state: "detached" });
  } finally { await page.close(); }
});

const focusedId = (page, id) => page.waitForFunction((id) => document.activeElement?.id === id, id);

test("appointment route, warehouse and office employee advance to the invoice number dropdown on Enter", async () => {
  for (const [sourceIndex, assignment] of [[0, "routeId"], [1, "pickupEmployeeId"], [2, "pickupEmployeeId"]]) {
    const page = await fixture();
    try {
      await page.locator("#pickupSource").focus();
      await page.keyboard.press("ArrowDown");
      await page.getByRole("option").nth(sourceIndex).click();
      await focusedId(page, assignment);

      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await focusedId(page, "invoiceNumber-mode");

      await page.locator(`#${assignment}`).focus();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Enter");
      await focusedId(page, "invoiceNumber-mode");
    } finally { await page.close(); }
  }
});

test("without manual number permission the locked invoice number dropdown still receives focus", async () => {
  const page = await fixture({ manualNumber: false });
  try {
    await page.locator("#pickupSource").focus();
    await page.keyboard.press("ArrowDown");
    await page.getByRole("option").nth(0).click();
    await focusedId(page, "routeId");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await focusedId(page, "invoiceNumber-mode");
    assert.equal(await page.locator("#invoiceNumber-mode").isDisabled(), false);

    await page.keyboard.press("ArrowDown");
    await page.getByRole("option", { name: "invoices.form.autoNumber.modeCustom" }).click({ force: true });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#invoiceNumber-mode").textContent(), "invoices.form.autoNumber.modeSystem");
    assert.equal(await page.locator("#invoiceNumber").count(), 0);

    await page.locator("#invoiceNumber-mode").focus();
    await page.keyboard.press("Enter");
    await focusedId(page, "wizard-next");
  } finally { await page.close(); }
});

test("typing an employee name and pressing Enter selects it and focuses the invoice number dropdown", async () => {
  const page = await fixture();
  try {
    await page.locator("#pickupSource").focus();
    await page.keyboard.press("ArrowDown");
    await page.getByRole("option").nth(1).click();
    await focusedId(page, "pickupEmployeeId");
    await page.keyboard.type("Ana");
    await page.keyboard.press("Enter");
    await focusedId(page, "invoiceNumber-mode");
    assert.equal(await page.locator("#pickupEmployeeId").inputValue(), "Ana Warehouse");
  } finally { await page.close(); }
});
