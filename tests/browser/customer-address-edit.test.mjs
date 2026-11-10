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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-address-edit-"));
  const state = path.resolve("tests/browser/fixtures/customer-address-edit-state.ts");
  const i18n = path.resolve("tests/browser/fixtures/customer-address-edit-i18n.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    entry: path.resolve("tests/browser/fixtures/customer-address-edit.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": state,
      "@/lib/customers/hooks/use-customers$": state,
      "@/lib/layout/hooks/use-workspace-tabs$": state,
      "@/components/app-shell/feedback-provider$": state,
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
  const page = await browser.newPage({ viewport: { width: options.width ?? 1280, height: 800 } });
  await page.setContent('<html><body><div id="root"></div></body></html>');
  await page.evaluate(options => {
    window.customerAddressFixture = { denied: false, verified: false, receiver: false, empty: false, locale: "en", rowClicks: 0, rowDoubleClicks: 0, opened: [], ...options };
    window.process = { env: { NODE_ENV: "development" } };
  }, options);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.locator("td").waitFor();
  return page;
}
const trigger = page => page.getByRole("button", { name: "Edit unverified address: Primary for Fixture Client", exact: true });

test("primary shortcut uses the content index in API order and stops row clicks and double clicks", async () => {
  const page = await fixture();
  try {
    await trigger(page).dblclick();
    const state = await page.evaluate(() => window.customerAddressFixture);
    assert.ok(state.opened.length > 0);
    for (const opened of state.opened) {
      assert.equal(opened.entityId, "customer-1");
      assert.equal(opened.focusAddressIndex, 1, "Skip empty address and preserve API order despite primary-first display");
      assert.equal(opened.customerFormIntent, undefined, "Never append an address when editing an existing one");
    }
    assert.equal(state.rowClicks, 0);
    assert.equal(state.rowDoubleClicks, 0);
    await page.screenshot({ path: path.join(tmpdir(), "emsys-customer-address-edit-desktop.png"), fullPage: true });
  } finally { await page.close(); }
});

test("secondary address shortcut in the sheet focuses that address and closes the sheet", async () => {
  const page = await fixture();
  try {
    await page.getByRole("button", { name: "2 addresses", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const action = dialog.getByRole("button", { name: "Edit unverified address: Other for Fixture Client", exact: true });
    await action.focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    const opened = await page.evaluate(() => window.customerAddressFixture.opened);
    assert.equal(opened.length, 1);
    assert.equal(opened[0].focusAddressIndex, 0);
    assert.equal(opened[0].customerFormIntent, undefined);
  } finally { await page.close(); }
});

test("read-only customers show status without offering edit navigation", async () => {
  const page = await fixture({ denied: true });
  try {
    assert.equal(await trigger(page).count(), 0);
    await page.getByRole("img", { name: "Unverified", exact: true }).waitFor();
    await page.getByRole("button", { name: "2 addresses", exact: true }).click();
    const dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByRole("img", { name: "Unverified", exact: true }).count(), 2);
    assert.equal(await dialog.getByRole("button", { name: /Edit unverified/ }).count(), 0);
    assert.equal(await page.evaluate(() => window.customerAddressFixture.opened.length), 0);
  } finally { await page.close(); }
});

test("customer details address list opens the exact selected address and closes the view", async () => {
  for (const [label, index] of [["Primary", 1], ["Other", 0]]) {
    const page = await fixture();
    try {
      await page.getByRole("button", { name: "View customer", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const action = dialog.getByRole("button", { name: `Edit unverified address: ${label} for Fixture Client`, exact: true });
      await action.focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      const opened = await page.evaluate(() => window.customerAddressFixture.opened);
      assert.equal(opened.length, 1);
      assert.equal(opened[0].entityId, "customer-1");
      assert.equal(opened[0].focusAddressIndex, index);
      assert.equal(opened[0].customerFormIntent, undefined);
    } finally { await page.close(); }
  }
});

test("customer details address list respects edit permission and verification status", async () => {
  for (const options of [{ denied: true }, { receiver: true }, { verified: true }]) {
    const page = await fixture(options);
    try {
      await page.getByRole("button", { name: "View customer", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(await dialog.getByRole("button", { name: /Edit unverified address: Primary/ }).count(), 0);
      assert.equal(await dialog.getByRole("button", { name: /Edit unverified/ }).count(), options.verified ? 1 : 0);
      assert.equal(await dialog.getByRole("img", { name: "Unverified", exact: true }).count(), options.denied ? 2 : 0);
      assert.equal(await page.evaluate(() => window.customerAddressFixture.opened.length), 0);
    } finally { await page.close(); }
  }
});

test("verified primary, receivers, and empty addresses do not show an unverified primary shortcut", async () => {
  for (const options of [{ verified: true }, { receiver: true }, { empty: true }]) {
    const page = await fixture(options);
    try {
      assert.equal(await trigger(page).count(), 0);
      assert.equal(await page.getByRole("img", { name: "Unverified", exact: true }).count(), 0);
    } finally { await page.close(); }
  }
});

test("Spanish shortcut supports keyboard navigation on mobile", async () => {
  const page = await fixture({ locale: "es", width: 390 });
  try {
    const action = page.getByRole("button", { name: "Editar dirección no verificada: Principal de Fixture Client", exact: true });
    await action.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.customerAddressFixture.opened[0].focusAddressIndex), 1);
    assert.equal(await page.locator("main").evaluate(node => node.scrollWidth > node.clientWidth), false);
  } finally { await page.close(); }
});

