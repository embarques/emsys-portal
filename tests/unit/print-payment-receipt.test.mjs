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
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}


const feature = "src/lib/accounting/daily-income/print-payment-receipt.ts";
const api = loadFeature(feature, {});
const id = "507f1f77bcf86cd799439011";
test("payment receipts use the selected journal directly", () => {
 for (const transactionType of ["PAYMENT", "INITIAL-PAYMENT"]) {
  assert.deepEqual(api.buildPaymentReceiptRequest({ id, transactionType }), { type: "transaction", collection: "journals", values: [id], lookupField: "id", format: "pdf" });
 }
});
test("non-payment rows and invalid identifiers cannot print payment receipts", () => {
 for (const transactionType of ["EXPENSE", "DISCOUNT", "INCOME"]) {
  assert.equal(api.canPrintPaymentReceipt({ transactionType }), false);
  assert.throws(() => api.buildPaymentReceiptRequest({ id, transactionType }));
 }
 assert.throws(() => api.buildPaymentReceiptRequest({ id: "", transactionType: "PAYMENT" }));
});
