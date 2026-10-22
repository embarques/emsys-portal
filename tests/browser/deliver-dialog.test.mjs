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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-deliver-dialog-test-"));
  const hooks = path.resolve("tests/browser/fixtures/deliver-dialog-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/deliver-dialog.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": hooks,
      "@/lib/store/hooks$": hooks,
      "@/lib/store/store$": hooks,
      "@/lib/invoices/api/invoices-api$": hooks,
      "@/lib/invoices/api/invoice-signatures-api$": hooks,
      "@/lib/api/axios$": hooks,
      "@/lib/invoices/api/invoice-documents-api$": hooks,
      "@/lib/barcodes/api/barcode-status-options-api$": hooks,
      "@/lib/invoice-policies/api/invoice-policies-api$": hooks,
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/i18n.ts"),
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
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture(flags = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.setContent('<div id="root"></div>');
  await page.evaluate(flags => Object.assign(window, flags), flags);
  await page.addScriptTag({ content: script });
  return page;
}
const submitButton = (page, name = "deliveries.deliver.submit") => page.getByRole("button", { name, exact: true });
async function open(page) {
  await page.getByText("Large box", { exact: true }).waitFor();
}
async function chooseStatus(page, name = "ENTREGADO") {
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name }).click();
}
async function sign(page) {
  await page.getByLabel("deliveries.deliver.signerName").fill("Pedro Ramirez");
  await page.getByLabel("deliveries.deliver.idNumber").fill("001-1234567-8");
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 });
  await page.mouse.up();
}
async function fill(page) {
  await chooseStatus(page);
  await page.getByLabel("deliveries.deliver.agree").check();
  await sign(page);
}

test("delivery signs once and sets the chosen status on the invoice/route group only", async () => {
  const page = await fixture();
  try {
    await open(page);
    assert.equal(await page.getByText("Wooden chair", { exact: true }).count(), 1);
    assert.equal(await page.getByText("Other route item", { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.deliverReads), 1);
    await submitButton(page).click();
    await page.getByText("deliveries.deliver.statusRequired", { exact: true }).waitFor();
    await fill(page);
    await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => window.delivered === true);
    const { writes, patches, reads } = await page.evaluate(() => ({ writes: window.deliverSignatureWrites, patches: window.deliverStatusPatches, reads: window.deliverReads }));
    assert.equal(reads, 2);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].invoiceId, "invoice-1");
    assert.equal(writes[0].dailyRouteId, "route-1");
    assert.equal("deliveryId" in writes[0], false);
    assert.deepEqual(Object.keys(writes[0].receiverSignature).sort(), ["contentType", "data", "idNumber", "signerName"]);
    assert.equal(writes[0].receiverSignature.signerName, "Pedro Ramirez");
    assert.equal(writes[0].receiverSignature.idNumber, "001-1234567-8");
    assert.equal(writes[0].receiverSignature.contentType, "image/png");
    assert.ok(!writes[0].receiverSignature.data.startsWith("data:"));
    assert.equal(patches.length, 1);
    assert.equal(patches[0].invoiceId, "invoice-1");
    // B already has the chosen status and D belongs to another route.
    assert.deepEqual(patches[0].patches.map(patch => patch.number), ["A", "C"]);
    assert.deepEqual(patches[0].patches[0].status, { id: 7, name: "ENTREGADO" });
  } finally { await page.close(); }
});

test("delivery receiver starts empty and can be someone other than the invoice receiver", async () => {
  const page = await fixture();
  try {
    await open(page);
    await page.getByText("deliveries.deliver.receiverHint", { exact: true }).waitFor();
    await page.getByText("deliveries.deliver.signatureCoversTerms", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("deliveries.deliver.signerName").inputValue(), "");
    assert.equal(await page.getByLabel("deliveries.deliver.idNumber").inputValue(), "");
    await chooseStatus(page);
    await page.getByLabel("deliveries.deliver.agree").check();
    await sign(page);
    await page.getByLabel("deliveries.deliver.signerName").fill("Juan Perez (neighbor)");
    await page.getByLabel("deliveries.deliver.idNumber").fill("402-7654321-0");
    await submitButton(page).click();
    await page.waitForFunction(() => window.delivered === true);
    const signature = await page.evaluate(() => window.deliverSignatureWrites[0].receiverSignature);
    assert.equal(signature.signerName, "Juan Perez (neighbor)");
    assert.equal(signature.idNumber, "402-7654321-0");
  } finally { await page.close(); }
});

