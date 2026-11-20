import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

test("card receipt switching removes bank selection and submits one processor receipt on desktop and mobile", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emsys-card-processor-"));
  let browser;
  try {
    const fixtures = path.resolve("tests/browser/fixtures");
    const hooks = path.join(fixtures, "card-processor-hooks.ts");
    const compiler = webpackPackage.webpack({ mode: "development", devtool: false,
      plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) }), new webpackPackage.webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
      entry: path.join(fixtures, "card-processor.tsx"), output: { path: directory, filename: "fixture.js", publicPath: "" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/lib/auth/hooks/use-auth$": hooks,
        "@/lib/accounting/daily-income/use-responsibility-access$": hooks,
        "@/lib/layout/hooks/use-workspace-tabs$": hooks,
        "@/lib/customers/hooks/use-apply-customer-on-tab-return$": hooks,
        "@/lib/api/client$": hooks,
        "@/lib/customers/hooks/use-customers$": path.join(fixtures, "customers.ts"),
        "@/lib/i18n$": path.join(fixtures, "i18n.ts"),
        "@": path.resolve("src"),
      } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(fixtures, "typescript-loader.mjs") }] },
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : resolve())));
    const script = await readFile(path.join(directory, "fixture.js"), "utf8");
    browser = await chromium.launch({ headless: true });
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.route("https://card-fixture.test/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
        await page.goto("https://card-fixture.test/");
        page.on("pageerror", error => console.error(error.message));
        await page.addScriptTag({ content: script });
        await page.locator("#journal-bank-account").waitFor();
        const card = page.getByRole("radio", { name: "CREDIT-CARD", exact: true });
        if (width === 1280) {
          await card.focus();
          await card.press("Space");
        } else {
          await card.click();
        }
        await page.locator("#journal-bank-account").waitFor({ state: "detached" });
        const values = JSON.parse(await page.locator("#values").textContent());
        assert.equal(values.paymentAccountId, undefined);
        await page.getByRole("button", { name: "Save card receipt", exact: true }).click();
        await page.waitForFunction(() => document.getElementById("posted").textContent.length > 0);
        const posted = JSON.parse(await page.locator("#posted").textContent());
        assert.equal(posted.transactionType, "INITIAL-PAYMENT");
        assert.equal(posted.amount, 80);
        assert.equal(posted.invoice.discount, 20);
        assert.equal(posted.paymentMethod.name, "CREDIT-CARD");
        assert.equal(posted.paymentAccount, undefined);
        assert.equal(await page.locator("#errors").textContent(), "[]");
      } finally { await page.close(); }
    }
  } finally {
    await browser?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
