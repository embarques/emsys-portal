import assert from "node:assert/strict";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let compactCss;
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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-select-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/searchable-select.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/inventory/hooks/use-inventory$": path.resolve("tests/browser/fixtures/inventory-hooks.ts"),
      "@/lib/employees/hooks/use-employees$": path.resolve("tests/browser/fixtures/inventory-hooks.ts"),
      "@/lib/auth/hooks/use-auth$": path.resolve("tests/browser/fixtures/documents-auth.ts"),
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/i18n.ts"),
      "@/lib/branches/hooks/use-branches$": path.resolve("tests/browser/fixtures/branches.ts"),
      "@/lib/customers/hooks/use-customers$": path.resolve("tests/browser/fixtures/customers.ts"),
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

async function fixture(width = 1280, kind = "select", settings = {}) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  page.on("pageerror", (error) => console.error(error));
  page.setDefaultTimeout(5000);
  await page.setContent('<div id="root"></div>');
  await page.evaluate((kind) => { document.documentElement.dataset.fixture = kind; }, kind);
  await page.evaluate((settings) => Object.assign(document.documentElement.dataset, settings), settings);
  await page.addStyleTag({ content: '.hidden {display:none} @media(min-width:768px) { .md\\:hidden {display:none} .md\\:block {display:block} }' });
  if (settings.styled) {
    const cssPath = path.resolve("src/app/globals.css");
    compactCss ??= (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
    await page.addStyleTag({ content: compactCss });
  }
  await page.addScriptTag({ content: script });
  if (kind === "stepper") { await page.getByRole("navigation", { name: "Appointment steps" }).waitFor(); return page; }
  if (kind === "wizard") { await page.getByTestId("transaction-wizard").waitFor(); return page; }
  await page.locator("form").waitFor();
  const first = { comments: "#comment-purpose-0", statement: "#statement-branch", transaction: "#transaction", customer: "#sender", address: "#address" }[kind] ?? "#branch";
  if (settings.quickEntry === "true") await page.getByRole("group", { name: "orders.comments.columns.purpose" }).first().waitFor();
  else await page.locator(first).waitFor();
  return page;
}

test("Enter traverses populated searchable and plain selects without changing their values", async () => {
  const page = await fixture();
  try {
    await page.locator("#first").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "branch");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "plain");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "last");
    assert.equal(await page.locator("#value").textContent(), "NY");
    assert.equal(await page.locator("#changes").textContent(), "0");
  } finally { await page.close(); }
});

test("address suggestions either accept the highlighted result or advance without changing text", async () => {
  for (const selectSuggestion of [false, true]) {
    const page = await fixture(1280, "address");
    try {
      await page.locator("#address").fill("123 Main");
      if (selectSuggestion) await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.activeElement.id === "apartment");
      assert.equal(await page.locator("#address").inputValue(), selectSuggestion ? "123 Main St" : "123 Main");
    } finally { await page.close(); }
  }
});

test("customer selection advances and optional receiver can be skipped", async () => {
  const page = await fixture(1280, "customer");
  try {
    await page.locator("#sender").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "receiver");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "after-party");
    await page.locator("#sender").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "receiver");
  } finally { await page.close(); }
});

test("customer search with no results does not trap Enter", async () => {
  const page = await fixture(1280, "customer");
  try {
    await page.locator("#sender").fill("missing");
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "receiver");
  } finally { await page.close(); }
});

test("daily income statement skips server-owned date and US currency settings", async () => {
  const page = await fixture(1280, "statement");
  try {
    await page.locator("#statement-branch").press("Enter");
    assert.equal(await page.locator("#statement-date").isDisabled(), true);
    assert.equal(await page.locator("#statement-currency").count(), 0);
    assert.equal(await page.locator("#statement-rate").count(), 0);
    await page.waitForFunction(() => document.activeElement.type === "submit");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("submitted").textContent === "1");
  } finally { await page.close(); }
});

