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



const signature = { signerName: "Juan Lopez", data: "aGVsbG8=", contentType: "image/png" };

for (const method of ["createInvoice", "updateInvoice"]) {
  for (const withSignature of [false, true]) {
    test(`${method}: ${withSignature ? "provided" : "omitted"} signature preserves write contract`, async () => {
      let payload;
      const stop = new Error("Captured request");
      const send = async (_, body) => { payload = JSON.parse(JSON.stringify(body)); throw stop; };
      const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { post: send, put: send });
      const types = loadFeature("src/lib/invoices/types.ts", {});
      const customers = loadFeature("src/lib/customers/types.ts", {});
      const values = {
        ...types.createEmptyInvoiceForm(), autoGenerateNumber: false, invoiceNumber: "TEST-1", date: "2026-10-22",
        sender: { ...customers.createEmptyCustomerForm(), id: "customer-1", name: "Juan Lopez" },
        lineItems: [{ ...types.createEmptyInvoiceLineItem(), itemName: "Box", quantity: "1", labels: "1", unitPrice: "80", total: "80" }],
      };
      const context = { branch: { id: 1, name: "NY", code: "NY" }, container: { id: 1, name: "Test" },
        ...(withSignature ? { customerSignature: { ...signature, signedAt: "client-time", collectedBy: { id: "client" } } } : {}) };
      await assert.rejects(method === "createInvoice" ? api.createInvoice(values, context) : api.updateInvoice("507f1f77bcf86cd799439011", values, context), error => error === stop);
      if (method === "createInvoice" && withSignature) assert.deepEqual(payload.customerSignature, signature);
      else assert.equal(Object.hasOwn(payload, "customerSignature"), false);
      assert.equal(Object.hasOwn(payload, "receiverSignature"), false);
    });
  }
}

test("signature adapter strips the PNG data URL prefix and validates required fields", () => {
  const { buildCustomerSignature } = loadFeature("src/lib/invoices/schemas/customer-signature.schema.ts", {});
  assert.deepEqual(buildCustomerSignature(" Juan Lopez ", "data:image/png;base64,aGVsbG8="), signature);
  for (const [name, data] of [["", "data:image/png;base64,aGVsbG8="], ["Juan", "data:image/png;base64,"], ["Juan", "data:image/jpeg;base64,aGVsbG8="], ["Juan", "data:image/png;base64,<invalid>"]]) {
    assert.throws(() => buildCustomerSignature(name, data));
  }
});

test("skip signature allows unsigned creation without skipping policy agreement", () => {
  const { findInvoiceWizardPoliciesIssue } = loadFeature("src/lib/invoices/invoice-wizard-validation.ts", {});
  const t = key => key;
  assert.equal(findInvoiceWizardPoliciesIssue({ agreed: true, skipSignature: true, signatureDataUrl: null }, t, 5), null);
  assert.match(findInvoiceWizardPoliciesIssue({ agreed: false, skipSignature: true, signatureDataUrl: null }, t, 5).message, /policiesAgreeRequired/);
  assert.match(findInvoiceWizardPoliciesIssue({ agreed: true, skipSignature: false, signatureDataUrl: null }, t, 5).message, /policiesSignatureRequired/);
});

test("receiver signature addresses the delivery by barcode delivery ID and sends only submitted fields", async () => {
  let captured;
  const api = loadFeature("src/lib/invoices/api/invoice-signatures-api.ts", {
    put: async (url, body) => { captured = { url, body }; },
  });
  await api.saveInvoiceReceiverSignature({ deliveryId: "5", invoiceId: "invoice-1", receiverSignature: { ...signature, idNumber: "001-1234567-8", signedAt: "client-time" } });
  assert.deepEqual(captured, { url: "/deliveries/5/invoices/invoice-1/receiver/signature", body: { deliveryId: 5, receiverSignature: { ...signature, idNumber: "001-1234567-8" } } });
  await assert.rejects(api.saveInvoiceReceiverSignature({ deliveryId: "", invoiceId: "invoice-1", receiverSignature: signature }));
});

test("receiver signature propagates API failure", async () => {
  const api = loadFeature("src/lib/invoices/api/invoice-signatures-api.ts", { put: async () => ({ success: false, message: "Delivery mismatch" }) });
  await assert.rejects(api.saveInvoiceReceiverSignature({ deliveryId: "5", invoiceId: "invoice-1", receiverSignature: { ...signature, idNumber: "123" } }), /Delivery mismatch/);
});
