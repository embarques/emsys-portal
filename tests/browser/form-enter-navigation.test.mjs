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

test("opening a form focuses its first editable field and rerenders preserve later focus", async () => {
  const page = await fixture('<form><input disabled><input readonly><input type="hidden"><input id="first"><input id="second"></form>');
  try {
    await page.waitForFunction(() => document.activeElement.id === "first");
    await page.locator("#second").fill("Working");
    await page.evaluate(() => {
      document.querySelector("form").append(document.createElement("p"));
      document.querySelector("form").className = "updated";
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => document.activeElement.id), "second");
  } finally { await page.close(); }
});

test("delayed fields and reactivated workspace tabs receive initial focus", async () => {
  const page = await fixture('<section id="tab" hidden><form id="form"></form></section>');
  try {
    await page.evaluate(() => {
      document.getElementById("form").innerHTML = '<input id="first"><input id="last">';
    });
    assert.notEqual(await page.evaluate(() => document.activeElement.id), "first");
    await page.locator("#tab").evaluate((tab) => { tab.hidden = false; });
    await page.waitForFunction(() => document.activeElement.id === "first");
    await page.locator("#last").focus();
    await page.locator("#tab").evaluate((tab) => { tab.hidden = true; });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.locator("#tab").evaluate((tab) => { tab.hidden = false; });
    await page.waitForFunction(() => document.activeElement.id === "first");
    await page.evaluate(() => { document.getElementById("form").outerHTML = '<form id="loading"></form>'; });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.evaluate(() => { document.getElementById("loading").innerHTML = '<input id="loaded">'; });
    await page.waitForFunction(() => document.activeElement.id === "loaded");
  } finally { await page.close(); }
});

test("new dialog form focuses first field without background focus stealing on close", async () => {
  const page = await fixture('<form id="page"><input id="first"><input id="last"></form>');
  try {
    await page.waitForFunction(() => document.activeElement.id === "first");
    await page.locator("#last").focus();
    await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<div id="dialog" role="dialog"><button>Close</button><form><input id="dialog-first"><input id="dialog-last"></form></div>'));
    await page.waitForFunction(() => document.activeElement.id === "dialog-first");
    await page.evaluate(() => {
      document.getElementById("page").setAttribute("aria-hidden", "true");
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.evaluate(() => {
      document.getElementById("dialog").remove();
      document.getElementById("page").removeAttribute("aria-hidden");
      document.getElementById("last").focus();
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => document.activeElement.id), "last");
  } finally { await page.close(); }
});

test("mobile form mounting does not autofocus fields", async () => {
  const page = await fixture('<form><input id="first"></form>', 390);
  try {
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.notEqual(await page.evaluate(() => document.activeElement.id), "first");
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

test("desktop traverses date, native select, checkbox and switch without toggling values", async () => {
  const page = await fixture(`<form><input id="date" type="date" value="2026-10-10">
    <select id="select"><option>Selected</option></select><input id="checkbox" type="checkbox">
    <button id="switch" type="button" role="switch" aria-checked="true">Enabled</button>
    <input id="last"><button type="submit">Save</button></form>`);
  try {
    await page.locator("#date").focus();
    for (const id of ["select", "checkbox", "switch", "last"]) {
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => document.activeElement.id), id);
    }
    assert.equal(await page.locator("#checkbox").isChecked(), false);
    assert.equal(await page.locator("#switch").getAttribute("aria-checked"), "true");
    assert.equal(await page.evaluate(() => window.submits), 0);
  } finally { await page.close(); }
});

test("last dropdown focuses external wizard submit and disabled saves stay inactive", async () => {
  const page = await fixture('<form id="form"><input id="combo" role="combobox"></form><button id="next" form="form" type="submit">Next</button>');
  try {
    await page.locator("#combo").focus();
    assert.equal(await page.evaluate(() => window.navigation.focusNextFormField(document.activeElement)), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "next");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.submits), 1);
    await page.locator("#next").evaluate((button) => { button.disabled = true; });
    await page.locator("#combo").press("Enter");
    assert.equal(await page.evaluate(() => window.submits), 1);
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

test("required custom selects focus the visible control, not the hidden validation input", async () => {
  const page = await fixture(`<form><div><input id="visible" role="combobox">
    <input required aria-hidden="true" tabindex="-1" style="opacity:0"></div>
    <input id="last"><button type="submit">Save</button></form>`);
  try {
    await page.locator("#last").press("Enter");
    await page.waitForFunction(() => document.activeElement.id === "visible");
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