test("daily income RD exposes exchange rate and focuses it after choosing DOP", async () => {
  const page = await fixture(1280, "statement");
  try {
    await page.locator("#statement-branch").click();
    await page.getByRole("option", { name: "RD — Dominican Republic", exact: true }).click();
    assert.equal(await page.locator("#statement-rate").isVisible(), true);
    await page.locator("#statement-currency").press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "statement-rate");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("submitted").textContent === "1");
  } finally { await page.close(); }
});

test("daily income validation focuses a missing custom branch selector", async () => {
  const page = await fixture(1280, "statement");
  try {
    await page.getByRole("button", { name: "common.ui.clearSelection" }).dispatchEvent("pointerdown");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.activeElement.id === "statement-branch");
    assert.equal(await page.locator("#statement-branch").getAttribute("aria-invalid"), "true");
    assert.equal(await page.locator("#submitted").textContent(), "0");
  } finally { await page.close(); }
});

test("daily income expense advances across accounts, amount and description into review", async () => {
  const page = await fixture(1280, "transaction", { step: "amounts" });
  try {
    assert.equal(await page.locator("#journal-payment").count(), 0);
    await page.locator("#journal-account").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-source");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-amount");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-description");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("step").textContent === "review");
  } finally { await page.close(); }
});

test("daily income check payment focuses the newly mounted bank and check fields", async () => {
  const page = await fixture(1280, "transaction", { step: "payment", transactionType: "SALES" });
  try {
    await page.locator("#journal-payment").fill("CHECK");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-bank-account");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-check-number");
    await page.keyboard.press("Enter");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.activeElement.id === "journal-check-number");
    assert.equal(await page.locator("#step").textContent(), "payment");
  } finally { await page.close(); }
});

test("pickup starts with one draft without stealing focus and Enter completes an item comment", async () => {
  const page = await fixture(1280, "comments");
  try {
    assert.equal(await page.evaluate(() => document.activeElement.id), "before-comments");
    assert.equal(await page.locator("#comments-value").textContent(), "[]");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "comment-purpose-0");
    await page.locator("#comment-purpose-0").fill("PICKUP");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "comment-item-0");
    await page.locator("#comment-item-0").fill("box");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "comment-quantity-0");
    await page.locator("#comment-quantity-0").fill("2");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "comment-purpose-1");
    const comments = JSON.parse(await page.locator("#comments-value").textContent());
    assert.equal(comments.length, 1);
    assert.equal(comments[0].quantity, "2");
    await page.locator("#new-record").click();
    await page.locator("#comment-purpose-0").waitFor();
    assert.equal(await page.locator("#comments-value").textContent(), "[]");
  } finally { await page.close(); }
});

test("pickup comment purpose advances to text and Enter retains the completed note", async () => {
  const page = await fixture(1280, "comments");
  try {
    await page.keyboard.press("Enter");
    await page.locator("#comment-purpose-0").fill("OTHER");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "comment-note-0");
    await page.locator("#comment-note-0").fill("Call before arriving");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "comment-purpose-1");
    const comments = JSON.parse(await page.locator("#comments-value").textContent());
    assert.equal(comments.length, 1);
    assert.equal(comments[0].description, "Call before arriving");
  } finally { await page.close(); }
});

test("closed cmdk input advances instead of swallowing Enter", async () => {
  const page = await fixture();
  try {
    await page.locator("#branch").focus();
    await page.keyboard.press("Escape");
    await page.locator('[aria-label="common.ui.clearSelection"]').dispatchEvent("pointerdown");
    await page.waitForFunction(() => document.activeElement.id === "branch");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "plain");
  } finally { await page.close(); }
});

test("a closed preselected dropdown keeps its value and advances on one Enter", async () => {
  const page = await fixture();
  try {
    await page.locator("#branch").focus();
    await page.getByRole("button", { name: "common.ui.closeOptions" }).click();
    assert.equal(await page.locator("#branch").getAttribute("aria-expanded"), "false");
    await page.locator("#branch").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "plain");
    assert.equal(await page.locator("#value").textContent(), "NY");
    assert.equal(await page.locator("#changes").textContent(), "0");
  } finally { await page.close(); }
});

