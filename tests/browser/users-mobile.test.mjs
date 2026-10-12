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
    entry: path.resolve("tests/browser/fixtures/users-mobile.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/i18n": path.resolve("tests/browser/fixtures/users-i18n.ts"), "@": path.resolve("src") } },
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


test("pickup search uses theme colors in light and dark mode", async () => {
 const page = await browser.newPage({viewport:{width:390,height:400}});
 try {
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
  await page.evaluate(() => { document.documentElement.dataset.fixture = "pickup-search"; });
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:script});
  await page.getByRole("textbox").waitFor();
  const colors = [];
  for (const dark of [false, true]) {
   await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), dark);
   await page.waitForTimeout(200);
   colors.push(await page.getByRole("textbox").evaluate((input) => {
    const style = getComputedStyle(input);
    return [style.backgroundColor, style.color];
   }));
   await page.screenshot({path:path.join(tmpdir(), `emsys-pickup-search-${dark ? "dark" : "light"}.png`)});
  }
  assert.notEqual(colors[0][0], colors[1][0]);
  assert.notEqual(colors[0][1], colors[1][1]);
 } finally { await page.close(); }
});

test("empty login hours and Firebase information are omitted", async () => {
 const page = await browser.newPage({viewport:{width:390,height:844}});
 try {
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => { document.documentElement.dataset.emptyHours = "true"; });
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:script});
  await page.locator("summary").click();
  assert.equal(await page.getByText("Hora de inicio", {exact:true}).count(), 0);
  assert.equal(await page.getByText("Hora de fin", {exact:true}).count(), 0);
  assert.equal(await page.getByText("firebase-73", {exact:true}).count(), 0);
 } finally { await page.close(); }
});

for (const width of [320, 390, 768]) {
 test(`mobile user details at ${width}px`, async () => {
  const page = await browser.newPage({viewport:{width,height:844}});
  try {
   await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:script});
   await page.getByText("Administrador", {exact:true}).waitFor();
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
   await page.locator("summary").click();
   assert.equal(await page.getByText("firebase-73", {exact:true}).count(), 0);
   await page.getByText("08:00", {exact:true}).waitFor();
   await page.getByRole("button", {name:/Acciones para/}).click();
   await page.getByRole("menuitem", {name:"Editar",exact:true}).click();
   assert.equal(await page.locator("output").textContent(), "edit");
   await page.getByRole("button", {name:/Acciones para/}).click();
   await page.getByRole("menuitem", {name:/^Seleccionar/}).click();
   await page.getByRole("checkbox").waitFor();
   assert.equal(await page.getByRole("checkbox").getAttribute("aria-checked"), "true");
   await page.getByRole("checkbox").click();
   await page.screenshot({path:path.join(tmpdir(), `emsys-users-${width}.png`),fullPage:true});
  } finally {await page.close();}
 });
}
