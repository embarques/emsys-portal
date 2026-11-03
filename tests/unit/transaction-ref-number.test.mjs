import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDailyIncomeRefNumberMode,
  resolveJournalRefNumberForCreate,
  resolveJournalRefNumberForWrite,
} from "../../src/lib/accounting/daily-income/ref-number.ts";

test("resolveDailyIncomeRefNumberMode defaults to system when empty", () => {
  assert.equal(resolveDailyIncomeRefNumberMode({}), "system");
  assert.equal(resolveDailyIncomeRefNumberMode({ refNumber: "" }), "system");
  assert.equal(resolveDailyIncomeRefNumberMode({ refNumber: "  " }), "system");
  assert.equal(resolveDailyIncomeRefNumberMode({ refNumber: "REF-1" }), "custom");
  assert.equal(resolveDailyIncomeRefNumberMode({ refNumberMode: "system", refNumber: "REF-1" }), "system");
  assert.equal(resolveDailyIncomeRefNumberMode({ refNumberMode: "custom" }), "custom");
});

test("resolveJournalRefNumberForWrite omits system and returns custom trim", () => {
  assert.equal(resolveJournalRefNumberForWrite({ refNumberMode: "system", refNumber: "x" }), undefined);
  assert.equal(resolveJournalRefNumberForWrite({ refNumber: "" }), undefined);
  assert.equal(resolveJournalRefNumberForWrite({ refNumberMode: "custom", refNumber: "  A-1  " }), "A-1");
  assert.equal(resolveJournalRefNumberForWrite({ refNumberMode: "custom", refNumber: "   " }), undefined);
});

test("resolveJournalRefNumberForCreate defaults new invoices to the invoice number", () => {
  const invoice = { transactionType: "INITIAL-PAYMENT", refNumberMode: "system", refNumber: "", invoiceNumber: " INV-42 " };
  assert.equal(resolveJournalRefNumberForCreate(invoice), "INV-42");
  assert.equal(resolveJournalRefNumberForCreate({ ...invoice, refNumberMode: "custom", refNumber: "REF-9" }), "REF-9");
  assert.equal(resolveJournalRefNumberForCreate({ ...invoice, refNumberMode: "custom", refNumber: " " }), undefined);
  assert.equal(resolveJournalRefNumberForCreate({ ...invoice, autoGenerateInvoiceNumber: true }), undefined);
  assert.equal(resolveJournalRefNumberForCreate({ ...invoice, transactionType: "PAYMENT" }), undefined);
});