test("typing or arrows selects a different option and advances", async () => {
  for (const mode of ["typing", "arrows"]) {
    const page = await fixture();
    try {
      await page.locator("#branch").focus();
      if (mode === "typing") await page.locator("#branch").fill("RD");
      else await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.activeElement.id === "plain");
      assert.equal(await page.locator("#value").textContent(), "RD");
      assert.equal(await page.locator("#changes").textContent(), "1");
    } finally { await page.close(); }
  }
});

test("no matches does not trap focus or erase the existing selection", async () => {
  const page = await fixture();
  try {
    await page.locator("#branch").focus();
    await page.locator("#branch").fill("no matching branch");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "plain");
    assert.equal(await page.locator("#value").textContent(), "NY");
  } finally { await page.close(); }
});

test("plain dropdown closing does not steal focus back from the next field", async () => {
  const page = await fixture();
  try {
    await page.locator("#plain").click();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "last");
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.activeElement.id), "last");
  } finally { await page.close(); }
});

test("mobile selection does not advance to another field", async () => {
  const page = await fixture(390);
  try {
    await page.locator("#branch").focus();
    await page.locator("#branch").fill("RD");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#value").textContent(), "RD");
    assert.notEqual(await page.evaluate(() => document.activeElement.id), "plain");
    assert.notEqual(await page.evaluate(() => document.activeElement.id), "last");
  } finally { await page.close(); }
});

test("desktop search keeps accepting characters after the first keystroke", async () => {
  const page = await fixture();
  try {
    const input = page.locator("#branch");
    await input.click();
    await input.press("ControlOrMeta+A");
    await page.keyboard.type("RD", { delay: 120 });
    assert.equal(await input.inputValue(), "RD");
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
  } finally { await page.close(); }
});

test("quick invoice entry advances from cost to amount before saving", async () => {
  const page = await fixture(1280, "transaction", { step: "amounts", transactionType: "INITIAL-PAYMENT", quickEntry: "true" });
  try {
    assert.equal(await page.locator("#journal-payment").isVisible(), true);
    await page.locator("#journal-auto-invoice-number").uncheck();
    await page.locator("#journal-invoice-number").fill("80424");
    await page.locator("#journal-invoice-cost").fill("200");
    await page.locator("#journal-invoice-cost").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-amount");
    assert.equal(await page.locator("#submitted").textContent(), "0");
    await page.locator("#journal-amount").fill("150");
    await page.locator("#journal-amount").press("Enter");
    await page.waitForFunction(() => document.getElementById("submitted").textContent === "1");
    assert.equal(await page.locator("#step").textContent(), "amounts");
  } finally { await page.close(); }
});

test("existing stepped invoice form keeps payment selection in its own step", async () => {
  const page = await fixture(1280, "transaction", { step: "amounts", transactionType: "INITIAL-PAYMENT" });
  try {
    assert.equal(await page.locator("#journal-payment").isVisible(), false);
    await page.locator("#journal-invoice-cost").fill("200");
    await page.locator("#save").click();
    await page.waitForFunction(() => document.getElementById("step").textContent === "payment");
    assert.equal(await page.locator("#journal-payment").isVisible(), true);
    assert.equal(await page.locator("#submitted").textContent(), "0");
  } finally { await page.close(); }
});


