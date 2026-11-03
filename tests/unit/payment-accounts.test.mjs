import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadFeature(relative, apiClient = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

async function withPaymentAccounts(run) {
  const previous = process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
  process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = "true";
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
    else process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = previous;
  }
}

const accounts = loadFeature("src/lib/accounting/daily-income/payment-accounts.ts");
const cashOnHand = { id: 1, name: "CASH ON HAND", displayName: "Cash on hand", type: "ASSET", systemAccount: true };
const register = { id: 2, name: "REGISTER", displayName: "Register", type: "ASSET", parentAccount: { id: 1 } };
const drawer = { id: 3, name: "DRAWER", displayName: "Drawer", type: "ASSET", parentAccount: { id: 2 } };
const receivable = { id: 4, name: "ACCOUNTS RECEIVABLE", displayName: "Accounts receivable", type: "ASSET", systemAccount: true };
const bank = { id: 10, name: "BANK", displayName: "Bank", type: "BANK", systemAccount: true };
const chase = { id: 11, name: "CHASE", displayName: "Chase", type: "BANK", parentAccount: { id: 10 } };
const checking = { id: 12, name: "CHECKING", displayName: "Checking", type: "BANK", parentAccount: { id: 11 } };
const statement = { id: 1, date: "2026-11-03", status: "OPEN", branch: { id: 2 }, currency: "USD", rate: 1 };

test("cash accounts are CASH ON HAND and ASSET accounts nested under it", () => {
  assert.equal(accounts.findDefaultCashAccount([receivable, cashOnHand])?.id, 1);
  assert.deepEqual(accounts.listCashAccounts([cashOnHand, register, drawer, receivable]).map((account) => account.id), [1, 2, 3]);
  assert.deepEqual(accounts.listCashAccounts([register, receivable]), []);
});

test("bank picker offers user-defined banks, else the general bank account", () => {
  assert.deepEqual(accounts.listSelectableBankAccounts([bank, chase, checking]).map((account) => account.id), [11, 12]);
  assert.equal(accounts.resolveDefaultBankAccount([bank])?.id, 10);
  assert.equal(accounts.resolveDefaultBankAccount([bank, chase, checking]), undefined);
  assert.equal(accounts.resolveDefaultBankAccount([chase])?.id, 11);
  assert.equal(accounts.findDefaultBankAccount([chase, checking]), undefined);
});

test("account options show the parent path and tolerate cycles", () => {
  const options = accounts.buildPaymentAccountOptions([checking, chase], [bank, chase, checking]);
  assert.deepEqual(options.map((option) => option.label), ["Bank › Chase", "Bank › Chase › Checking"]);
  const loopA = { id: 20, name: "A", displayName: "A", type: "BANK", parentAccount: { id: 21 } };
  const loopB = { id: 21, name: "B", displayName: "B", type: "BANK", parentAccount: { id: 20 } };
  assert.equal(accounts.buildPaymentAccountOptions([loopA], [loopA, loopB])[0].label, "B › A");
});

test("switching between cash and bank methods clears an incompatible account", () => {
  assert.equal(accounts.shouldClearMoneyAccount(true, "ASSET"), true);
  assert.equal(accounts.shouldClearMoneyAccount(false, "BANK"), true);
  assert.equal(accounts.shouldClearMoneyAccount(true, "BANK"), false);
  assert.equal(accounts.shouldClearMoneyAccount(false, undefined), false);
});

test("flag off: no cash account, Debit/Wire hidden, cash payment omits paymentAccount", async () => {
  let sent;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", { post: async (_url, body) => { sent = body; return { success: true, data: { id: "j1" } }; } });
  assert.equal(accounts.isCashAccountSelectable("PAYMENT", true), false);
  assert.deepEqual((await api.fetchAccountingPaymentMethods()).map((method) => method.name), ["CASH", "DEPOSIT", "CHECK", "ZELLE", "CREDIT-CARD"]);
  await api.createDailyIncomeJournal(statement, { transactionType: "PAYMENT", amount: 20, invoiceId: "inv-1", paymentMethodId: 1, paymentMethodName: "CASH", paymentAccountId: 2, paymentAccountName: "Register", paymentAccountType: "ASSET", refNumberMode: "system", refNumber: "", description: "" });
  assert.equal(sent.paymentAccount, undefined);
});

