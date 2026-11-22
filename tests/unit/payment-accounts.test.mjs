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
const legacyCashAccount = { id: 9, name: "Cash Account", displayName: "Cash Account", type: "ASSET", systemAccount: true, parentAccount: { id: 1 } };
const register = { id: 31, name: "REGISTER", displayName: "Register", type: "ASSET", parentAccount: { id: 1 } };
const drawer = { id: 32, name: "DRAWER", displayName: "Drawer", type: "ASSET", parentAccount: { id: 31 } };
const receivable = { id: 2, name: "ACCOUNTS RECEIVABLE", displayName: "Accounts receivable", type: "ASSET", systemAccount: true };
const bank = { id: 10, name: "BANK", displayName: "Bank", type: "BANK", systemAccount: true };
const chase = { id: 11, name: "CHASE", displayName: "Chase", type: "BANK", parentAccount: { id: 10 } };
const checking = { id: 12, name: "CHECKING", displayName: "Checking", type: "BANK", parentAccount: { id: 11 } };
const statement = { id: 1, date: "2026-11-03", status: "OPEN", branch: { id: 2 }, currency: "USD", rate: 1 };

test("cash accounts are CASH ON HAND and ASSET accounts nested under it", () => {
  assert.equal(accounts.findDefaultCashAccount([receivable, cashOnHand])?.id, 1);
  assert.deepEqual(accounts.listCashAccounts([cashOnHand, register, drawer, receivable]).map((account) => account.id), [1, 31, 32]);
  assert.deepEqual(accounts.listCashAccounts([register, receivable]), []);
});

test("account hierarchy levels cascade and allow stopping at any posting level", () => {
  const cashRoot = { id: 1, name: "CASH ON HAND", displayName: "Cash on hand", type: "ASSET", systemAccount: true };
  const petty = { id: 20, name: "PETTY CASH", displayName: "Petty cash", type: "ASSET", parentAccount: { id: 1 } };
  const tape = { id: 21, name: "PETTY TAPE CASH", displayName: "Petty tape cash", type: "ASSET", parentAccount: { id: 20 } };
  const bankRoot = { id: 10, name: "BANK", displayName: "Bank", type: "BANK", systemAccount: true };
  const mt = { id: 11, name: "M&T BANK", displayName: "M&T Bank", type: "BANK", parentAccount: { id: 10 } };
  const checking = { id: 12, name: "M&T CHECKING", displayName: "M&T checking", type: "BANK", parentAccount: { id: 11 } };
  const cashPool = [cashRoot, petty, tape];
  const bankPool = [bankRoot, mt, checking];

  assert.deepEqual(accounts.listCashHierarchyRoots(cashPool).map((account) => account.id), [1]);
  assert.deepEqual(accounts.listBankHierarchyRoots(bankPool).map((account) => account.id), [11]);
  assert.deepEqual(accounts.listPostingChildren(cashPool, 1).map((account) => account.id), [20]);
  assert.deepEqual(accounts.listPostingChildren(cashPool, 20).map((account) => account.id), [21]);

  const cashLevels = accounts.buildAccountHierarchyLevels(cashPool, accounts.listCashHierarchyRoots(cashPool), 20);
  assert.deepEqual(cashLevels.map((level) => level.valueId ?? null), [1, 20, null]);
  assert.deepEqual(cashLevels[1].options.map((account) => account.id), [20]);
  assert.deepEqual(cashLevels[2].options.map((account) => account.id), [21]);

  const bankLevels = accounts.buildAccountHierarchyLevels(bankPool, accounts.listBankHierarchyRoots(bankPool), 12);
  assert.deepEqual(bankLevels.map((level) => level.valueId ?? null), [11, 12]);
  assert.equal(bankLevels.length, 2);

  assert.deepEqual(
    accounts.listTransferHierarchyRoots(cashPool, bankPool).map((account) => account.id),
    [1, 11],
  );
});

