import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/lib/maps/load-google-maps.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test("Maps requires the company key, deduplicates loading and rejects a different company's key", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://maps.googleapis.com/**", route => route.fulfill({
      contentType: "text/javascript",
      body: "window.google={maps:{importLibrary:async()=>({})}}; window.__emsysInitGoogleMaps();",
    }));
    const result = await page.evaluate(async (source) => {
      const api = {};
      new Function("exports", source)(api);
      const missing = await api.loadGoogleMaps("").then(() => false, () => true);
      const first = api.loadGoogleMaps("company-a-test-key");
      const second = api.loadGoogleMaps("company-a-test-key");
      const deduplicated = first === second;
      await first;
      await api.loadGoogleMaps("company-a-test-key");
      const switched = await api.loadGoogleMaps("company-b-test-key").then(() => false, () => true);
      const loggedOut = await api.loadGoogleMaps("").then(() => false, () => true);
      return { missing, deduplicated, switched, loggedOut, scripts: document.scripts.length };
    }, source);
    assert.deepEqual(result, { missing: true, deduplicated: true, switched: true, loggedOut: true, scripts: 1 });
  } finally { await page.close(); }
});
