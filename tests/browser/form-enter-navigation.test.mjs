import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import ts from "typescript";

const compile = (path) => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const navigation = compile("src/hooks/use-form-enter-navigation.ts");
const fallback = compile("src/components/forms/form-keyboard-navigation.tsx");
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function fixture(html, width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.setContent(html);
  await page.evaluate(({ navigation, fallback }) => {
    const react = { useCallback: (fn) => fn, useEffect: (fn) => fn() };
    const api = {};
    new Function("exports", "require", navigation)(api, () => react);
    const component = {};
    new Function("exports", "require", fallback)(component, (name) => name === "react" ? react : api);
    component.FormKeyboardNavigation();
    window.navigation = api;
    window.submits = 0;
    document.addEventListener("submit", (event) => { event.preventDefault(); window.submits++; });
  }, { navigation, fallback });
  return page;
}

test("desktop traverses visible editable fields, skips unavailable controls, then submits once", async () => {
  const page = await fixture(`<form><input id="first"><input disabled>
    <fieldset disabled><input></fieldset><input readonly><input type="hidden">
    <div aria-hidden="true"><input></div><div style="visibility:hidden"><input></div>
    <div data-enter-navigation="ignore"><input></div><textarea id="notes"></textarea>
    <input id="last"><button type="submit">Save</button></form>`);
  try {
    await page.locator("#first").press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "notes");
    await page.keyboard.press("Shift+Enter");
    assert.equal(await page.locator("#notes").inputValue(), "\n");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "last");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.submits), 1);
  } finally { await page.close(); }
});

test("mobile keeps textarea Enter and does not advance selection focus", async () => {
  const page = await fixture('<form><textarea id="notes"></textarea><input id="next"></form>', 390);
  try {
    await page.locator("#notes").press("Enter");
    assert.equal(await page.locator("#notes").inputValue(), "\n");
    assert.equal(await page.evaluate(() => window.navigation.focusNextFormField(document.querySelector("#notes"))), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), "notes");
  } finally { await page.close(); }
});

test("native validation focuses a missing field and disabled saves cannot submit", async () => {
  const page = await fixture('<form><input id="required" required><input id="last"><button type="submit">Save</button></form>');
  try {
    await page.locator("#last").press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "required");
    assert.equal(await page.evaluate(() => window.submits), 0);
    await page.locator("#required").fill("valid");
    await page.locator("button").evaluate((button) => { button.disabled = true; });
    await page.locator("#last").press("Enter");
    assert.equal(await page.evaluate(() => window.submits), 0);
  } finally { await page.close(); }
});

test("fallback preserves wizard completion without double handling", async () => {
  const page = await fixture('<form><input id="last"></form>');
  try {
    await page.evaluate(() => {
      window.completed = 0;
      const form = document.querySelector("form");
      form.addEventListener("keydown", (event) => window.navigation.handleFormEnterNavigation(event, form, {
        onComplete: () => window.completed++,
      }));
    });
    await page.locator("#last").press("Enter");
    assert.equal(await page.evaluate(() => window.completed), 1);
    assert.equal(await page.evaluate(() => window.submits), 0);
  } finally { await page.close(); }
});

test("schema errors focus the first invalid control after rendering", async () => {
  const page = await fixture('<form><input id="first"><input id="last"><button type="submit">Save</button></form>');
  try {
    await page.evaluate(() => document.querySelector("form").addEventListener("submit", () => {
      setTimeout(() => document.querySelector("#first").setAttribute("aria-invalid", "true"), 10);
    }));
    await page.locator("#last").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "first");
  } finally { await page.close(); }
});

test("open dropdowns, IME composition and ignored fields keep their Enter handling", async () => {
  const page = await fixture('<form><input id="combo" role="combobox" aria-expanded="true"><input id="ime"><div data-enter-navigation="ignore"><textarea id="ignored"></textarea></div><input id="next"></form>');
  try {
    const results = await page.evaluate(() => ["combo", "ime", "ignored"].map((id) => {
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: id === "ime" });
      document.getElementById(id).dispatchEvent(event);
      return event.defaultPrevented;
    }));
    assert.deepEqual(results, [false, false, false]);
  } finally { await page.close(); }
});
