import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

let browser;
let directory;
let script;
let appointmentStyles = "";
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-appointment-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/appointment-form.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/company/hooks/use-current-company$": path.resolve("tests/browser/fixtures/appointment-hooks.ts"),
      "@/lib/layout/hooks/use-workspace-tabs$": path.resolve("tests/browser/fixtures/appointment-hooks.ts"),
      "@/lib/customers/hooks/use-apply-customer-on-tab-return$": path.resolve("tests/browser/fixtures/appointment-hooks.ts"),
      "@/lib/orders/hooks/use-orders$": path.resolve("tests/browser/fixtures/appointment-hooks.ts"),
      "@/lib/inventory/hooks/use-inventory$": path.resolve("tests/browser/fixtures/inventory-hooks.ts"),
      "@/lib/employees/hooks/use-employees$": path.resolve("tests/browser/fixtures/appointment-hooks.ts"),
      "@/lib/auth/hooks/use-auth$": path.resolve("tests/browser/fixtures/documents-auth.ts"),
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/appointment-i18n.ts"),
      "@/lib/branches/hooks/use-branches$": path.resolve("tests/browser/fixtures/branches.ts"),
      "@/lib/customers/hooks/use-customers$": path.resolve("tests/browser/fixtures/customers.ts"),
      "@/hooks/use-address-autocomplete$": path.resolve("tests/browser/fixtures/address-autocomplete.ts"),
      "@": path.resolve("src"),
    } },
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
  // Built styles are optional for behavior checks and enable local visual previews.
  const cssRoot = path.resolve(".next/static");
  const cssFiles = await readdir(cssRoot, { recursive: true }).catch(() => []);
  appointmentStyles = (await Promise.all(cssFiles.filter((file) => file.endsWith(".css")).map((file) => readFile(path.join(cssRoot, file), "utf8")))).join("\n");
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture(width = 1280, kind = "select", settings = {}) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  page.on("pageerror", (error) => console.error(error));
  page.setDefaultTimeout(5000);
  await page.setContent('<div id="root"></div>');
  // about:blank is not a secure context, so randomUUID is missing there.
  await page.evaluate(() => { crypto.randomUUID ??= () => `${Date.now()}-${Math.random().toString(16).slice(2)}`; });
  await page.evaluate((kind) => { document.documentElement.dataset.fixture = kind; }, kind);
  await page.evaluate((settings) => Object.assign(document.documentElement.dataset, settings), settings);
  await page.addStyleTag({ content: '.hidden {display:none} @media(min-width:768px) { .md\\:hidden {display:none} .md\\:block {display:block} }' });
  if (kind === "appointment" && appointmentStyles) await page.addStyleTag({ content: appointmentStyles });
  await page.addScriptTag({ content: script });
  if (kind === "appointment") { await page.locator("#senderId").waitFor(); return page; }
  return page;
}

test("appointment form shows every section on one page and saves without receivers on desktop and mobile", async () => {
  for (const width of [1280, 390]) {
    const page = await fixture(width, "appointment");
    try {
      await page.screenshot({ path: `/tmp/appointment-form-${width}.png` });
      await page.getByRole("button", { name: "Show appointment history" }).click();
      await page.getByText("No appointment history yet.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Back to customer details" }).click();
      assert.equal(await page.locator("#date").isVisible(), true);
      assert.equal(await page.locator('[id="receiver-receiver-1"]').isVisible(), true);
      assert.equal(await page.locator('[id="receiver-receiver-2"]').isVisible(), true);
      const purposeGroup = page.getByRole("group", { name: "Purpose" });
      const dateBox = await page.locator("#date").boundingBox();
      const purposeBox = await purposeGroup.boundingBox();
      if (width >= 1280) assert.ok(purposeBox.x > dateBox.x + dateBox.width, "purpose sits in the right column");
      else assert.ok(purposeBox.y > dateBox.y, "sections stack on mobile");
      await page.getByRole("button", { name: "Remove receiver 2", exact: true }).click();
      await page.getByRole("button", { name: "Remove receiver 1", exact: true }).click();
      assert.equal(await page.locator('[id^="receiver-"]').count(), 0);
      await page.getByRole("button", { name: "Payment", exact: true }).click();
      await page.getByRole("button", { name: "Edit purpose 1: Payment", exact: true }).waitFor();
      await page.getByRole("button", { name: "Save appointment", exact: true }).click();
      const saved = JSON.parse(await page.locator("#appointment-saved").textContent());
      assert.deepEqual(saved.receivers, []);
      assert.equal(saved.comments[0].purpose, "PAYMENT");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    } finally { await page.close(); }
  }
});


