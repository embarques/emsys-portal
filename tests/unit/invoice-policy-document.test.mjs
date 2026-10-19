import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Load the document builder and its existing formatting helpers in Node.
function loadFeature(relative, apiClient) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}


const { buildAgreementInvoiceLines, buildPolicyAgreementDocument } = loadFeature(
  "src/lib/invoice-policies/utils/build-policy-agreement-document.ts",
);
const invoice = {
  invoiceNumber: "INV-123", date: "2026-10-19", paymentLocation: "NY",
  sender: null, receiver: null,
  lineItems: [{ itemName: "Box", quantity: "2", unitPrice: "50", lineTotal: "80", totalManual: true }],
  discount: "5", amountPaid: "20",
};

test("agreement records the invoice and honors manual totals and payment", () => {
  const lines = buildAgreementInvoiceLines(invoice).join("\n");
  assert.match(lines, /Invoice: INV-123/);
  assert.match(lines, /Box.*Qty: 2.*Total: \$80\.00/);
  assert.match(lines, /Discount: \$5\.00/);
  assert.match(lines, /Paid: \$20\.00/);
  assert.match(lines, /Balance: \$55\.00/);
  assert.match(buildAgreementInvoiceLines({ ...invoice, invoiceNumber: "", generatedInvoiceNumber: "AUTO-7" })[0], /AUTO-7/);
});

test("generated attachment draws invoice, policies, and signature within the canvas", async (t) => {
  const drawn = [];
  const canvases = [];
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  t.after(() => {
    if (originalImage === undefined) delete globalThis.Image;
    else globalThis.Image = originalImage;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  globalThis.Image = class {
    width = 200;
    height = 100;
    set src(_value) { queueMicrotask(() => this.onload()); }
  };
  globalThis.document = {
    createElement() {
      const canvas = {
        width: 0, height: 0,
        getContext: () => ({
          measureText: (text) => ({ width: text.length * 8 }),
          fillRect() {},
          fillText: (text, x, y) => drawn.push({ text, y }),
          drawImage: (_image, _x, y, _width, height) => drawn.push({ text: "signature image", y: y + height }),
        }),
        toBlob: (callback) => callback(new Blob(["image"], { type: "image/png" })),
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  const file = await buildPolicyAgreementDocument({
    invoice,
    policies: [{ title: "Shipping terms", body: "Terms apply" }],
    signatureDataUrl: "data:image/png;base64,test",
    signedAt: new Date("2026-10-19T12:00:00Z"),
  });
  assert.equal(file.type, "image/png");
  const text = drawn.map((entry) => entry.text);
  assert.ok(text.indexOf("Invoice: INV-123") < text.indexOf("Shipping terms"));
  assert.ok(text.indexOf("Shipping terms") < text.indexOf("signature image"));
  assert.ok(drawn.every(({ y }) => y < canvases.at(-1).height));
});

test("agreement includes both parties and their invoice addresses", () => {
  const party = (name, street) => ({
    name, phones: [],
    addresses: [{ address1: street, apartment: "", address2: "", city: "City", state: "", zipcode: "", country: "US", isPrimary: true }],
  });
  const lines = buildAgreementInvoiceLines({
    ...invoice,
    sender: party("Ana Sender", "10 Sender Street"),
    receiver: party("Luis Receiver", "20 Receiver Street"),
  }).join("\n");
  assert.match(lines, /Sender: Ana Sender\n10 Sender Street/);
  assert.match(lines, /Receiver: Luis Receiver\n20 Receiver Street/);
});