for (const width of [1280, 390]) {
  test(`register payment covers existing and new invoices at ${width}px`, async () => {
    const page = await fixture(width, "wizard", { styled: true });
    try {
      const next = page.getByRole("button", { name: "common.actions.next", exact: true });
      const valueOf = (id) => page.locator(`#${id}`).evaluate(el => el instanceof HTMLInputElement ? el.value : el.textContent);
      assert.equal(await page.getByRole("radio", { name: /accounting\.dailyIncome\.transactionTypes\.initialPayment/ }).count(), 0);
      await page.getByRole("radio", { name: /accounting\.dailyIncome\.transactionTypes\.payment\.label/ }).click();
      assert.equal(await page.locator("#journal-employee").isVisible(), true);
      await page.locator("#journal-employee").click();
      await page.getByRole("option", { name: /Maria/ }).click();
      await next.click();
      assert.equal(await page.locator("#journal-employee").isVisible(), false);
      assert.equal(await page.locator("#journal-payment").isVisible(), false);
      assert.equal(await page.locator("nav button").count(), 5);

      assert.equal(await page.locator("#journal-invoice-mode-existing").getAttribute("aria-checked"), "true");
      assert.equal(await page.locator("#journal-invoice-cost").count(), 0);
      await page.locator("#journal-invoice").click();
      await page.getByRole("option", { name: /80430/ }).click();
      assert.equal(await valueOf("journal-invoice-sender"), "Ana Sender");
      assert.equal(await valueOf("journal-invoice-receiver"), "Luis Receiver");
      assert.match(await valueOf("journal-invoice-total"), /200\.00/);
      assert.match(await valueOf("journal-invoice-discount"), /20\.00/);
      assert.match(await valueOf("journal-invoice-paid"), /50\.00/);
      assert.match(await valueOf("journal-invoice-balance"), /130\.00/);
      for (const id of ["journal-invoice-sender", "journal-invoice-total", "journal-invoice-discount", "journal-invoice-paid", "journal-invoice-balance"]) {
        assert.equal(await page.locator(`#${id}`).getAttribute("readonly"), "", id);
      }
      assert.equal(await page.locator("#journal-amount").isEditable(), true);

      await page.locator("#journal-invoice-mode-new").click();
      assert.equal(await page.locator("#journal-invoice-mode-new").getAttribute("aria-checked"), "true");
      assert.equal(await page.locator("#journal-invoice").count(), 0);
      assert.equal(await page.locator("#journal-invoice-discount").isEditable(), true);

      for (const id of ["journal-invoice-number-mode", "journal-skip-sender", "journal-skip-receiver", "journal-invoice-cost", "journal-invoice-discount", "journal-amount", "journal-invoice-balance"]) {
        assert.equal(await page.locator(`#${id}`).isVisible(), true, id);
      }
      assert.equal(await page.locator("#journal-invoice-number-mode-system").getAttribute("aria-checked"), "true");
      assert.equal(await page.locator("#journal-skip-sender").isChecked(), true);
      assert.equal(await page.locator("#journal-skip-receiver").isChecked(), true);
      assert.equal(await page.locator("#journal-sender").count(), 0);
      assert.equal(await page.locator("#journal-receiver").count(), 0);
      await page.locator("#journal-skip-sender").click();
      assert.equal(await page.locator("#journal-skip-sender").isChecked(), false);
      assert.equal(await page.locator("#journal-sender").isVisible(), true);
      await page.locator("#journal-skip-sender").click();
      assert.equal(await page.locator("#journal-sender").count(), 0);
      const skipSenderBox = await page.locator("#journal-skip-sender").boundingBox();
      const skipReceiverBox = await page.locator("#journal-skip-receiver").boundingBox();
      const costBox = await page.locator("#journal-invoice-cost").boundingBox();
      const discountBox = await page.locator("#journal-invoice-discount").boundingBox();
      const amountBox = await page.locator("#journal-amount").boundingBox();
      const balanceBox = await page.locator("#journal-invoice-balance").boundingBox();
      assert.ok(Math.abs(skipSenderBox.y - skipReceiverBox.y) < 1);
      assert.ok(costBox.y > skipSenderBox.y);
      const amountHeadingBox = await page.getByText("accounting.dailyIncome.form.sections.invoiceAmount", { exact: true }).boundingBox();
      assert.ok(amountHeadingBox.y > skipSenderBox.y && amountHeadingBox.y < costBox.y);
      assert.ok(Math.abs(costBox.y - discountBox.y) < 1 && costBox.x < discountBox.x);
      if (width >= 640) {
        assert.ok(Math.abs(discountBox.y - amountBox.y) < 1 && Math.abs(amountBox.y - balanceBox.y) < 1);
        assert.ok(discountBox.x < amountBox.x && amountBox.x < balanceBox.x);
      } else {
        assert.ok(amountBox.y > costBox.y && Math.abs(amountBox.y - balanceBox.y) < 1);
      }

      await page.locator("#journal-invoice-cost").fill("200");
      await page.locator("#journal-invoice-discount").fill("20");
      await page.locator("#journal-amount").fill("150");
      assert.match(await page.locator("#journal-invoice-balance").inputValue(), /30\.00/);
      await next.click();

      assert.equal(await page.locator("#journal-invoice-cost").isVisible(), false);
      assert.equal(await page.locator("#journal-description").isVisible(), true);
      await page.locator("#journal-payment").click();
      await page.getByRole("option", { name: "CHECK", exact: true }).click();
      await next.click();
      assert.equal(await page.locator("#journal-bank-account").isVisible(), true);
      await page.locator("#journal-bank-account").click();
      await page.getByRole("option", { name: /Bank/ }).click();
      await page.locator("#journal-check-number").fill("123456");
      await next.click();

      const save = page.getByRole("button", { name: "accounting.dailyIncome.wizard.saveTransaction", exact: true });
      await save.waitFor();
      assert.equal(await page.locator("#submitted").textContent(), "0");
      await save.click();
      await page.waitForFunction(() => document.getElementById("submitted").textContent === "1");
      assert.match(await page.locator("#journal-payment").evaluate(el => el instanceof HTMLInputElement ? el.value : el.textContent), /CHECK/);
      assert.match(await page.locator("#journal-employee").evaluate(el => el instanceof HTMLInputElement ? el.value : el.textContent), /Maria/);
      assert.equal(await page.locator("#journal-check-number").inputValue(), "");
      assert.equal(await page.locator("#journal-invoice-cost").isVisible(), true);
      assert.equal(await page.locator("#journal-invoice-mode-new").getAttribute("aria-checked"), "true");
      assert.equal(await page.locator("#journal-employee").isVisible(), false);
    } finally { await page.close(); }
  });
}