test("same as invoice receiver fills the name and ID, which stay editable and required", async () => {
  const page = await fixture();
  try {
    await open(page);
    await page.getByRole("button", { name: "deliveries.deliver.sameAsInvoiceReceiver" }).click();
    const id = page.getByLabel("deliveries.deliver.idNumber");
    assert.equal(await page.getByLabel("deliveries.deliver.signerName").inputValue(), "Maria Perez");
    assert.equal(await id.inputValue(), "001-0000000-1");
    await id.fill("");
    await chooseStatus(page);
    await page.getByLabel("deliveries.deliver.agree").check();
    await submitButton(page).click();
    await page.getByText("deliveries.deliver.required", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => (window.deliverSignatureWrites ?? []).length), 0);
  } finally { await page.close(); }
});

test("without an invoice receiver on file there is no shortcut", async () => {
  const page = await fixture({ deliverNoReceiverId: true });
  try {
    await open(page);
    assert.equal(await page.getByRole("button", { name: "deliveries.deliver.sameAsInvoiceReceiver" }).count(), 0);
    assert.equal(await page.getByLabel("deliveries.deliver.idNumber").inputValue(), "");
  } finally { await page.close(); }
});

test("active terms must be accepted before anything is saved", async () => {
  const page = await fixture();
  try {
    await open(page);
    await chooseStatus(page);
    await sign(page);
    await submitButton(page).click();
    await page.getByText("deliveries.deliver.agreementRequired", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => (window.deliverSignatureWrites ?? []).length), 0);
    assert.equal(await page.evaluate(() => (window.deliverStatusPatches ?? []).length), 0);
  } finally { await page.close(); }
});

test("no active terms lets the delivery complete without an agreement", async () => {
  const page = await fixture({ deliverNoPolicies: true });
  try {
    await open(page);
    await page.getByText("deliveries.deliver.noTerms", { exact: true }).waitFor();
    await page.getByText("deliveries.deliver.signatureCoversDelivery", { exact: true }).waitFor();
    await chooseStatus(page);
    await sign(page);
    await submitButton(page).click();
    await page.waitForFunction(() => window.delivered === true);
  } finally { await page.close(); }
});

test("terms that fail to load block the delivery", async () => {
  const page = await fixture({ deliverPoliciesFail: true });
  try {
    await open(page);
    await page.getByText("deliveries.deliver.termsLoadError", { exact: true }).waitFor();
    assert.equal(await submitButton(page).isDisabled(), true);
  } finally { await page.close(); }
});

test("a failed status update retries without resending the signature", async () => {
  const page = await fixture({ deliverStatusFail: 1 });
  try {
    await open(page); await fill(page);
    await submitButton(page).click();
    await page.getByText("Status failed", { exact: true }).waitFor();
    await page.getByText("deliveries.deliver.signatureSaved", { exact: true }).waitFor();
    await submitButton(page, "deliveries.deliver.retryStatus").click();
    await page.waitForFunction(() => window.delivered === true);
    assert.equal(await page.evaluate(() => window.deliverSignatureWrites.length), 1);
    assert.equal(await page.evaluate(() => window.deliverStatusPatches.length), 2);
  } finally { await page.close(); }
});

test("failed signature retains receiver fields and makes no status change", async () => {
  const page = await fixture({ deliverSignatureFail: true });
  try {
    await open(page); await fill(page);
    await submitButton(page).click();
    await page.getByText("Save failed", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("deliveries.deliver.signerName").inputValue(), "Pedro Ramirez");
    assert.equal(await page.getByLabel("deliveries.deliver.idNumber").inputValue(), "001-1234567-8");
    assert.equal(await page.getByRole("button", { name: "invoices.wizard.policies.clearSignature" }).isEnabled(), true);
    assert.equal(await page.evaluate(() => (window.deliverStatusPatches ?? []).length), 0);
  } finally { await page.close(); }
});

test("reassigned clicked barcode prevents mutation", async () => {
  const page = await fixture();
  try {
    await open(page); await fill(page);
    await page.evaluate(() => { window.deliverMoved = true; });
    await submitButton(page).click();
    await page.getByText("deliveries.deliver.changed", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => (window.deliverSignatureWrites ?? []).length), 0);
    assert.equal(await page.evaluate(() => (window.deliverStatusPatches ?? []).length), 0);
  } finally { await page.close(); }
});

