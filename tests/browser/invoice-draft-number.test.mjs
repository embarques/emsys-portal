import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import ts from "typescript";

test("active drafts use different numbers and abandoned draft identifiers survive closing a tab", async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.route("https://invoice.test/**", route => route.fulfill({ contentType: "text/html", body: "<main></main>" }));
    const source = await readFile("src/lib/invoices/invoice-draft-number.ts", "utf8");
    const script = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    async function open() {
      const page = await context.newPage();
      await page.goto("https://invoice.test");
      await page.addScriptTag({ content: "const exports = {};" + script });
      return page;
    }
    function take(page, scope) {
      return page.evaluate(async scope => {
        window.draft = await exports.lockInvoiceNumberDraft(scope);
        return window.draft.id;
      }, scope);
    }
    const first = await open();
    const other = await open();
    const number = await take(first, "tenant1/user1");
    assert.notEqual(await take(other, "tenant1/user1"), number);
    await first.close();
    const recovered = await open();
    assert.equal(await take(recovered, "tenant1/user1"), number);
    assert.equal(await recovered.evaluate(() => window.draft.recovering), true);
    const anotherTenant = await open();
    assert.notEqual(await take(anotherTenant, "tenant2/user1"), number);
    await recovered.evaluate(() => window.draft.forget());
    assert.notEqual(await take(recovered, "tenant1/user1"), number);
  } finally {
    await browser.close();
  }
});
