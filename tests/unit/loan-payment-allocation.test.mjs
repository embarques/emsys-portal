import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const filename = path.join(root, "src/lib/accounting/loans/payment-allocation.ts");
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loadedModule = { exports: {} };
new Function("require", "module", "exports", source)(() => ({}), loadedModule, loadedModule.exports);
const { allocateLoanPayment, sortLoansOldestFirst } = loadedModule.exports;

function loan(id, openedAt, principalAmount, paidAmount, createdAt = `${openedAt}T00:00:00Z`) {
  return { id, openedAt, createdAt, principalAmount, paidAmount, balance: principalAmount - paidAmount };
}

test("sortLoansOldestFirst orders by opened date, then creation time", () => {
  const sorted = sortLoansOldestFirst([
    loan("c", "2026-03-01", 100, 0),
    loan("b", "2026-01-15", 100, 0, "2026-01-15T12:00:00Z"),
    loan("a", "2026-01-15", 100, 0, "2026-01-15T08:00:00Z"),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "b", "c"]);
});

test("allocateLoanPayment fills the oldest balance before the next loan", () => {
  const result = allocateLoanPayment([loan("old", "2026-01-01", 500, 400), loan("new", "2026-02-01", 300, 0)], 150);
  assert.deepEqual(
    result.rows.map(({ loan: item, applied, balanceAfter }) => [item.id, applied, balanceAfter]),
    [["old", 100, 0], ["new", 50, 250]],
  );
  assert.deepEqual(result.totals, { principalAmount: 800, paidAmount: 400, balance: 400, applied: 150, balanceAfter: 250 });
  assert.equal(result.unapplied, 0);
});

test("allocateLoanPayment reports the amount above the combined balance", () => {
  const result = allocateLoanPayment([loan("only", "2026-01-01", 100, 99.9)], 0.3);
  assert.equal(result.rows[0].applied, 0.1);
  assert.equal(result.rows[0].balanceAfter, 0);
  assert.equal(result.unapplied, 0.2);
});

test("allocateLoanPayment leaves balances untouched for a zero amount", () => {
  const result = allocateLoanPayment([loan("only", "2026-01-01", 100, 25)], 0);
  assert.deepEqual(result.totals, { principalAmount: 100, paidAmount: 25, balance: 75, applied: 0, balanceAfter: 75 });
});
