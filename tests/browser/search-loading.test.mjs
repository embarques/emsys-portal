import assert from "node:assert/strict";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {before, after, test} from "node:test";
import {chromium} from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let browser, directory, script, css;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-search-loading-"));
  const compiler = webpackPackage.webpack({mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({"process.env": JSON.stringify({NODE_ENV: "development"})})],
    entry: path.resolve("tests/browser/fixtures/search-loading.tsx"), output: {path: directory, filename: "fixture.js"},
    resolve: {extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/print-signatures-i18n.ts"),
      "@/lib/filter-presets/hooks/use-filter-presets$": path.resolve("tests/browser/fixtures/search-loading-presets.ts"),
      "@": path.resolve("src"),
    }},
    module: {rules: [{test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("tests/browser/fixtures/typescript-loader.mjs")}]},
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString())) : resolve())));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), {from: cssPath})).css;
  browser = await chromium.launch();
});
after(async () => {await browser?.close(); if (directory) await rm(directory, {recursive: true, force: true});});
async function setup({mobile = false} = {}) {
  const page = await browser.newPage({viewport: mobile ? {width: 390, height: 844} : {width: 1200, height: 900}});
  page.setDefaultTimeout(5000);
  await page.setContent(`<html lang="${mobile ? "es" : "en"}" data-mobile="${mobile}"><body><div id="root"></div></body></html>`);
  await page.addStyleTag({content: css});
  await page.addScriptTag({content: script});
  await page.waitForFunction(() => window.searchRequests?.length === 1);
  await page.getByRole("button", {name: "Resolve request"}).click();
  await page.getByRole("cell", {name: "Saved row", exact: true}).waitFor();
  return page;
}
test("search indicates debounce and cached-row fetching, including clearing, without extra requests", async () => {
  const page = await setup();
  try {
    const input = page.getByRole("textbox", {name: "Search", exact: true});
    await input.fill("alpha");
    await page.getByRole("progressbar", {name: "Searching…"}).waitFor();
    assert.equal(await page.evaluate(() => window.searchRequests.length), 1);
    assert.equal(await input.isEnabled(), true);
    await page.waitForFunction(() => window.searchRequests.length === 2);
    assert.equal(await page.getByRole("table").getAttribute("aria-busy"), "true");
    assert.equal(await page.getByRole("cell", {name: "Saved row", exact: true}).count(), 1);
    await page.getByRole("button", {name: "Resolve request"}).click();
    await page.getByRole("progressbar").waitFor({state: "detached"});
    assert.equal(await page.getByRole("table").getAttribute("aria-busy"), "false");
    await page.getByRole("button", {name: "Clear search"}).click();
    await page.getByRole("progressbar").waitFor();
    assert.equal(await input.inputValue(), "");
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    await page.waitForFunction(() => window.searchRequests.length === 3);
    await page.getByRole("button", {name: "Resolve request"}).click();
    await page.getByRole("progressbar").waitFor({state: "detached"});
    assert.equal(await page.evaluate(() => window.searchRequests.length), 3);
  } finally {await page.close();}
});
test("advanced filters show waiting feedback inside the open panel and stop on failure", async () => {
  const page = await setup();
  try {
    await page.getByRole("button", {name: "Apply advanced filter"}).click();
    await page.waitForFunction(() => window.searchRequests.length === 2);
    const panel = page.getByRole("dialog");
    await panel.getByText("Searching…", {exact: true}).waitFor();
    assert.equal(await page.getByRole("table").getAttribute("aria-busy"), "true");
    await page.evaluate(() => window.searchRequests.at(-1).resolve({items: [{id: "1", name: "Filtered row"}], total: 1}));
    await page.getByRole("progressbar").waitFor({state: "detached"});
    await panel.getByRole("textbox").fill("two");
    await page.waitForFunction(() => window.searchRequests.length === 3);
    await panel.getByText("Searching…", {exact: true}).waitFor();
    await page.evaluate(() => window.searchRequests.at(-1).reject(new Error("Search failed")));
    await page.getByRole("progressbar").waitFor({state: "detached"});
    await page.getByRole("alert").waitFor();
    assert.equal(await panel.getByRole("textbox").inputValue(), "two");
  } finally {await page.close();}
});
test("mobile search spinner is localized and keeps the input editable", async () => {
  const page = await setup({mobile: true});
  try {
    await page.getByRole("textbox", {name: "Search", exact: true}).fill("alpha");
    await page.getByRole("progressbar", {name: "Buscando…"}).waitFor();
    assert.equal(await page.getByRole("textbox").isEnabled(), true);
    await page.waitForFunction(() => window.searchRequests.length === 2);
    await page.getByRole("button", {name: "Resolve request"}).click();
    await page.getByRole("progressbar").waitFor({state: "detached"});
  } finally {await page.close();}
});

test("an empty cached page shows loading until the replacement search completes", async () => {
  const page = await setup();
  try {
    const input = page.getByRole("textbox", {name: "Search", exact: true});
    await input.fill("none");
    await page.waitForFunction(() => window.searchRequests.length === 2);
    await page.evaluate(() => window.searchRequests.at(-1).resolve({items: [], total: 0}));
    await page.getByRole("progressbar").waitFor({state: "detached"});
    const previousEmpty = await page.getByRole("table").innerText();
    await input.fill("replacement");
    await page.getByRole("table").getByText("Loading...", {exact: true}).waitFor();
    assert.notEqual(await page.getByRole("table").innerText(), previousEmpty);
    await page.waitForFunction(() => window.searchRequests.length === 3);
    await page.getByRole("table").getByText("Loading...", {exact: true}).waitFor();
    await page.getByRole("button", {name: "Resolve request"}).click();
    await page.getByRole("progressbar").waitFor({state: "detached"});
  } finally {await page.close();}
});

test("typing resets the debounce and a one-character directory search remains valid", async () => {
  const page = await setup();
  try {
    const input = page.getByRole("textbox", {name: "Search", exact: true});
    await input.pressSequentially("alpha", {delay: 40});
    assert.equal(await page.evaluate(() => window.searchRequests.length), 1);
    await page.waitForFunction(() => window.searchRequests.length === 2);
    assert.equal(await page.evaluate(() => window.searchRequests.at(-1).params.query), "alpha");
    await page.getByRole("button", {name: "Resolve request"}).click();
    await page.getByRole("progressbar").waitFor({state: "detached"});
    await input.fill("7");
    await page.waitForFunction(() => window.searchRequests.length === 3);
    assert.equal(await page.evaluate(() => window.searchRequests.at(-1).params.query), "7");
    await page.getByRole("button", {name: "Resolve request"}).click();
    await page.getByRole("progressbar").waitFor({state: "detached"});
  } finally {await page.close();}
});

test("five keystrokes issue five deferred queries versus one debounced query", async () => {
  const observed = {};
  for (const mode of ["before", "after"]) {
    const page = await browser.newPage();
    try {
      await page.setContent(`<html data-timing="${mode}"><body><div id="root"></div></body></html>`);
      await page.addScriptTag({content: script});
      await page.waitForFunction(() => window.timingRequests?.length === 1);
      await page.getByRole("textbox", {name: "Timing search"}).pressSequentially("alpha", {delay: 40});
      await page.waitForFunction(() => window.timingRequests.at(-1) === "alpha");
      observed[mode] = await page.evaluate(() => window.timingRequests.slice(1));
    } finally {await page.close();}
  }
  assert.deepEqual(observed.before, ["a", "al", "alp", "alph", "alpha"]);
  assert.deepEqual(observed.after, ["alpha"]);
});
