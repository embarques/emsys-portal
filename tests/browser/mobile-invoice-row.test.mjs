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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-scroll-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    entry: path.resolve("tests/browser/fixtures/mobile-invoice-row.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/i18n$": path.resolve("tests/browser/fixtures/mobile-invoice-i18n.ts"), "@": path.resolve("src") } },
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


test("approved mobile invoice row fits iPhone widths and exposes invoice details", async () => {
 for (const width of [320,390]) {
  const page=await browser.newPage({viewport:{width,height:844}});
  try {
   await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
   await page.addStyleTag({content:css});
   await page.evaluate(()=>document.documentElement.classList.add("dark"));
   await page.addScriptTag({content:script});
   await page.getByRole("button",{name:"INV-26-001436",exact:true}).click();
   await page.getByText("To Juan Luna",{exact:true}).waitFor();
   assert.equal(await page.getByText(/1 item/).count(),1);
   await page.getByRole("button",{name:"View invoice",exact:true}).click();
   assert.equal(await page.locator("output").textContent(),"open");
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
   await page.screenshot({path:`/tmp/emsys-invoice-mobile-${width}.png`,fullPage:true});
  } finally {await page.close();}
 }
});
