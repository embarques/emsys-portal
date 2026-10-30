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

const { pendingTransactionSearch } = loadFeature("src/lib/accounting/pending-transactions/search.ts");
const row = (field, operator, value, join = "and") => ({ id: field, field, operator, value, join });
const leaves = node => node.filters ? node.filters.flatMap(leaves) : [node];

test("pending search always ANDs outstanding status outside user OR filters", () => {
  const body = pendingTransactionSearch("Ana", [row("employee.name", "contains", "Ana"), row("invoice.number", "eq", "123", "or")], 2);
  assert.equal(body.operator, "and");
  assert.deepEqual(body.pagination, { page: 2, limit: 40, offset: 40 });
  assert.deepEqual(leaves(body.filters.at(-1)), [{ field: "reconciliationStatus", operator: "eq", value: "OUTSTANDING" }]);
  assert.equal(body.filters[0].operator, "or");
  assert.equal(body.filters[1].operator, "or");
  assert.equal(leaves(body).filter(node => node.field === "incomeStatement.id").length, 0);
});

test("pending advanced filters expand date ranges and retain numeric zero", () => {
  const body = pendingTransactionSearch("", [row("dateRange", "eq", "2026-10-01 to 2026-10-30"), row("transactionAmount", "gte", "0"), row("branch.id", "eq", "2")], 1);
  const filters = leaves(body);
  assert.ok(filters.some(node => node.field === "date" && node.operator === "gte" && node.value === "2026-10-01"));
  assert.ok(filters.some(node => node.field === "date" && node.operator === "lte" && node.value === "2026-10-30"));
  assert.ok(filters.some(node => node.field === "transactionAmount" && node.value === 0));
  assert.ok(filters.some(node => node.field === "branch.id" && node.value === 2));
  assert.equal(filters.some(node => node.field === "dateRange"), false);
});
