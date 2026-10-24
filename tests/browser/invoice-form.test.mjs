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
      "@/components/app-shell/feedback-provider$": path.resolve("tests/browser/fixtures/feedback.tsx"),
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
  await page.locator(step === 3 ? '[id$="-description"]' : step === 2 ? "#pickupId" : "#pickupSource").first().waitFor();
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
    assert.equal(await page.locator('[role="combobox"][id="receiverId"]').count(), 1);
  } finally { await page.close(); }
});

test("a pickup with several receivers suggests them in the single receiver picker", async () => {
  const page = await fixture({ step: 2 });
  try {
    await choosePickup(page, "#102");
    await focusedId(page, "receiverId");
    assert.equal(await page.locator("#selected-receiver").textContent(), "");
    assert.equal(await page.locator("#pickupReceiverId").count(), 0);
    await page.getByText("invoices.form.placeholders.pickupReceiverSuggestions").waitFor();
    const suggestions = await page.getByRole("option").allTextContents();
    assert.equal(suggestions.length, 2);
    assert.match(suggestions[0], /Maria Receiver/);
    assert.match(suggestions[1], /Jose Receiver/);
    await page.getByRole("option", { name: /Jose Receiver/ }).getByText("Jose Receiver", { exact: true }).click();
    await page.waitForFunction(() => document.getElementById("selected-receiver")?.textContent === "receiver-jose");
    assert.equal(await page.locator("#receiverId").inputValue(), "Jose Receiver");

    await choosePickup(page, "#101");
    await page.waitForFunction(() => document.getElementById("selected-receiver")?.textContent === "receiver-maria");
  } finally { await page.close(); }
});

test("the receiver picker offers pickup receivers, a search of all receivers and adding a new one", async () => {
  const page = await fixture({ step: 2 });
  try {
    await choosePickup(page, "#102");
    await focusedId(page, "receiverId");
    await page.getByText("customers.addresses.searchAllHint").waitFor();

    await page.keyboard.type("Rec");
    await page.getByText("invoices.form.placeholders.pickupReceiverSuggestions").waitFor({ state: "detached" });

    await page.getByRole("button", { name: "invoices.form.partyActions.addReceiver" }).last().click();
    const opened = await page.evaluate(() => window.openedFormTabs ?? []);
    assert.equal(opened.length, 1);
    assert.equal(opened[0].mode, "add");
    assert.equal(opened[0].feature, "customers");
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

test("appointment routes open newest-created first and Enter picks the first route", async () => {
  const page = await fixture();
  try {
    await page.locator("#pickupSource").focus();
    await page.keyboard.press("Enter");
    await focusedId(page, "routeId");
    await page.getByRole("option").first().waitFor();
    const labels = await page.getByRole("option").allTextContents();
    assert.match(labels[0], /South route/);
    assert.match(labels[1], /North route/);

    await page.keyboard.press("Enter");
    await focusedId(page, "invoiceNumber-mode");
    assert.match(await page.locator("#routeId").inputValue(), /South route/);
  } finally { await page.close(); }
});

test("line item suggestions open newest-created first and Enter picks the first item", async () => {
  const page = await fixture({ step: 3 });
  try {
    const description = page.locator('[id$="-description"]').first();
    await description.focus();
    await page.getByRole("option").first().waitFor();
    const labels = await page.getByRole("option").allTextContents();
    assert.match(labels[0], /Flat screen TV/);
    assert.match(labels[1], /Small box/);

    await page.keyboard.press("Enter");
    assert.equal(await description.inputValue(), "Flat screen TV");
    await page.waitForFunction(() => document.activeElement?.id.endsWith("-quantity"));
  } finally { await page.close(); }
});

test("typed line item text is kept on Enter instead of picking a suggestion", async () => {
  const page = await fixture({ step: 3 });
  try {
    const description = page.locator('[id$="-description"]').first();
    await description.focus();
    await page.keyboard.type("Box");
    await page.keyboard.press("Enter");
    assert.equal(await description.inputValue(), "Box");
  } finally { await page.close(); }
});

test("Enter on a line item total adds the item and starts a new line instead of moving to Next", async () => {
  const page = await fixture({ step: 3 });
  try {
    const firstDescription = page.locator('[id$="-description"]').first();
    const firstId = (await firstDescription.getAttribute("id")).replace(/-description$/, "");
    await firstDescription.fill("Box");
    await page.locator(`[id="${firstId}-quantity"]`).fill("2");
    await page.locator(`[id="${firstId}-unitPrice"]`).fill("5");
    await page.locator(`[id="${firstId}-total"]`).press("Enter");

    await page.locator("table tbody tr", { hasText: "Box" }).waitFor({ state: "attached" });
    await page.waitForFunction((firstId) => {
      const id = document.activeElement?.id ?? "";
      return id.endsWith("-description") && id !== `${firstId}-description`;
    }, firstId);
    assert.equal(await page.locator('[id$="-description"]').first().inputValue(), "");
  } finally { await page.close(); }
});

test("clicking an added line item opens it for editing in a highlighted panel", async () => {
  const page = await fixture({ step: 3 });
  try {
    const firstDescription = page.locator('[id$="-description"]').first();
    const firstId = (await firstDescription.getAttribute("id")).replace(/-description$/, "");
    await firstDescription.fill("Box");
    await page.locator(`[id="${firstId}-quantity"]`).fill("2");
    await page.locator(`[id="${firstId}-total"]`).press("Enter");
    assert.equal(await page.locator("section[data-editing]").count(), 0);

    await page.locator("article", { hasText: "Box" }).click();
    await page.locator("section[data-editing]").waitFor();
    assert.equal(await page.locator(`[id="${firstId}-description"]`).inputValue(), "Box");
    assert.equal(await page.locator(`[id="${firstId}-quantity"]`).inputValue(), "2");
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
