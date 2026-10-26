import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

test("closeout recovery preserves transaction values and retries after explicit currency/rate selection", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emsys-closeout-test-"));
  let browser;
  try {
    const fixtures = path.resolve("tests/browser/fixtures");
    const compiler = webpackPackage.webpack({
      mode: "development", devtool: false,
      plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      entry: path.join(fixtures, "closeout-recovery.tsx"),
      output: { path: directory, filename: "fixture.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/lib/accounting/daily-income/hooks$": path.join(fixtures, "closeout-hooks.ts"),
        "@/lib/users/hooks/use-users$": path.join(fixtures, "closeout-hooks.ts"),
        "@/lib/auth/hooks/use-auth$": path.join(fixtures, "documents-auth.ts"),
        "@/lib/i18n$": path.join(fixtures, "i18n.ts"),
        "@/lib/branches/hooks/use-branches$": path.join(fixtures, "branches.ts"),
        "@/lib/inventory/hooks/use-inventory$": path.join(fixtures, "inventory-hooks.ts"),
        "@/lib/employees/hooks/use-employees$": path.join(fixtures, "inventory-hooks.ts"),
        "@": path.resolve("src"),
      } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(fixtures, "typescript-loader.mjs") }] },
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => error || stats?.hasErrors() ? reject(error ?? new Error(stats.toString({all:false,errors:true}))) : resolve()));
    await new Promise(resolve => compiler.close(resolve));
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content:await readFile(path.join(directory,"fixture.js"),"utf8")});
    await page.locator("#journal-description").fill("Keep this draft while opening the closeout");
    await page.locator("#record").click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator("#statement-date").inputValue(), "2026-10-26");
    assert.equal(await page.locator("#statement-date").isDisabled(), true);
    await page.locator("#statement-currency").click();
    await page.getByRole("option", {name:"accounting.dailyIncome.currency.dop",exact:true}).click();
    await page.locator("#statement-rate").fill("60");
    await page.getByRole("button", {name:"accounting.dailyIncome.statement.save",exact:true}).click();
    await page.waitForFunction(()=>document.getElementById("attempts").textContent === "2");
    await page.waitForFunction(()=>document.getElementById("saved").textContent === "Keep this draft while opening the closeout");
    const requests = await page.evaluate(()=>window.closeoutRequests);
    assert.equal(requests.length,1);assert.equal(requests[0].currency,"DOP");assert.equal(requests[0].rate,60);
    assert.equal(await page.locator("#journal-description").inputValue(),"Keep this draft while opening the closeout");
  } finally {
    await browser?.close();
    await rm(directory,{recursive:true,force:true});
  }
});