test("flag on: cash income posts the chosen cash account", () => withPaymentAccounts(async () => {
  let sent;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", { post: async (_url, body) => { sent = body; return { success: true, data: { id: "j1" } }; } });
  assert.deepEqual((await api.fetchAccountingPaymentMethods()).slice(-2).map((method) => method.name), ["DEBIT-CARD", "WIRE"]);
  await api.createDailyIncomeJournal(statement, { transactionType: "SALES", amount: 20, accountId: 7, accountName: "Sales", accountType: "REVENUE", paymentMethodId: 1, paymentMethodName: "CASH", paymentAccountId: 2, paymentAccountName: "Register", paymentAccountType: "ASSET", refNumberMode: "system", refNumber: "", description: "" });
  assert.deepEqual(sent.paymentAccount, { id: 2, name: "Register", type: "ASSET" });
  assert.deepEqual(sent.paymentMethod, { id: 1, name: "CASH" });
}));

test("flag on: a bank-paid expense posts its method and bank source account", () => withPaymentAccounts(async () => {
  let sent;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", { post: async (_url, body) => { sent = body; return { success: true, data: { id: "j1" } }; } });
  await api.createDailyIncomeJournal(statement, { transactionType: "EXPENSE", amount: 40, accountId: 7, accountName: "Fuel", accountType: "EXPENSE", sourceAccountId: 11, sourceAccountName: "Chase", sourceAccountType: "BANK", paymentMethodId: 7, paymentMethodName: "WIRE", externalReferenceNumber: "W-1", refNumberMode: "system", refNumber: "", description: "Fuel" });
  assert.deepEqual(sent.paymentMethod, { id: 7, name: "WIRE" });
  assert.deepEqual(sent.sourceAccount, { id: 11, name: "Chase", type: "BANK" });
  assert.equal(sent.paymentAccount, undefined);
  assert.equal(sent.external_reference_number, "W-1");
}));

test("flag on: expense schema requires a method and a bank source for bank methods", () => withPaymentAccounts(() => {
  const { dailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts");
  const base = { transactionType: "EXPENSE", amount: 40, accountId: 7, refNumber: "", description: "", employeeId: 1 };
  const issues = (values) => {
    const result = dailyIncomeJournalSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
  };
  assert.ok(issues({ ...base, sourceAccountId: 1, sourceAccountType: "ASSET" }).includes("paymentMethodId"));
  assert.ok(issues({ ...base, paymentMethodId: 4, paymentMethodName: "ZELLE", sourceAccountId: 1, sourceAccountType: "ASSET" }).includes("sourceAccountId"));
  assert.deepEqual(issues({ ...base, paymentMethodId: 4, paymentMethodName: "ZELLE", sourceAccountId: 11, sourceAccountType: "BANK" }), []);
  assert.deepEqual(issues({ ...base, paymentMethodId: 1, paymentMethodName: "CASH", sourceAccountId: 2, sourceAccountType: "ASSET" }), []);
}));

test("flag on: expense source account moves to the payment step", () => withPaymentAccounts(() => {
  const workflow = loadFeature("src/lib/accounting/daily-income/transaction-workflow.ts");
  assert.equal(workflow.hasPaymentDetailsStep("EXPENSE"), true);
  assert.equal(workflow.getTransactionFieldStep("sourceAccountId", "EXPENSE"), "payment");
  assert.equal(workflow.getTransactionStepFields("amounts", "EXPENSE").includes("sourceAccountId"), false);
  assert.equal(workflow.getTransactionFieldStep("sourceAccountId", "TRANSFER"), "amounts");
}));
