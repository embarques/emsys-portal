import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const output = ts.transpileModule(fs.readFileSync("src/lib/accounting/daily-income/journal-editability.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loadedModule = { exports: {} };
new Function("exports", output)(loadedModule.exports);
const { journalEditBlockReason } = loadedModule.exports;

const current = { id: 32676, date: "2026-11-04", status: "OPEN", currency: "USD", rate: 1 };
const journal = (overrides = {}) => ({
  id: "j1",
  incomeStatementId: 32676,
  transactionType: "EXPENSE",
  reconciliationStatus: "OUTSTANDING",
  version: 1,
  allowedActions: { edit: true },
  ...overrides,
});

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
  for (const transactionType of ["INITIAL-PAYMENT", "INVENTORY", "LOAN", "LOAN-PAYMENT", "VOID", "REVERSAL"]) {
    assert.equal(journalEditBlockReason(journal({ transactionType }), current), "type", transactionType);
  }
  assert.equal(journalEditBlockReason(journal({ loan: { id: 12 } }), current), "type");
  assert.equal(journalEditBlockReason(journal({ sourceSystem: "inventory_receipt" }), current), "type");
  assert.equal(journalEditBlockReason(journal({ sourceSystem: "legacy-api" }), current), "type");
});

test("reconciled, reversed and reversal journals are final", () => {
  assert.equal(journalEditBlockReason(journal({ reconciliationStatus: "RECONCILED" }), current), "reconciled");
  assert.equal(journalEditBlockReason(journal({ reconciliationStatus: "NOT_REQUIRED" }), current), "reversed");
  assert.equal(journalEditBlockReason(journal({ transactionStatus: "REVERSED" }), current), "reversed");
  assert.equal(journalEditBlockReason(journal({ reversedAt: "2026-11-04T15:00:00Z" }), current), "reversed");
  assert.equal(journalEditBlockReason(journal({ reversalOf: "j0" }), current), "reversed");
});

test("cleared transactions and explicit backend edit restrictions block direct editing", () => {
  assert.equal(journalEditBlockReason(journal({ clearanceStatus: "CLEARED" }), current), "cleared");
  assert.equal(journalEditBlockReason(journal({ allowedActions: { edit: false } }), current), "restricted");
  assert.equal(journalEditBlockReason(journal({ pendingChange: true }), current), "restricted");
  assert.equal(journalEditBlockReason(journal({ clearanceStatus: "OUTSTANDING", allowedActions: { edit: true } }), current), null);
});

test("missing eligibility or version fails closed", () => {
  assert.equal(journalEditBlockReason(journal({ allowedActions: undefined }), current), "restricted");
  assert.equal(journalEditBlockReason(journal({ version: undefined }), current), "restricted");
});


const { journalEditOperation, journalDeleteOperation } = loadedModule.exports;
test("simple Edit selects direct update before verification and atomic correction afterward", () => {
 assert.equal(journalEditOperation(journal(),current),"edit");
 for(const extra of [{reconciliationStatus:"RECONCILED"},{clearanceStatus:"CLEARED"},{incomeStatementId:1}]) {
  assert.equal(journalEditOperation(journal({...extra,allowedActions:{correct:true,edit:false}}),current),"correct");
  assert.equal(journalEditOperation(journal({...extra,allowedActions:{correct:false,edit:false}}),current),null);
 }
});

test("Delete prefers an allowed void, otherwise an allowed reversal", () => {
 assert.equal(journalDeleteOperation(journal({allowedActions:{void:true,reverse:true}})),"void");
 assert.equal(journalDeleteOperation(journal({allowedActions:{reverse:true}})),"reverse");
 assert.equal(journalDeleteOperation(journal()),null);
});

test("generic Edit/Delete never bypass dedicated lifecycles or inactive records", () => {
 for(const extra of [{transactionType:"INITIAL-PAYMENT"},{transactionType:"INVENTORY"},{transactionType:"LOAN-PAYMENT"},{transactionType:"LOAN-DECREASE"},{sourceSystem:"legacy-api"},{reversalOf:"offset"},{transactionStatus:"VOIDED"},{pendingChange:true},{version:undefined}]) {
  const row=journal({...extra,allowedActions:{edit:false,correct:true,void:true,reverse:true}});
  assert.equal(journalEditOperation(row,current),null,JSON.stringify(extra));
  assert.equal(journalDeleteOperation(row),null,JSON.stringify(extra));
 }
});
