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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-pending-transactions-test-"));
  const hooks = path.resolve("tests/browser/fixtures/pending-transactions-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/pending-transactions.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": hooks,
      "@/lib/api/client$": hooks,
      "@/lib/api/axios$": hooks,
      "@/lib/accounting/daily-income/hooks$": hooks,
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
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => console.error("Fixture error:", error.message));
  await page.context().route("http://localhost/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://localhost/fixture");
  await page.evaluate(values => Object.assign(window, { visual: true }, values), flags);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  try { await page.getByRole("checkbox", { name: "Select R1", exact: true }).waitFor(); } catch (error) { console.error(await page.locator("body").innerText()); throw error; }
  return page;
}

test("cross-page selection uses one method, summarizes and retries with a stable request id", async () => {
  const page = await fixture({ failReconcile: true });
  try {
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    await page.getByRole("checkbox", { name: "Select R1", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select R3", exact: true }).click();
    assert.equal(await page.getByRole("checkbox", { name: "Select R3", exact: true }).isChecked(), false);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("checkbox", { name: "Select R2", exact: true }).check();
    const selected = page.getByRole("region", { name: "Selected transactions", exact: true });
    await selected.getByText("$75.00", { exact: true }).waitFor();
    assert.equal(await selected.locator("tbody tr").count(), 2);
    await selected.getByRole("button", { name: "Reconcile selected", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Reconcile all selected", exact: true }).click();
    await dialog.getByText("Temporary reconciliation failure").waitFor();
    await dialog.getByRole("button", { name: "Reconcile all selected", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const calls = await page.evaluate(() => window.calls.filter(call => call.url.endsWith("/reconcile")));
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].body.ids, ["j1", "j2"]);
    assert.equal(calls[0].body.requestId, calls[1].body.requestId);
    assert.equal(await selected.count(), 0);
  } finally { await page.close(); }
});

test("view permission allows selection and totals without reconciliation", async () => {
  const page = await fixture({ readOnly: true });
  try {
    await page.getByRole("checkbox", { name: "Select R1", exact: true }).check();
    await page.getByRole("region", { name: "Selected transactions", exact: true }).getByText("$100.00", { exact: true }).first().waitFor();
    assert.equal(await page.getByRole("button", { name: "Reconcile selected", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.calls.some(call => call.url.endsWith("/reconcile"))), false);
  } finally { await page.close(); }
});