test("assigned to switches between employee and daily route segments", async () => {
  const page = await fixture(1280, "wizard", { styled: true });
  try {
    await page.getByRole("radio", { name: /accounting\.dailyIncome\.transactionTypes\.payment\.label/ }).click();
    const employeeSegment = page.locator("#journal-employee-source-employee");
    const routeSegment = page.locator("#journal-employee-source-route");
    assert.equal(await employeeSegment.getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("#journal-employee").isVisible(), true);
    await routeSegment.click();
    assert.equal(await routeSegment.getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("#journal-route").isVisible(), true);
    assert.equal(await page.locator("#journal-employee").count(), 0);
    await employeeSegment.click();
    assert.equal(await page.locator("#journal-employee").isVisible(), true);
    assert.equal(await page.locator("#journal-route").count(), 0);
  } finally { await page.close(); }
});

test("transaction step errors show in the footer between Previous and Cancel", async () => {
  const page = await fixture(1280, "wizard", { styled: true });
  try {
    await page.getByRole("radio", { name: /accounting\.dailyIncome\.transactionTypes\.payment\.label/ }).click();
    await page.locator("#journal-employee").click();
    await page.getByRole("option", { name: /Maria/ }).click();
    const next = page.getByRole("button", { name: "common.actions.next", exact: true });
    await next.click();
    await next.click();
    const alert = page.locator('p[role="alert"][title]');
    await alert.waitFor();
    assert.match(await alert.textContent(), /invoiceRequired/);
    const previousBox = await page.getByRole("button", { name: "common.actions.previous", exact: true }).boundingBox();
    const cancelBox = await page.getByRole("button", { name: "common.actions.cancel", exact: true }).boundingBox();
    const alertBox = await alert.boundingBox();
    assert.ok(alertBox.x >= previousBox.x + previousBox.width && alertBox.x + alertBox.width <= cancelBox.x);
    assert.ok(alertBox.y < previousBox.y + previousBox.height && alertBox.y + alertBox.height > previousBox.y);
    await page.getByRole("button", { name: "common.actions.previous", exact: true }).click();
    assert.equal(await alert.count(), 0);
  } finally { await page.close(); }
});

