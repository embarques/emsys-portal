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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-select-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/searchable-select.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
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
  await page.addScriptTag({ content: script });
  await page.locator("form").waitFor();
  const first = { comments: "#comment-purpose-0", statement: "#statement-branch", transaction: "#transaction", customer: "#sender", address: "#address" }[kind] ?? "#branch";
  await page.locator(first).waitFor();
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

test("daily income statement follows branch, date, currency, and save", async () => {
  const page = await fixture(1280, "statement");
  try {
    await page.locator("#statement-branch").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "statement-date");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "statement-currency");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.type === "submit");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("submitted").textContent === "1");
  } finally { await page.close(); }
});

test("daily income reveals and focuses exchange rate after choosing DOP", async () => {
  const page = await fixture(1280, "statement");
  try {
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
    await page.getByRole("button", { name: "Clear selection" }).dispatchEvent("pointerdown");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.activeElement.id === "statement-branch");
    assert.equal(await page.locator("#statement-branch").getAttribute("aria-invalid"), "true");
    assert.equal(await page.locator("#submitted").textContent(), "0");
  } finally { await page.close(); }
});

test("daily income expense advances across accounts and amount into payment step", async () => {
  const page = await fixture(1280, "transaction", { step: "amounts" });
  try {
    await page.locator("#journal-account").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-source");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "journal-amount");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("step").textContent === "payment");
    await page.waitForFunction(() => document.activeElement.id === "journal-payment");
  } finally { await page.close(); }
});

test("daily income check payment focuses the newly mounted bank and check fields", async () => {
  const page = await fixture(1280, "transaction", { step: "payment" });
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
    await page.locator('[aria-label="Clear selection"]').dispatchEvent("pointerdown");
    await page.waitForFunction(() => document.activeElement.id === "branch");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "plain");
  } finally { await page.close(); }
});

test("a closed preselected dropdown keeps its value and advances on one Enter", async () => {
  const page = await fixture();
  try {
    await page.locator("#branch").focus();
    await page.getByRole("button", { name: "Close options" }).click();
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
