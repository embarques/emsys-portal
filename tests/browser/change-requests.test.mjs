import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

test("change requests validate effective actions, serialize submits, preserve retries and surface stale approval errors", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emsys-change-browser-"));
  let browser;
  try {
    const fixtures = path.resolve("tests/browser/fixtures");
    const boundary = path.join(fixtures, "change-requests-boundary.ts");
    const aliases = Object.fromEntries(["@/lib/auth/hooks/use-auth", "@/lib/store/hooks", "@/lib/store/store", "@/lib/query/use-workspace-query", "@/lib/api/client", "@/lib/api/axios", "@/lib/i18n", "next/navigation"].map(name => [name + "$", boundary]));
    const compiler = webpackPackage.webpack({ mode: "development", devtool: false,
      plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      entry: path.join(fixtures, "change-requests.tsx"), output: { path: directory, filename: "fixture.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": path.resolve("src") } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(fixtures, "typescript-loader.mjs") }] },
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => error || stats?.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : resolve()));
    await new Promise(resolve => compiler.close(resolve));
    const script = await readFile(path.join(directory, "fixture.js"), "utf8");
    browser = await chromium.launch({ headless: true });
    async function open(flags = {}) {
      const page = await browser.newPage();
      page.on("pageerror", error => console.error(error.message));
      await page.route("http://emsys.test/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
      await page.goto("http://emsys.test/");
      await page.evaluate(flags => Object.assign(window, flags), flags);
      await page.addScriptTag({ content: script });
      return page;
    }
    const label = key => `accounting.changeRequests.${key}`;
    const page = await open({ failChange: true });
    const submit = page.getByRole("button", { name: label("submit"), exact: true });
    await submit.waitFor();
    await page.getByLabel(label("purpose"), { exact: true }).fill("TAKE");
    await page.getByLabel(label("reason"), { exact: true }).fill("   ");
    await submit.click();
    await page.getByRole("alert").filter({ hasText: label("invalid") }).waitFor();
    assert.equal((await page.evaluate(() => window.changeCalls)).filter(call => call.body).length, 0);
    await page.getByLabel(label("reason"), { exact: true }).fill("Correct the purpose");
    await page.evaluate(() => { const form = document.querySelector("form"); form.requestSubmit(); form.requestSubmit(); });
    await page.getByRole("alert").filter({ hasText: "Ambiguous network failure" }).waitFor();
    let writes = (await page.evaluate(() => window.changeCalls)).filter(call => call.body);
    assert.equal(writes.length, 1);
    await page.evaluate(() => { window.targetVersion = "version-2"; });
    await page.getByRole("button", { name: label("verify"), exact: true }).click();
    await submit.waitFor();
    await submit.click();
    await page.getByRole("status").filter({ hasText: label("submitted") }).waitFor();
    writes = (await page.evaluate(() => window.changeCalls)).filter(call => call.body);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].body, writes[1].body);
    assert.equal(writes[1].body.expectedVersion, "version-1");
    assert.ok(writes.every(call => call.url === "/change-requests"));
    await page.close();

    const denied = await open({ denyRequest: true });
    assert.equal(await denied.getByRole("button", { name: label("submit"), exact: true }).isDisabled(), true);
    await denied.getByLabel(label("record"), { exact: true }).fill("other-record");
    assert.equal(await denied.getByRole("button", { name: label("submit"), exact: true }).count(), 0);
    await denied.evaluate(() => document.querySelector("form").requestSubmit());
    assert.equal((await denied.evaluate(() => window.changeCalls)).filter(call => call.body).length, 0);
    await denied.close();

    const viewer = await open({ viewerOnly: true });
    await viewer.getByText(label("empty"), { exact: true }).waitFor();
    assert.equal(await viewer.locator("form").count(), 0);
    assert.equal((await viewer.evaluate(() => window.changeCalls)).filter(call => call.url.includes("/target")).length, 0);
    await viewer.close();

    const reviewer = await open({ reviewer: true, staleReview: true });
    await reviewer.getByRole("button", { name: label("review"), exact: true }).click();
    const dialog = reviewer.getByRole("dialog");
    assert.equal(await dialog.getByRole("button", { name: label("reject"), exact: true }).isDisabled(), true);
    await dialog.getByRole("button", { name: label("approve"), exact: true }).click();
    await dialog.getByRole("alert").filter({ hasText: "Source record changed" }).waitFor();
    assert.equal(await dialog.isVisible(), true);
    await reviewer.close();
  } finally {
    await browser?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