test("changing transaction type in step 1 preserves the selected employee and payment method", async () => {
  const page = await fixture(1280, "wizard");
  try {
    await page.getByRole("radio").first().click();
    await page.locator("#journal-employee").fill("Maria");
    await page.locator("#journal-employee").press("Enter");
    await page.getByRole("button", { name: "common.actions.next", exact: true }).click();
    await page.locator("#journal-invoice-mode-new").click();
    await page.locator("#journal-invoice-cost").fill("100");
    await page.getByRole("button", { name: "common.actions.next", exact: true }).click();
    await page.locator("#journal-payment").click();
    await page.getByRole("option", { name: "CHECK", exact: true }).click();

    await page.getByRole("button", { name: "common.actions.previous", exact: true }).first().click();
    await page.getByRole("button", { name: "common.actions.previous", exact: true }).first().click();
    await page.getByRole("button", { name: "common.actions.previous", exact: true }).first().click();
    await page.getByRole("radio").nth(1).click();
    assert.equal(await page.locator("#journal-employee").inputValue(), "Maria");
    await page.getByRole("button", { name: "common.actions.next", exact: true }).click();
    await page.locator("nav button").first().click();
    await page.getByRole("radio").first().click();
    assert.equal(await page.locator("#journal-employee").inputValue(), "Maria");
    await page.getByRole("button", { name: "common.actions.next", exact: true }).click();
    assert.equal(await page.locator("#journal-payment").inputValue(), "CHECK");

  } finally { await page.close(); }
});

for (const transactionType of ["INITIAL-PAYMENT", "PAYMENT", "EXPENSE", "SALES", "DISCOUNT", "SURCHARGE", "TRANSFER", "LOAN", "INVENTORY"]) {
  test(`Enter saves ${transactionType} from review`, async () => {
    const page = await fixture(1280, "transaction", { step: "review", transactionType, ready: "true" });
    try {
      await page.waitForFunction(() => document.activeElement?.id === "save");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.getElementById("submitted").textContent === "1");
    } finally { await page.close(); }
  });
}


for (const transactionType of ["INITIAL-PAYMENT", "PAYMENT", "EXPENSE", "SALES", "DISCOUNT", "SURCHARGE", "TRANSFER", "INVENTORY"]) {
  const hasPaymentStep = !["INVENTORY", "SURCHARGE", "EXPENSE"].includes(transactionType);
  for (const step of hasPaymentStep ? ["assignment", "amounts", "payment"] : ["assignment", "amounts"]) {
    test(`Enter completes ${transactionType} ${step} and moves to the next step`, async () => {
      const page = await fixture(1280, "transaction", { step, transactionType, ready: "true" });
      try {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const last = await page.locator("#transaction").evaluate(form => {
          const fields = [...form.querySelectorAll("input:not([type=hidden]),select,textarea,[role=combobox]")].filter(el => !el.disabled && (!el.readOnly || el.getAttribute("role") === "combobox") && !el.closest('[aria-hidden="true"], [inert]') && el.tabIndex >= 0 && el.getClientRects().length > 0);
          return fields.at(-1)?.id;
        });
        assert.ok(last, "Expected a visible final field");
        await page.locator(`#${last}`).focus();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        await page.locator(`#${last}`).press("Enter");
        if (await page.locator("#step").textContent() === step) {
          await page.waitForFunction(() => document.activeElement?.id === "save");
          await page.keyboard.press("Enter");
        }
        const next = step === "assignment" ? "amounts" : step === "amounts" && hasPaymentStep ? "payment" : "review";
        await page.waitForFunction(next => document.getElementById("step").textContent === next, next);
        assert.equal(await page.locator("#submitted").textContent(), "0");
      } finally { await page.close(); }
    });
  }
}


