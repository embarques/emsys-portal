import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const output = ts.transpileModule(fs.readFileSync("src/lib/accounting/daily-income/session-transactions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loadedModule = { exports: {} };
new Function("exports", output)(loadedModule.exports);
const { sessionTransactionDetails, sessionTransactionTotals } = loadedModule.exports;
const entry = (type, amount, extra = {}, values = {}) => ({ journal: { id: "1", transactionType: type, amount, ...extra }, values: { transactionType: type, ...values }, statementId: 1, savedAt: 1 });

test("invoice summary uses saved amounts, preserves zero balance, and falls back for omitted invoice fields", () => {
 const d = sessionTransactionDetails(entry("INITIAL-PAYMENT", 85, { invoice: { number: "80422", cost: 85, balance: 0 } }, { invoiceCost: 100, invoiceNumber: "old" }));
 assert.equal(d.balance, 0);
 assert.equal(d.cost, 85);
 assert.equal(d.invoice, "80422");
 const missing = sessionTransactionDetails(entry("INITIAL-PAYMENT", 150, {}, { invoiceCost: 200, invoiceNumber: "80423", paymentMethodName: "CASH" }));
 assert.equal(missing.balance, 50);
 assert.equal(missing.method, "CASH");
 assert.equal(sessionTransactionDetails(entry("PAYMENT", 40, {}, { invoiceBalance: 60 })).balance, 60);
});

test("invoice totals include zero-payment registrations; other types stay separate", () => {
 const totals = sessionTransactionTotals([
 entry("INITIAL-PAYMENT", 150, {}, { invoiceCost: 200 }),
 entry("INITIAL-PAYMENT", 85, {}, { invoiceCost: 85 }),
 entry("INITIAL-PAYMENT", 0, {}, { invoiceCost: 120 }),
 entry("EXPENSE", 25), entry("TRANSFER", 100), entry("DISCOUNT", 10),
 ]);
 assert.deepEqual(totals[0], { type: "INITIAL-PAYMENT", count: 3, cost: 405, discount: 0, amount: 235, balance: 170 });
 assert.equal(totals.find(x => x.type === "EXPENSE").amount, 25);
 assert.equal(totals.find(x => x.type === "TRANSFER").amount, 100);
 assert.deepEqual(sessionTransactionTotals([]), []);
});

test("invoice discounts use saved values, preserve explicit zero, and reduce fallback balances", () => {
 const saved = entry("INITIAL-PAYMENT", 80, { invoice: { cost: 100, discount: 20, balance: 0 } }, { invoiceDiscount: 30 });
 const missing = entry("INITIAL-PAYMENT", 40, {}, { invoiceCost: 100, invoiceDiscount: 10 });
 const zero = entry("INITIAL-PAYMENT", 80, { invoice: { cost: 100, discount: 0 } }, { invoiceDiscount: 20 });
 assert.equal(sessionTransactionDetails(saved).discount, 20);
 assert.equal(sessionTransactionDetails(saved).balance, 0);
 assert.equal(sessionTransactionDetails(missing).discount, 10);
 assert.equal(sessionTransactionDetails(missing).balance, 50);
 assert.equal(sessionTransactionDetails(zero).discount, 0);
 assert.equal(sessionTransactionDetails(zero).balance, 20);
 assert.deepEqual(sessionTransactionTotals([saved, missing, zero])[0], {
  type: "INITIAL-PAYMENT", count: 3, cost: 300, discount: 30, amount: 200, balance: 70,
 });
 const fractional = entry("INITIAL-PAYMENT", 0.1, {}, { invoiceCost: 0.3, invoiceDiscount: 0.2 });
 assert.equal(sessionTransactionDetails(fractional).balance, 0);
});

test("Total combines collections and outflows without adding invoice cost or unpaid balance", () => {
 const { sessionTransactionsNetTotal } = loadedModule.exports;
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 1210, {}, { invoiceCost: 1210 }), entry("EXPENSE", 125), entry("EXPENSE", 10)]), 1075);
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 0, {}, { invoiceCost: 200 })]), 0);
 assert.equal(sessionTransactionsNetTotal([entry("PAYMENT", 100), entry("DISCOUNT", 10), entry("TRANSFER", 20), entry("LOAN", 5)]), 75);
 assert.equal(sessionTransactionsNetTotal([entry("INVENTORY", 30, { inventoryDirection: "received" }), entry("INVENTORY", 50, { inventoryDirection: "dispatched" })]), 20);
 assert.equal(sessionTransactionsNetTotal([entry("SURCHARGE", 10)]), 0);
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 100, { accounts: [{ name: "CASH ON HAND", type: "ASSET", debit: 40, credit: 0 }, { name: "ACCOUNTS RECEIVABLE", type: "ASSET", debit: 60, credit: 0 }, { name: "SALES", type: "REVENUE", debit: 0, credit: 100 }] })]), 40);
 assert.equal(sessionTransactionsNetTotal([entry("SALES", 0.1), entry("SALES", 0.2)]), 0.3);
});

test("discounts reduce accounts receivable, not the cash total", () => {
 const { sessionTransactionsNetTotal } = loadedModule.exports;
 const discountLines = [{ name: "SALES DISCOUNTS", type: "EXPENSE", debit: 20, credit: 0 }, { name: "ACCOUNTS RECEIVABLE", type: "ASSET", debit: 0, credit: 20 }];
 assert.equal(sessionTransactionsNetTotal([entry("DISCOUNT", 20, { accounts: discountLines })]), 0);
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 80, { accounts: [{ name: "CASH ON HAND", type: "ASSET", debit: 80, credit: 0 }, { name: "SALES DISCOUNTS", type: "EXPENSE", debit: 20, credit: 0 }] })]), 80);
 assert.equal(sessionTransactionsNetTotal([entry("EXPENSE", 15, { accounts: [{ name: "OFFICE SUPPLIES", type: "EXPENSE", debit: 15, credit: 0 }] })]), -15);
});
