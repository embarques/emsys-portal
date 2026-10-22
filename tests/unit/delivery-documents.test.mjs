import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
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
      if (specifier === "@/lib/invoices/api/invoice-documents-api") return apiClient;
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




const feature = "src/lib/invoices/api/delivery-documents-api.ts";
const noop = () => {};

test("delivery document numbers share one namespace regardless of extension or case", () => {
  const { deliveryDocumentNumber } = loadFeature(feature, {});
  for (const [name, expected] of [["delivery_2.jpg", 2], ["delivery_10.mp4", 10], ["DELIVERY_12.PDF", 12], ["delivery_3", 3], ["delivery_4.tar.gz", 4], ["receipt_99.pdf", 0], ["delivery_0.png", 0], ["delivery_12-extra.pdf", 0], [undefined, 0]]) {
    assert.equal(deliveryDocumentNumber(name), expected);
  }
});

test("renaming preserves contents, MIME, timestamp, and extension", async () => {
  const { nameDeliveryDocument } = loadFeature(feature, {});
  const file = new File(["photo bytes"], "camera.JPG", { type: "image/jpeg", lastModified: 123 });
  const renamed = nameDeliveryDocument(file, 11);
  assert.equal(renamed.name, "delivery_11.JPG");
  assert.equal(renamed.type, "image/jpeg");
  assert.equal(renamed.lastModified, 123);
  assert.equal(await renamed.text(), "photo bytes");
  assert.equal(nameDeliveryDocument(new File(["text"], "note"), 12).name, "delivery_12");
});

test("numbering reads every metadata page and honors original names after renaming", async () => {
  const cursors = [];
  const api = loadFeature(feature, { fetchInvoiceDocuments: async (invoiceId, cursor) => {
    assert.equal(invoiceId, "invoice-1"); cursors.push(cursor);
    return cursor ? { items: [{ name: "Renamed.jpg", originalName: "delivery_12.jpg" }] }
      : { items: [{ name: "delivery_2.pdf" }], nextCursor: "next" };
  } });
  assert.equal(await api.nextDeliveryDocumentNumber("invoice-1", noop), 13);
  assert.deepEqual(cursors, [undefined, "next"]);
});

test("mixed files upload sequentially and stop on failure without attempting later files", async () => {
  const attempted = [], completed = [];
  let active = 0;
  const api = loadFeature(feature, {
    fetchInvoiceDocuments: async () => ({ items: [{ name: "delivery_8.pdf" }] }),
    uploadInvoiceDocument: async (invoiceId, file, progress) => {
      assert.equal(invoiceId, "invoice-1"); assert.equal(active++, 0);
      attempted.push(file.name); progress(50);
      await new Promise(resolve => setTimeout(resolve, 1)); active--;
      if (file.name === "delivery_10.mp4") throw new Error("Failed");
      return { name: file.name };
    },
  });
  await assert.rejects(api.uploadDeliveryDocuments({ invoiceId: "invoice-1", companyId: "company-1", files: [new File(["a"], "a.jpg"), new File(["b"], "b.mp4"), new File(["c"], "c.pdf")], assertContext: noop, onProgress: noop, onUploaded: (_, name) => completed.push(name) }), /Failed/);
  assert.deepEqual(attempted, ["delivery_9.jpg", "delivery_10.mp4"]);
  assert.deepEqual(completed, ["delivery_9.jpg"]);
});

test("invalid files are rejected before any request", async () => {
  let requested = false;
  const api = loadFeature(feature, { fetchInvoiceDocuments: async () => { requested = true; return { items: [] }; } });
  await assert.rejects(api.uploadDeliveryDocuments({ invoiceId: "invoice-1", companyId: "company-1", files: [new File([], "empty.pdf")], assertContext: noop, onProgress: noop, onUploaded: noop }), /size/);
  assert.equal(requested, false);
});

test("context changes stop upload after reading metadata", async () => {
  let current = true, uploaded = false;
  const api = loadFeature(feature, {
    fetchInvoiceDocuments: async () => { current = false; return { items: [] }; },
    uploadInvoiceDocument: async () => { uploaded = true; },
  });
  await assert.rejects(api.uploadDeliveryDocuments({ invoiceId: "invoice-1", companyId: "company-1", files: [new File(["a"], "a.jpg")], assertContext: () => { if (!current) throw new Error("Context changed"); }, onProgress: noop, onUploaded: noop }), /Context changed/);
  assert.equal(uploaded, false);
});

test("repeated cursors fail instead of silently assigning a duplicate number", async () => {
  const api = loadFeature(feature, { fetchInvoiceDocuments: async () => ({ items: [], nextCursor: "same" }) });
  await assert.rejects(api.nextDeliveryDocumentNumber("invoice-1", noop), /all invoice documents/);
});