test("appointment quick comments use clicks, preserve notes, and prevent duplicate items on desktop and mobile", async () => {
  for (const width of [1280, 390]) {
    const page = await fixture(width, "comments", { quickEntry: "true" });
    try {
      await page.getByRole("button", { name: "orders.comments.purposes.PAYMENT", exact: true }).click();
      await page.locator("#quick-comment-note-0").fill("Ring the bell");
      await page.getByRole("button", { name: "orders.comments.purposes.PAYMENT", exact: true }).click();
      assert.equal(await page.locator("#quick-comment-note-0").inputValue(), "Ring the bell");
      await page.locator("#quick-comment-note-0").press("Enter");
      await page.getByRole("button", { name: "orders.comments.purposes.PICKUP", exact: true }).click();
      await page.getByRole("button", { name: "orders.comments.items.box", exact: true }).click();
      assert.equal(await page.locator("#quick-comment-note-1").count(), 0);
      await page.locator("#quick-comment-quantity-1").fill("3");
      await page.locator("#quick-comment-quantity-1").press("Enter");
      await page.getByRole("button", { name: "orders.comments.purposes.PICKUP", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "orders.comments.items.box", exact: true }).isDisabled(), true);
      await page.getByRole("button", { name: "orders.comments.items.barrel", exact: true }).click();
      const comments = JSON.parse(await page.locator("#comments-value").textContent());
      assert.equal(comments.length, 3);
      assert.equal(comments[0].description, "Ring the bell");
      assert.equal(comments[1].quantity, "3");
      assert.equal(comments[2].itemType, "barrel");
    } finally { await page.close(); }
  }
});


test("shared workflow stepper shows three appointment steps and preserves invoice navigation", async () => {
  const page = await fixture(1280, "stepper");
  try {
    const appointment = page.getByRole("navigation", { name: "Appointment steps" });
    assert.equal(await appointment.locator("li").count(), 3);
    assert.match(await appointment.locator('[aria-current="step"]').textContent(), /3Date and purpose/);
    assert.equal(await appointment.locator("li svg").count(), 2);
    await appointment.getByRole("button", { name: "Go to Receivers" }).click();
    assert.match(await appointment.locator('[aria-current="step"]').textContent(), /2Receivers/);
    assert.equal(await appointment.getByRole("button").count(), 1);
    const invoice = page.getByRole("navigation", { name: "invoices.wizard.navAriaLabel" });
    assert.equal(await invoice.locator("li").count(), 4);
    assert.match(await invoice.locator('[aria-current="step"]').textContent(), /^3/);
    await invoice.getByRole("button").first().click();
    assert.match(await invoice.locator('[aria-current="step"]').textContent(), /^1/);
  } finally { await page.close(); }
});


test("appointment step buttons allow valid forward jumps and disable invalid destinations", async () => {
  const page = await fixture(1280, "stepper", { traverse: "true" });
  try {
    const nav = page.getByRole("navigation", { name: "Appointment steps" });
    const purpose = nav.getByRole("button", { name: "Go to Date and purpose" });
    assert.equal(await purpose.isDisabled(), true);
    await nav.getByRole("button", { name: "Go to Receivers" }).click();
    await page.getByRole("button", { name: "Toggle prerequisites" }).click();
    await purpose.click();
    assert.match(await nav.locator('[aria-current="step"]').textContent(), /3Date and purpose/);
    await nav.getByRole("button", { name: "Go to Sender" }).click();
    assert.equal(await purpose.isEnabled(), true);
    await page.getByRole("button", { name: "Toggle prerequisites" }).click();
    assert.equal(await purpose.isDisabled(), true);
  } finally { await page.close(); }
});


test("autofocused pickup reference skips Enter until typing or arrow navigation", async () => {
  for (const interaction of ["none", "ArrowDown", "ArrowUp", "typing", "click"]) {
    const page = await fixture(1280, "pickup-reference");
    try {
      await page.waitForFunction(() => document.activeElement?.id === "branch");
      await page.getByRole("option", { name: "Pickup one", exact: true }).waitFor();
      if (interaction === "typing") await page.locator("#branch").fill("Pickup two");
      else if (interaction === "click") await page.getByRole("option", { name: "Pickup one", exact: true }).click();
      else if (interaction !== "none") await page.keyboard.press(interaction);
      if (interaction !== "click") await page.keyboard.press("Enter");
      if (interaction === "none") {
        await page.waitForFunction(() => document.activeElement?.id === "sender");
        assert.equal(await page.locator("#value").textContent(), "");
        assert.equal(await page.locator("#changes").textContent(), "0");
      } else {
        assert.equal(await page.locator("#changes").textContent(), "1");
        assert.match(await page.locator("#value").textContent(), /^pickup-/);
        if (interaction === "typing") assert.equal(await page.locator("#value").textContent(), "pickup-2");
      }
    } finally { await page.close(); }
  }
});