test("legacy Cash Account is merged into Cash on Hand for pickers", () => {
  assert.equal(accounts.isLegacyCashAccountAlias(legacyCashAccount), true);
  assert.deepEqual(
    accounts.listCashAccounts([cashOnHand, legacyCashAccount, register, receivable]).map((account) => account.id),
    [1, 31],
  );
  assert.deepEqual(
    accounts.listExpenseSourceAccounts([cashOnHand, legacyCashAccount, register, receivable]).map((account) => account.id),
    [1, 31],
  );
});

test("expense source accounts exclude receivables and other non-cash assets", () => {
  const loanReceivable = { id: 5, name: "LOAN RECEIVABLE", displayName: "Loan receivable", type: "ASSET", systemAccount: true };
  const nonPostingCash = { id: 6, name: "PETTY CASH GROUP", displayName: "Petty cash group", type: "ASSET", parentAccount: { id: 1 }, nonPosting: true };
  assert.deepEqual(
    accounts.listExpenseSourceAccounts([cashOnHand, register, drawer, receivable, loanReceivable, nonPostingCash]).map((account) => account.id),
    [1, 31, 32],
  );
});

test("reserved receivable and clearing IDs cannot become cash through reparenting or renamed labels", () => {
  const misplaced = [2, 5, 4_000_000_001, 4_000_000_002].map((id) => ({
    id, name: "Cash drawer", type: "ASSET", parentAccount: { id: 1 },
  }));
  assert.deepEqual(accounts.listCashAccounts([cashOnHand, register, ...misplaced]).map((a) => a.id), [1, 31]);
  assert.deepEqual(accounts.listExpenseSourceAccounts([cashOnHand, ...misplaced]).map((a) => a.id), [1]);
});

test("only the known legacy cash asset directly under Cash on Hand is an alias", () => {
  assert.equal(accounts.isLegacyCashAccountAlias({ ...legacyCashAccount, name: " cash account " }), true);
  for (const unrelated of [
    { ...legacyCashAccount, type: "BANK" },
    { ...legacyCashAccount, parentAccount: undefined },
    { ...legacyCashAccount, parentAccount: { id: 31 } },
    { ...legacyCashAccount, id: 33 },
  ]) assert.equal(accounts.isLegacyCashAccountAlias(unrelated), false);
  const custom = { ...legacyCashAccount, id: 33 };
  assert.deepEqual(accounts.listCashAccounts([cashOnHand, legacyCashAccount, custom]).map((a) => a.id), [1, 33]);
});

test("cash expense validation rejects reserved IDs before sending requests with either flag setting", async () => {
  const previous = process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
  try {
    for (const enabled of ["false", "true"]) {
      process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = enabled;
      let requests = 0;
      const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
        post: async () => { requests += 1; throw new Error("unexpected request"); },
      });
      const { dailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts");
      const base = { transactionType: "EXPENSE", amount: 10, accountId: 43, accountType: "EXPENSE", employeeId: 1,
        refNumber: "", description: "", paymentMethodId: 1, paymentMethodName: "CASH", sourceAccountType: "ASSET" };
      for (const id of [2, 5, 4_000_000_001, 4_000_000_002]) {
        const values = { ...base, sourceAccountId: id };
        const result = dailyIncomeJournalSchema.safeParse(values);
        assert.equal(result.success, false);
        assert.ok(result.error.issues.some((issue) => issue.path[0] === "sourceAccountId"));
        await assert.rejects(api.createDailyIncomeJournal(statement, values), /cash|efectivo/i);
      }
      assert.equal(requests, 0);
      assert.equal(dailyIncomeJournalSchema.safeParse({ ...base, sourceAccountId: 31 }).success, true);
      assert.equal(dailyIncomeJournalSchema.safeParse({ ...base, sourceAccountId: 11, sourceAccountType: "BANK" }).success, false);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
    else process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = previous;
  }
});

