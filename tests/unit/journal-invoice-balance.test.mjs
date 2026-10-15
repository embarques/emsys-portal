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


for (const [name, fields, expected] of [
 ["paid invoice with omitted zero", {transactionAmount:90, invoice:{number:"487282",cost:90}}, 0],
 ["partially paid invoice", {transactionAmount:50, invoice:{number:"40000",cost:100}}, 50],
 ["unpaid invoice", {invoice:{number:"40000",cost:100}}, 100],
 ["discounted invoice", {transactionAmount:80, invoice:{number:"40000",cost:100,discount:10}}, 10],
 ["explicit zero wins", {transactionAmount:50, invoice:{number:"40000",cost:100,balance:0}}, 0],
 ["top-level balance", {transactionBalance:25, invoice:{number:"40000",cost:100}}, 25],
 ["invoice cumulative payment", {transactionType:"PAYMENT",transactionAmount:20,invoice:{number:"40000",cost:100,payment:80}}, 20],
 ["expense has no invoice balance", {transactionType:"EXPENSE",transactionAmount:125}, undefined],
]) {
 test(`journal balance: ${name}`, async () => {
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {get:async()=>({data:{id:"journal-1",transactionType:"INITIAL-PAYMENT",...fields}})});
  const journal = await api.fetchDailyIncomeJournal("journal-1");
  assert.equal(journal.invoice?.balance, expected);
 });
}
