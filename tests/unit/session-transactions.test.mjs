import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const output = ts.transpileModule(fs.readFileSync("src/lib/accounting/daily-income/session-transactions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("exports", output)(module.exports);
const { sessionTransactionDetails, sessionTransactionTotals } = module.exports;
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
 assert.deepEqual(totals[0], { type: "INITIAL-PAYMENT", count: 3, cost: 405, amount: 235, balance: 170 });
 assert.equal(totals.find(x => x.type === "EXPENSE").amount, 25);
 assert.equal(totals.find(x => x.type === "TRANSFER").amount, 100);
 assert.deepEqual(sessionTransactionTotals([]), []);
});

test("Total combines collections and outflows without adding invoice cost or unpaid balance", () => {
 const { sessionTransactionsNetTotal } = module.exports;
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 1210, {}, { invoiceCost: 1210 }), entry("EXPENSE", 125), entry("EXPENSE", 10)]), 1075);
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 0, {}, { invoiceCost: 200 })]), 0);
 assert.equal(sessionTransactionsNetTotal([entry("PAYMENT", 100), entry("DISCOUNT", 10), entry("TRANSFER", 20), entry("LOAN", 5)]), 65);
 assert.equal(sessionTransactionsNetTotal([entry("INVENTORY", 30, { inventoryDirection: "received" }), entry("INVENTORY", 50, { inventoryDirection: "dispatched" })]), 20);
 assert.equal(sessionTransactionsNetTotal([entry("SURCHARGE", 10)]), 0);
 assert.equal(sessionTransactionsNetTotal([entry("INITIAL-PAYMENT", 100, { accounts: [{ name: "CASH ON HAND", type: "ASSET", debit: 40, credit: 0 }, { name: "ACCOUNTS RECEIVABLE", type: "ASSET", debit: 60, credit: 0 }, { name: "SALES", type: "REVENUE", debit: 0, credit: 100 }] })]), 40);
 assert.equal(sessionTransactionsNetTotal([entry("SALES", 0.1), entry("SALES", 0.2)]), 0.3);
});
