import assert from "node:assert/strict";
import test from "node:test";
import { getInvoicePaymentBalancePreview as preview } from "../../src/lib/accounting/daily-income/invoice-balance-preview.ts";

test("payment preview subtracts cents without changing the authoritative balance", () => {
  assert.deepEqual(preview(100, 20), { previousBalance: 100, newBalance: 80 });
  assert.deepEqual(preview(0.3, 0.1), { previousBalance: 0.3, newBalance: 0.2 });
  assert.deepEqual(preview(100, 0), { previousBalance: 100, newBalance: 100 });
  assert.deepEqual(preview(100, 100), { previousBalance: 100, newBalance: 0 });
  assert.deepEqual(preview(100, 101), { previousBalance: 100, newBalance: -1 });
});

test("editing an applied payment restores its saved amount only for the same invoice", () => {
  const original = { invoiceId: "one", amount: 20 };
  assert.deepEqual(preview(80, 20, "one", original), { previousBalance: 100, newBalance: 80 });
  assert.deepEqual(preview(80, 30, "one", original), { previousBalance: 100, newBalance: 70 });
  assert.deepEqual(preview(80, 20, "two", original), { previousBalance: 80, newBalance: 60 });
});

test("an unknown balance stays unknown and an invalid amount is not displayed as money", () => {
  assert.deepEqual(preview(undefined, 20), { previousBalance: null, newBalance: null });
  assert.deepEqual(preview(NaN, 20), { previousBalance: null, newBalance: null });
  assert.deepEqual(preview(100, undefined), { previousBalance: 100, newBalance: 100 });
  assert.deepEqual(preview(100, Infinity), { previousBalance: 100, newBalance: null });
});
