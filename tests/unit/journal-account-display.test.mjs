import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");

function load(filename) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (specifier) => load(path.join(root, "src", specifier.replace(/^@\//, "")) + ".ts");
  new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { buildChartAccountsById, isChartAccountType, resolveJournalAccount, resolveJournalRowAccount } = load(
  path.join(root, "src/lib/accounting/daily-income/journal-account.ts"),
);
const chart = buildChartAccountsById([{ id: 7, name: "SALES", displayName: "Sales income", type: "REVENUE" }]);

test("resolveJournalAccount prefers the chart of accounts entry by id", () => {
  assert.deepEqual(resolveJournalAccount({ id: 7, name: "SALES", type: "INCOME" }, chart), { name: "Sales income", type: "REVENUE" });
});

test("resolveJournalAccount falls back to the journal snapshot", () => {
  assert.deepEqual(resolveJournalAccount({ id: 99, name: "FUEL", type: "expense" }, chart), { name: "FUEL", type: "EXPENSE" });
  assert.deepEqual(resolveJournalAccount({ id: 0, name: "Petty cash" }), { name: "Petty cash", type: "" });
  assert.equal(resolveJournalAccount(undefined, chart), null);
});

test("resolveJournalRowAccount falls back to the debited line for payments", () => {
  const accounts = [
    { id: 2, name: "ACCOUNTS RECEIVABLE", type: "ASSET", debit: 0, credit: 10 },
    { id: 1, name: "CASH ON HAND", type: "ASSET", debit: 10, credit: 0 },
  ];
  assert.deepEqual(resolveJournalRowAccount({ accounts }), { name: "CASH ON HAND", type: "ASSET" });
  assert.deepEqual(resolveJournalRowAccount({ account: { id: 7, name: "SALES" }, accounts }, chart), { name: "Sales income", type: "REVENUE" });
  assert.equal(resolveJournalRowAccount({ accounts: [] }), null);
});

test("isChartAccountType only accepts chart of accounts types", () => {
  assert.equal(isChartAccountType("BANK"), true);
  assert.equal(isChartAccountType("INCOME"), false);
});
