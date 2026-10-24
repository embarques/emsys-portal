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
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        return load(target.endsWith(".json") ? target : fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const invoice = loadFeature("src/lib/invoices/appointment-invoice.ts");
const prefill = loadFeature("src/lib/invoices/appointment-invoice-prefill.ts");

const party = (id) => ({ id, name: id, phones: [], addresses: [] });
const sender = party("sender");

test("single receiver appointment fills sender, receiver, and the pickup reference", () => {
  const values = invoice.buildInvoiceFormFromAppointment({ id: 42, sender, receiver: null, receivers: [party("r1")] });
  assert.equal(values.pickupId, "42");
  assert.equal(values.senderId, "sender");
  assert.equal(values.sender.id, "sender");
  assert.equal(values.receiverId, "r1");
  assert.equal(values.receiver.id, "r1");
  assert.equal(values.lineItems.length, 1);
});

test("multiple receivers use the chosen one and otherwise stay unselected", () => {
  const order = { id: 7, sender, receiver: null, receivers: [party("r1"), party("r2"), party("r1")] };
  assert.equal(invoice.buildInvoiceFormFromAppointment(order, "r2").receiver.id, "r2");
  const unchosen = invoice.buildInvoiceFormFromAppointment(order);
  assert.equal(unchosen.receiverId, "");
  assert.equal(unchosen.receiver, null);
  assert.equal(invoice.resolveAppointmentInvoiceReceiver(order, "missing"), null);
});

test("appointments without receivers and legacy singular receivers", () => {
  assert.equal(invoice.buildInvoiceFormFromAppointment({ id: 1, sender, receiver: null, receivers: [] }).receiver, null);
  assert.equal(invoice.buildInvoiceFormFromAppointment({ id: 1, sender, receiver: party("legacy") }).receiverId, "legacy");
});

test("invoice tabs are distinct per appointment and receiver, plain add stays separate", () => {
  const same = prefill.isSameInvoiceAppointmentPrefill;
  assert.equal(same(undefined, undefined), true);
  assert.equal(same({ pickupId: "42" }, undefined), false);
  assert.equal(same({ pickupId: "42", receiverId: "r1" }, { pickupId: "42", receiverId: "r1" }), true);
  assert.equal(same({ pickupId: "42", receiverId: "r1" }, { pickupId: "42", receiverId: "r2" }), false);
});
