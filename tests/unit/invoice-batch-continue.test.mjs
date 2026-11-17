import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadFeature(relative) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
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

const { createEmptyInvoiceForm, resetInvoiceFormForNextEntry } = loadFeature(
  "src/lib/invoices/types.ts",
);

function savedInvoice() {
  const base = createEmptyInvoiceForm("tester");
  return {
    ...base,
    autoGenerateNumber: false,
    date: "2026-11-17",
    containerId: "ctr-1",
    paymentLocation: "usa",
    pickupSource: "route",
    routeId: "route-1",
    routeCrewId: "crew-1",
    routeCrewName: "Crew A",
    senderId: "sender-1",
    sender: { id: "sender-1", name: "Sender" },
    receiverId: "receiver-1",
    receiver: { id: "receiver-1", name: "Receiver" },
    lineItems: [
      {
        ...base.lineItems[0],
        itemName: "Box",
        quantity: "2",
        unitPrice: "10",
        lineTotal: "20",
      },
    ],
    discount: "1",
  };
}

test("default reset keeps details only", () => {
  const next = resetInvoiceFormForNextEntry(savedInvoice());
  assert.equal(next.date, "2026-11-17");
  assert.equal(next.containerId, "ctr-1");
  assert.equal(next.routeId, "route-1");
  assert.equal(next.senderId, "");
  assert.equal(next.sender, null);
  assert.equal(next.lineItems[0].itemName, "");
  assert.equal(next.discount, "0");
});

test("pin on details clears the form", () => {
  const next = resetInvoiceFormForNextEntry(savedInvoice(), { batchStartKind: "details" });
  assert.equal(next.containerId, "");
  assert.equal(next.routeId, "");
  assert.equal(next.senderId, "");
  assert.equal(next.autoGenerateNumber, false);
});

test("pin on parties keeps details", () => {
  const next = resetInvoiceFormForNextEntry(savedInvoice(), { batchStartKind: "parties" });
  assert.equal(next.containerId, "ctr-1");
  assert.equal(next.senderId, "");
  assert.equal(next.receiver, null);
});

test("pin on line items keeps details and parties", () => {
  const next = resetInvoiceFormForNextEntry(savedInvoice(), { batchStartKind: "lineItems" });
  assert.equal(next.senderId, "sender-1");
  assert.equal(next.receiverId, "receiver-1");
  assert.equal(next.lineItems[0].itemName, "");
  assert.equal(next.discount, "0");
});

test("pin on payment keeps details, parties, and line items", () => {
  const previous = savedInvoice();
  const next = resetInvoiceFormForNextEntry(previous, { batchStartKind: "payment" });
  assert.equal(next.senderId, "sender-1");
  assert.equal(next.lineItems[0].itemName, "Box");
  assert.equal(next.discount, "1");
  assert.notEqual(next.invoiceId, previous.invoiceId);
});
