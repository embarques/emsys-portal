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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-about-dialog-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/about-dialog.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/system/hooks/use-session-version$": path.resolve("tests/browser/fixtures/about-version.ts"),
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/print-signatures-i18n.ts"),
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
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("mobile About appears above the navigation drawer and can be closed", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(5000);
  try {
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: script });
    await page.getByRole("button", { name: "About", exact: true }).tap();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.ok((await dialog.innerText()).includes("v1.2.3"));
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    assert.equal(await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true);
    // The backdrop must also cover the drawer, not just the dialog panel.
    assert.equal(await page.evaluate(() => Number(getComputedStyle(document.elementFromPoint(380, 20)).zIndex)), 10000);
    await page.getByRole("button", { name: "common.actions.close", exact: true }).tap();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "About", exact: true }).tap();
    await dialog.waitFor();
    await page.touchscreen.tap(380, 20);
    await dialog.waitFor({ state: "hidden" });
  } finally {
    await page.close();
  }
});
