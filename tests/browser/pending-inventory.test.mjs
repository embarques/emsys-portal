import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let browser;
let directory;
let script;
let css;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-pending-inventory-test-"));
  const hooks = path.resolve("tests/browser/fixtures/pending-inventory-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/pending-inventory.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": hooks,
      "@/lib/api/client$": hooks,
      "@/lib/api/axios$": hooks,
      "@/components/app-shell/feedback-provider$": hooks,
      "@/lib/inventory/hooks/use-inventory$": hooks,
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/print-signatures-i18n.ts"),
      "@": path.resolve("src"),
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("tests/browser/fixtures/typescript-loader.mjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString()));
      else resolve();
    });
  }));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture(flags = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  await page.context().route("http://localhost/**", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://localhost/fixture");
  await page.evaluate((values) => Object.assign(window, { visual: true }, values), flags);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.getByText("Truck 3", { exact: true }).first().waitFor();
  return page;
}

test("lists dispatches awaiting reconciliation with their pending items", async () => {
  const page = await fixture(); try {
    assert.equal(await page.evaluate(() => window.searches.length), 1);
    await page.getByText("Small box (25), Barrel (10)", { exact: true }).waitFor();
    await page.getByText("Tape (4), Bubble wrap (4) +1 more", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Reconcile", exact: true }).count(), 2);
    await page.screenshot({ path: "/tmp/emsys-pending-inventory-list.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.getByRole("button", { name: "Reconcile", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Save reconciliation" }).waitFor();
    await page.screenshot({ path: "/tmp/emsys-pending-inventory-mobile.png" });
  } finally { await page.close(); }
});

test("reconciling validates, then posts one idempotent command per submit", async () => {
  const page = await fixture(); try {
    await page.getByRole("button", { name: "Reconcile", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Sold 5 × Small box · $60.00").waitFor();
    await dialog.getByLabel("Sold").first().fill("10");
    await dialog.getByRole("button", { name: "Save reconciliation" }).click();
    await dialog.getByText("Enter the sale revenue in USD, for example 120.00.").waitFor();
    assert.equal(await page.evaluate(() => window.reconciliations?.length ?? 0), 0);
    await dialog.getByLabel("Sale revenue (USD)").fill("120.10");
    await dialog.getByRole("button", { name: "Mark remaining as returned" }).first().click();
    assert.equal(await dialog.getByLabel("Returned").first().inputValue(), "15");
    await page.screenshot({ path: "/tmp/emsys-pending-inventory-dialog.png" });
    await dialog.locator("form").evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    await dialog.waitFor({ state: "detached" });
    const calls = await page.evaluate(() => window.reconciliations);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/inventory/dispatches/disp-1/reconciliations");
    assert.equal(calls[0].headers["Idempotency-Key"], calls[0].body.requestId);
    assert.deepEqual(calls[0].body.lines, [
      { dispatchLineId: "line-1", outcome: "SOLD", quantity: 10, revenueMinor: 12010 },
      { dispatchLineId: "line-1", outcome: "RETURNED", quantity: 15 },
    ]);
  } finally { await page.close(); }
});

test("a failed save keeps the entries and retries with the same request id", async () => {
  const page = await fixture({ failReconcile: true }); try {
    await page.getByRole("button", { name: "Reconcile", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Lost").first().fill("2");
    await dialog.getByRole("button", { name: "Save reconciliation" }).click();
    await dialog.getByText("Reconciliation failed").waitFor();
    assert.equal(await dialog.getByLabel("Lost").first().inputValue(), "2");
    await page.evaluate(() => { window.failReconcile = false; });
    await dialog.getByRole("button", { name: "Save reconciliation" }).click();
    await dialog.waitFor({ state: "detached" });
    const ids = await page.evaluate(() => window.reconciliations.map((call) => call.body.requestId));
    assert.equal(ids.length, 2);
    assert.equal(ids[0], ids[1]);
  } finally { await page.close(); }
});

test("users without the reconcile permission can only view history", async () => {
  const page = await fixture({ readOnly: true }); try {
    await page.getByRole("button", { name: "View", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("You can view this dispatch, but you do not have permission to reconcile it.").waitFor();
    assert.equal(await dialog.locator("form").count(), 0);
  } finally { await page.close(); }
});
