import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const output = ts.transpileModule(fs.readFileSync("src/lib/accounting/daily-income/journal-editability.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loadedModule = { exports: {} };
new Function("exports", output)(loadedModule.exports);
const { journalEditBlockReason } = loadedModule.exports;

const current = { id: 32676, date: "2026-11-04", status: "OPEN", currency: "USD", rate: 1 };
const journal = (overrides = {}) => ({ id: "j1", incomeStatementId: 32676, transactionType: "EXPENSE", reconciliationStatus: "OUTSTANDING", ...overrides });

test("outstanding journals in the current open closeout are editable", () => {
  for (const transactionType of ["PAYMENT", "EXPENSE", "SALES", "DISCOUNT", "SURCHARGE", "TRANSFER"]) {
    assert.equal(journalEditBlockReason(journal({ transactionType }), current), null, transactionType);
  }
  assert.equal(journalEditBlockReason(journal({ reconciliationStatus: undefined }), current), null);
});

test("journals outside the current open closeout are blocked", () => {
  assert.equal(journalEditBlockReason(journal({ incomeStatementId: 32675 }), current), "closeout");
  assert.equal(journalEditBlockReason(journal(), { ...current, status: "CLOSED" }), "closeout");
  assert.equal(journalEditBlockReason(journal(), null), "closeout");
});

test("invoice registrations, inventory, loans and voids use their own workflows", () => {
  for (const transactionType of ["INITIAL-PAYMENT", "INVENTORY", "LOAN", "VOID"]) {
    assert.equal(journalEditBlockReason(journal({ transactionType }), current), "type", transactionType);
  }
});

test("reconciled, reversed and reversal journals are final", () => {
  assert.equal(journalEditBlockReason(journal({ reconciliationStatus: "RECONCILED" }), current), "reconciled");
  assert.equal(journalEditBlockReason(journal({ reversedAt: "2026-11-04T15:00:00Z" }), current), "reversed");
  assert.equal(journalEditBlockReason(journal({ reversalOf: "j0" }), current), "reversed");
});

test("cleared transactions and explicit backend edit restrictions block direct editing", () => {
 assert.equal(journalEditBlockReason(journal({clearanceStatus:"CLEARED"}),current),"cleared");
 assert.equal(journalEditBlockReason(journal({allowedActions:{edit:false}}),current),"restricted");
 assert.equal(journalEditBlockReason(journal({clearanceStatus:"OUTSTANDING",allowedActions:{edit:true}}),current),null);
});
