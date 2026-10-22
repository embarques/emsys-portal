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
    entry: path.resolve("tests/browser/fixtures/invoice-signature.tsx"),
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


test("signature is skipped by default, can be captured without policies, and can be cleared", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: script });
    const skip = page.locator("#invoice-skip-signature");
    await skip.waitFor();
    assert.equal(await skip.isChecked(), true);
    assert.equal(await page.locator("canvas").count(), 0);
    await skip.focus();
    await page.keyboard.press("Space");
    const canvas = page.locator("canvas");
    await canvas.waitFor();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(() => document.getElementById("signature-data").textContent.startsWith("data:image/png;base64,"));
    await skip.check();
    assert.equal(await canvas.count(), 0);
    await skip.uncheck();
    assert.ok((await page.locator("#signature-data").textContent()).startsWith("data:image/png;base64,"));
    await page.getByRole("button", { name: "invoices.wizard.policies.clearSignature" }).click();
    assert.equal(await page.locator("#signature-data").textContent(), "");
  } finally { await page.close(); }
});
