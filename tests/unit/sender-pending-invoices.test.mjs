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

const pending = loadFeature("src/lib/invoices/sender-pending-invoices.ts");
const en = JSON.parse(fs.readFileSync(path.join(root, "src/locales/en/orders.json"), "utf8"));
const es = JSON.parse(fs.readFileSync(path.join(root, "src/locales/es/orders.json"), "utf8"));

function translator(catalog) {
  return (key, params = {}) => {
    const template = key.replace(/^orders\./, "").split(".").reduce((node, part) => node?.[part], catalog);
    assert.equal(typeof template, "string", `missing key ${key}`);
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name]));
  };
}

const invoice = (invoiceNumber, balance) => ({ invoiceId: `id-${invoiceNumber}`, invoiceNumber, balance });

test("requests only the sender's invoices that are not closed", () => {
  const params = pending.buildSenderPendingInvoiceParams("cust-7");
  const fields = params.filterRows.map((row) => [row.field, row.operator, row.value]);
  assert.deepEqual(fields, [
    ["sender.id", "eq", "cust-7"],
    ["paidStatus", "neq", "CLOSED"],
  ]);
});

test("drops invoices without an outstanding balance", () => {
  const kept = pending.selectInvoicesWithBalance([invoice("1", 0), invoice("2", 12.5), invoice("3", -4)]);
  assert.deepEqual(kept.map((item) => item.invoiceNumber), ["2"]);
});

test("formats one invoice and several invoices with their total", () => {
  const t = translator(en);
  assert.equal(pending.formatPendingInvoicesComment([invoice("101", 120)], t), "Invoice #101 · Balance $120.00");
  assert.equal(
    pending.formatPendingInvoicesComment([invoice("101", 120), invoice("102", 50.25)], t),
    "Invoices #101 ($120.00), #102 ($50.25) · Total balance $170.25",
  );
  assert.equal(pending.formatPendingInvoicesComment([], t), "");
});

test("appends to existing comment text without duplicating separators", () => {
  assert.equal(pending.appendCommentText("", "Invoice #1"), "Invoice #1");
  assert.equal(pending.appendCommentText("Call first ", "Invoice #1"), "Call first · Invoice #1");
  assert.equal(pending.appendCommentText("Call first", ""), "Call first");
});

test("English and Spanish catalogs define the same pending invoice keys", () => {
  assert.deepEqual(
    Object.keys(es.comments.pendingInvoices).sort(),
    Object.keys(en.comments.pendingInvoices).sort(),
  );
  assert.equal(
    pending.formatPendingInvoicesComment([invoice("101", 120)], translator(es)),
    "Factura #101 · Balance $120.00",
  );
});
