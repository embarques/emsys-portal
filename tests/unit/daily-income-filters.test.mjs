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

const { journalMatchesFilterRows } = loadFeature("src/lib/accounting/daily-income/filter-fields.ts");
const { summarizeJournalTotals } = loadFeature("src/lib/accounting/daily-income/journal-classification.ts");

function journal(overrides = {}) {
  return {
    id: "j1", incomeStatementId: 32685, date: "2026-10-28T14:00:00Z", transactionType: "PAYMENT", amount: 50,
    refNumber: "R-100", externalReferenceNumber: "EXT-9", description: "", currency: "USD", rate: 1,
    employee: { id: 12, name: "Ana Pérez" }, paymentMethod: { id: 2, name: "CHEQUE" }, checkNumber: "000123",
    invoice: { number: "80430", cost: 200, discount: 20, payment: 50, balance: 130 },
    accounts: [{ id: 1, name: "CHECKS TO DEPOSIT", type: "ASSET", debit: 50, credit: 0 }],
    apiTableValues: { createdBy: { userName: "admin1", name: "Maria Admin" } },
    ...overrides,
  };
}
const row = (field, operator, value, join = "and") => ({ id: `${field}-${operator}`, join, field, operator, value });

test("daily income advanced filters match every requested journal field", () => {
  const item = journal();
  const matches = (...rows) => journalMatchesFilterRows(item, rows);
  assert.equal(matches(row("invoice.number", "eq", "80430")), true);
  assert.equal(matches(row("date", "gte", "2026-10-28"), row("date", "lte", "2026-10-28")), true);
  assert.equal(matches(row("dateRange", "eq", "2026-10-01 to 2026-10-27")), false);
  assert.equal(matches(row("createdBy.name", "contains", "maria")), true);
  assert.equal(matches(row("createdBy.name", "eq", "admin1")), true);
  assert.equal(matches(row("accounts.name", "contains", "checks to")), true);
  assert.equal(matches(row("invoice.cost", "gte", "200"), row("invoice.payment", "eq", "50"), row("invoice.balance", "lte", "130")), true);
  assert.equal(matches(row("employee.name", "eq", "ana perez")), true, "accent-insensitive");
  assert.equal(matches(row("transactionType", "neq", "EXPENSE")), true);
  assert.equal(matches(row("paymentMethod.name", "eq", "CHECK")), true, "CHEQUE normalizes to CHECK");
  assert.equal(matches(row("paymentReference", "eq", "000123")), true, "check number keeps leading zeros");
  assert.equal(matches(row("external_reference_number", "startsWith", "ext")), true);
  assert.equal(matches(row("incomeStatement.id", "eq", "32685")), true);
  assert.equal(matches(row("refNumber", "eq", "R-101")), false);
});

test("advanced filter rows combine left to right and skip incomplete rows", () => {
  const item = journal();
  assert.equal(journalMatchesFilterRows(item, [row("refNumber", "eq", "nope"), row("invoice.number", "eq", "80430", "or")]), true);
  assert.equal(journalMatchesFilterRows(item, [row("refNumber", "eq", "nope"), row("invoice.number", "eq", "80430", "and")]), false);
  assert.equal(journalMatchesFilterRows(item, [row("refNumber", "eq", ""), row("unknownField", "eq", "x")]), true);
  assert.equal(journalMatchesFilterRows(journal({ invoice: undefined }), [row("invoice.number", "neq", "80430")]), true);
});

test("selected totals classify income and expenses like the Daily Income summary", () => {
  const totals = summarizeJournalTotals([
    journal({ amount: 50.1 }),
    journal({ id: "j2", transactionType: "SALES", amount: 20 }),
    journal({ id: "j3", transactionType: "EXPENSE", amount: 30, accounts: [] }),
    journal({ id: "j4", transactionType: "TRANSFER", amount: 999 }),
    journal({ id: "j5", transactionType: "INVENTORY", inventoryDirection: "dispatched", amount: 5 }),
    journal({ id: "j6", transactionType: "SALES", amount: 100, currency: "dop" }),
  ]);
  assert.deepEqual(totals, [
    { currency: "USD", income: 75.1, expenses: 30, net: 45.1, count: 5 },
    { currency: "DOP", income: 100, expenses: 0, net: 100, count: 1 },
  ]);
});
