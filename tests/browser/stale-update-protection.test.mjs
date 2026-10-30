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
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/stale-update-protection.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/i18n.ts"),
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

for (const resource of ["invoice", "customer"]) {
  test(`${resource} editor retains draft and original revision after background refresh and conflict`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent('<div id="root"></div>');
      await page.addScriptTag({ content: script });
      await page.locator("input").fill("My unsaved changes");
      await page.getByRole("button", { name: "Background refresh" }).click();
      assert.equal(await page.locator("input").inputValue(), "My unsaved changes");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByRole("alert").waitFor();
      assert.equal(await page.locator("input").inputValue(), "My unsaved changes");
      assert.equal(await page.locator("output").textContent(), '"v1:' + 'a'.repeat(64) + '"');
    } finally { await page.close(); }
  });
}