test("new route items require a fresh signature after the review changes", async () => {
  const page = await fixture();
  try {
    await open(page); await fill(page);
    await page.evaluate(() => { window.deliverExtra = true; });
    await submitButton(page).click();
    await page.getByText("deliveries.deliver.changed", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => (window.deliverSignatureWrites ?? []).length), 0);
    assert.equal(await page.getByRole("button", { name: "invoices.wizard.policies.clearSignature" }).isDisabled(), true);
    assert.equal(await page.getByLabel("deliveries.deliver.signerName").inputValue(), "Pedro Ramirez");
  } finally { await page.close(); }
});

test("without required permissions, delivery is unavailable and makes no requests", async () => {
  const page = await fixture({ deliverReadOnly: true });
  try {
    await page.getByText("deliveries.deliver.unavailable", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.deliverReads ?? 0), 0);
  } finally { await page.close(); }
});

test("mobile delivery card fits a phone, with tap-to-call phones and a full-width Deliver button", async () => {
  const page = await fixture({ fixtureView: "mobile-row" });
  try {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addStyleTag({ content: css });
    await page.getByText("Maria Altagracia Perez Rodriguez", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(tmpdir(), "emsys-delivery-mobile-card.png") });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const links = await page.locator('a[href^="tel:"]').evaluateAll(nodes => nodes.map(node => [node.getAttribute("href"), node.getBoundingClientRect().height]));
    assert.deepEqual(links.map(([href]) => href), ["tel:8095550101", "tel:8295550102"]);
    assert.equal(await page.getByText("(809) 555-0101", { exact: true }).count(), 1);
    assert.ok(links.every(([, height]) => height >= 44));
    const deliver = page.getByRole("button", { name: "deliveries.deliver.action" });
    const box = await deliver.boundingBox();
    assert.ok(box.height >= 44 && box.width >= 300);
    await deliver.click();
    assert.equal(await page.evaluate(() => window.mobileDeliverClicked), "000123456789");
  } finally { await page.close(); }
});

const deliveryFiles = [
  { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("photo") },
  { name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.from("video") },
  { name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("document") },
];
async function queueDeliveryFiles(page) {
  await page.locator('input[type="file"][multiple]').setInputFiles(deliveryFiles);
}
const uploadButton = (page) => page.getByRole("button", { name: "deliveries.deliver.uploadDocuments", exact: true });

test("delivery uploads share one sequence across pages and extensions, with camera controls", async () => {
  const page = await fixture();
  try {
    await open(page);
    assert.equal(await page.locator('input[capture][accept="image/*"]').count(), 1);
    assert.equal(await page.locator('input[capture][accept="video/*"]').count(), 1);
    await queueDeliveryFiles(page);
    assert.equal(await submitButton(page).isDisabled(), true);
    await uploadButton(page).click();
    await page.waitForFunction(() => window.deliverDocumentSaved?.length === 3);
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    assert.deepEqual(await page.evaluate(() => window.deliverDocumentSaved), ["delivery_11.jpg", "delivery_12.mp4", "delivery_13.pdf"]);
    assert.equal(await page.evaluate(() => window.deliverDocumentReads), 2);
    assert.equal(await page.evaluate(() => (window.deliverSignatureWrites ?? []).length), 0);
    assert.equal(await page.getByText("delivery_11.jpg", { exact: true }).count(), 1);
    await page.locator('input[capture][accept="image/*"]').setInputFiles(deliveryFiles[0]);
    await uploadButton(page).click();
    await page.waitForFunction(() => window.deliverDocumentSaved?.length === 4);
    assert.equal(await page.evaluate(() => window.deliverDocumentSaved[3]), "delivery_14.jpg");
  } finally { await page.close(); }
});

test("partial delivery upload retries only failed and unattempted files", async () => {
  const page = await fixture({ deliverDocumentFailAt: 2 });
  try {
    await open(page); await queueDeliveryFiles(page);
    await uploadButton(page).click();
    await page.getByText("Upload failed", { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.deliverDocumentSaved), ["delivery_11.jpg"]);
    assert.equal(await submitButton(page).isDisabled(), true);
    await uploadButton(page).click();
    await page.waitForFunction(() => window.deliverDocumentSaved?.length === 3);
    assert.deepEqual(await page.evaluate(() => window.deliverDocumentSaved), ["delivery_11.jpg", "delivery_12.mp4", "delivery_13.pdf"]);
    assert.equal(await page.evaluate(() => window.deliverDocumentAttempts.filter(name => name === "delivery_11.jpg").length), 1);
  } finally { await page.close(); }
});