test("take/pickup items ask only for quantity and Enter saves; the Other item asks only for a comment", async () => {
  const page = await fixture(1280, "appointment");
  try {
    const purposes = page.getByRole("group", { name: "Purpose" });
    const items = page.getByRole("group", { name: "Item" });
    await purposes.getByRole("button", { name: "Pickup", exact: true }).click();
    await items.getByRole("button", { name: "Box", exact: true }).click();
    const quantity = page.getByLabel("Quantity", { exact: true });
    await quantity.waitFor();
    assert.equal(await page.getByLabel("Comment", { exact: true }).count(), 0);
    assert.equal(await quantity.evaluate((input) => input === document.activeElement), true);
    await page.keyboard.type("3");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Edit purpose 1: Pickup", exact: true }).getByText("Box × 3").waitFor();
    assert.equal(await page.getByLabel("Quantity", { exact: true }).count(), 0);

    await purposes.getByRole("button", { name: "Take", exact: true }).click();
    await items.getByRole("button", { name: "Other", exact: true }).click();
    const comment = page.getByLabel("Comment", { exact: true });
    await comment.waitFor();
    assert.equal(await page.getByLabel("Quantity", { exact: true }).count(), 0);
    await page.waitForFunction(() => document.activeElement?.id.startsWith("quick-comment-note-"));
  } finally { await page.close(); }
});

test("empty receivers show only the add action and an empty draft row blocks save until removed", async () => {
  const page = await fixture(1280, "appointment", { emptyReceivers: "true" });
  try {
    assert.equal(await page.locator('[id^="receiver-"]').count(), 0);
    assert.equal(await page.getByRole("button", { name: "Add receiver", exact: true }).count(), 1);
    await page.getByRole("button", { name: "Payment", exact: true }).click();
    await page.getByRole("button", { name: "Add receiver", exact: true }).last().click();
    assert.equal(await page.locator('[id^="receiver-"]').count() > 0, true);
    const save = page.locator("[data-wizard-primary]");
    assert.equal(await save.isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Remove receiver 1", exact: true }).click();
    assert.equal(await page.locator('[id^="receiver-"]').count(), 0);
    assert.equal(await save.isDisabled(), false);
  } finally { await page.close(); }
});


test("appointment address options follow the mouse and arrow keys before selecting the address", async () => {
  const page = await fixture(1280, "appointment", { multipleAddresses: "true" });
  try {
    await page.locator("#senderId").fill("Test");
    const customer = page.getByRole("option").filter({ hasText: "Test sender" });
    await customer.click();
    const addresses = page.locator('[data-customer-address="sender"]');
    await addresses.nth(1).waitFor();
    await addresses.nth(0).hover();
    assert.equal(await addresses.nth(0).evaluate((element) => element === document.activeElement), true);
    await addresses.nth(1).hover();
    assert.equal(await addresses.nth(1).evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("ArrowUp");
    assert.equal(await addresses.nth(0).evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("ArrowDown");
    assert.equal(await addresses.nth(1).evaluate((element) => element === document.activeElement), true);
    await addresses.nth(1).click();
    await page.getByRole("option").waitFor({ state: "hidden" });
    await page.getByText("456 Broadway, New York, NY 10001, US", { exact: true }).waitFor();
  } finally {
    await page.close();
  }
});