test("historical expense labels and source identity survive form loading unchanged", () => {
  const { journalToFormValues, areDailyIncomeJournalValuesEquivalent } = loadFeature("src/lib/accounting/daily-income/journal-form.ts");
  const row = { transactionType: "EXPENSE", amount: 10, accounts: [],
    account: { id: 43, name: "Fuel", type: "EXPENSE" },
    sourceAccount: { id: 9, name: "Cash Account", type: "ASSET" } };
  const values = journalToFormValues(row);
  assert.equal(values.sourceAccountId, 9);
  assert.equal(values.sourceAccountName, "Cash Account");
  assert.equal(row.sourceAccount.name, "Cash Account");
  assert.equal(areDailyIncomeJournalValuesEquivalent(values, journalToFormValues(row)), true);
});

test("cash expense posting keeps the category separate and preserves valid selected funding", async () => {
  const previous = process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
  try {
    for (const enabled of ["false", "true"]) {
      process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = enabled;
      let sent;
      const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
        post: async (_url, body) => { sent = body; return { success: true, data: { id: "j1" } }; },
      });
      for (const source of [cashOnHand, register, drawer, legacyCashAccount]) {
        await api.createDailyIncomeJournal(statement, {
          transactionType: "EXPENSE", amount: 10, accountId: 43, accountName: "Fuel", accountType: "EXPENSE",
          sourceAccountId: source.id, sourceAccountName: source.name, sourceAccountType: source.type,
          paymentMethodId: 1, paymentMethodName: "CASH", refNumber: "", description: "",
        });
        assert.deepEqual(sent.account, { id: 43, name: "Fuel", type: "EXPENSE" });
        assert.deepEqual(sent.sourceAccount, { id: source.id, name: source.name, type: "ASSET" });
        assert.equal(sent.paymentAccount, undefined);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
    else process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = previous;
  }
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
  await api.createDailyIncomeJournal(statement, { transactionType: "PAYMENT", amount: 20, invoiceId: "inv-1", paymentMethodId: 1, paymentMethodName: "CASH", paymentAccountId: 31, paymentAccountName: "Register", paymentAccountType: "ASSET", refNumberMode: "system", refNumber: "", description: "" });
  assert.equal(sent.paymentAccount, undefined);
});

test("flag on: cash income posts the chosen cash account", () => withPaymentAccounts(async () => {
  let sent;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", { post: async (_url, body) => { sent = body; return { success: true, data: { id: "j1" } }; } });
  assert.deepEqual((await api.fetchAccountingPaymentMethods()).slice(-2).map((method) => method.name), ["DEBIT-CARD", "WIRE"]);
  await api.createDailyIncomeJournal(statement, { transactionType: "SALES", amount: 20, accountId: 7, accountName: "Sales", accountType: "REVENUE", paymentMethodId: 1, paymentMethodName: "CASH", paymentAccountId: 31, paymentAccountName: "Register", paymentAccountType: "ASSET", refNumberMode: "system", refNumber: "", description: "" });
  assert.deepEqual(sent.paymentAccount, { id: 31, name: "Register", type: "ASSET" });
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
  assert.deepEqual(issues({ ...base, paymentMethodId: 1, paymentMethodName: "CASH", sourceAccountId: 31, sourceAccountType: "ASSET" }), []);
}));

test("flag on: expense source account moves to the payment step", () => withPaymentAccounts(() => {
  const workflow = loadFeature("src/lib/accounting/daily-income/transaction-workflow.ts");
  assert.equal(workflow.hasPaymentDetailsStep("EXPENSE"), true);
  assert.equal(workflow.getTransactionFieldStep("sourceAccountId", "EXPENSE"), "payment");
  assert.equal(workflow.getTransactionStepFields("amounts", "EXPENSE").includes("sourceAccountId"), false);
  assert.equal(workflow.getTransactionFieldStep("sourceAccountId", "TRANSFER"), "amounts");
}));
