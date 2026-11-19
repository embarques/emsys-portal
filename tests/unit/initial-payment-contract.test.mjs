import assert from "node:assert/strict";
import test from "node:test";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

const statement = { id: 1, status: "OPEN", branch: { id: 2 }, currency: "USD", rate: 1 };
const cash = { id: 1, name: "CASH ON HAND", type: "ASSET" };
const discount = { id: 5, name: "SALES DISCOUNTS", type: "EXPENSE" };
const lines = [
  { ...discount, debit: 20, credit: 0 },
  { ...cash, debit: 80, credit: 0 },
  { id: 2, name: "ACCOUNTS RECEIVABLE", type: "ASSET", debit: 20, credit: 20 },
  { id: 7, name: "SALES", type: "REVENUE", debit: 0, credit: 100 },
];

function fixture(fields = {}) {
  const calls = [];
  const load = createPortalLoader({ apiClient: {
    post: async (url, body) => {
      calls.push({ url, body });
      return { success: true, data: { id: "journal-1", transactionType: "INITIAL-PAYMENT", transactionAmount: 80, currency: "USD", accounts: lines, paymentAccount: cash, paymentMethod: { id: 1, name: "CASH" }, ...fields } };
    },
  } });
  return { calls, load, api: load("src/lib/accounting/daily-income/api.ts") };
}

test("discounted registration sends one INITIAL-PAYMENT with receipt and discount", async () => {
  const { api, calls, load } = fixture();
  const journal = await api.createDailyIncomeJournal(statement, {
    transactionType: "INITIAL-PAYMENT", amount: 80,
    invoiceNumber: "0042", invoiceCost: 100, invoiceDiscount: 20,
    paymentMethodId: 1, paymentMethodName: "CASH", refNumber: "", description: "",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/journals");
  assert.equal(calls[0].body.transactionType, "INITIAL-PAYMENT");
  assert.equal(calls[0].body.amount, 80);
  assert.equal(calls[0].body.invoice.cost, 100);
  assert.equal(calls[0].body.invoice.discount, 20);
  assert.equal(journal.sourceAccount, undefined, "AR or SALES must not become a synthetic source");

  const { getJournalBatchSelectionKey, getJournalBatchSelectionBlockReason } = load("src/lib/accounting/daily-income/journal-batch-selection.ts");
  const key = getJournalBatchSelectionKey(journal);
  assert.equal(key.moneyAccountId, 1);
  assert.equal(getJournalBatchSelectionBlockReason(key, { ...journal, paymentAccount: { ...cash, id: 8 } }), "moneyAccount");
  assert.equal(getJournalBatchSelectionBlockReason(key, { ...journal, paymentAccount: cash, accounts: [] }), null);

  const { summarizeJournalBreakdown, summarizeJournalTotals } = load("src/lib/accounting/daily-income/journal-classification.ts");
  assert.deepEqual(summarizeJournalTotals([journal]), [{ currency: "USD", income: 80, expenses: 0, net: 80, count: 1 }]);
  const breakdown = summarizeJournalBreakdown([{ ...journal, account: discount, accounts: [] }], key => key)[0];
  const entries = node => [...node.entries, ...node.children.flatMap(entries)];
  assert.equal(entries(breakdown.income)[0].account, "CASH ON HAND");
});

test("zero registration omits receipt method and destination even with stale bank fields", async () => {
  const { api, calls } = fixture({ transactionAmount: 0, paymentAccount: undefined, accounts: lines.filter(line => line.id !== 1) });
  await api.createDailyIncomeJournal(statement, {
    transactionType: "INITIAL-PAYMENT", amount: 0,
    invoiceNumber: "0042", invoiceCost: 100, invoiceDiscount: 20,
    paymentMethodId: 4, paymentMethodName: "ZELLE",
    paymentAccountId: 8, paymentAccountName: "Chase", paymentAccountType: "BANK",
    refNumber: "", description: "",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.amount, 0);
  assert.equal(calls[0].body.invoice.discount, 20);
  assert.equal(calls[0].body.paymentMethod, undefined);
  assert.equal(calls[0].body.paymentAccount, undefined);
});

test("batch account keys follow source then payment metadata without inferring ledger accounts", () => {
  const { load } = fixture();
  const { getJournalBatchSelectionKey } = load("src/lib/accounting/daily-income/journal-batch-selection.ts");
  const row = { transactionType: "INITIAL-PAYMENT", accounts: lines };
  assert.equal(getJournalBatchSelectionKey(row).moneyAccountId, 0);
  assert.equal(getJournalBatchSelectionKey({ ...row, paymentAccount: cash }).moneyAccountId, 1);
  assert.equal(getJournalBatchSelectionKey({ ...row, sourceAccount: { ...cash, id: 9 }, paymentAccount: cash }).moneyAccountId, 9);
  assert.equal(getJournalBatchSelectionKey({ ...row, sourceAccount: { id: 0 }, paymentAccount: cash }).moneyAccountId, 1);
});

test("discounted bank registration preserves its destination and outstanding settlement state", async () => {
  const bank = { id: 8, name: "Chase", type: "BANK" };
  const { api, calls, load } = fixture({
    paymentAccount: bank, paymentMethod: { id: 4, name: "ZELLE" },
    clearanceStatus: "OUTSTANDING", reconciliationStatus: "OUTSTANDING",
    invoice: { number: "0042", cost: 100, discount: 20, payment: 0, balance: 80 },
    accounts: lines.map(line => line.id === 1 ? { ...line, ...bank } : line),
  });
  const journal = await api.createDailyIncomeJournal(statement, {
    transactionType: "INITIAL-PAYMENT", amount: 80,
    invoiceNumber: "0042", invoiceCost: 100, invoiceDiscount: 20,
    paymentMethodId: 4, paymentMethodName: "ZELLE",
    paymentAccountId: 8, paymentAccountName: "Chase", paymentAccountType: "BANK",
    refNumber: "", description: "",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.paymentAccount, bank);
  assert.equal(journal.invoice.balance, 80, "a pending bank receipt must not replace the API balance");
  assert.equal(journal.clearanceStatus, "OUTSTANDING");
  const { getJournalBatchSelectionKey } = load("src/lib/accounting/daily-income/journal-batch-selection.ts");
  assert.equal(getJournalBatchSelectionKey(journal).moneyAccountId, 8);
  const { resolveJournalRowAccount } = load("src/lib/accounting/daily-income/journal-account.ts");
  assert.deepEqual(resolveJournalRowAccount({ ...journal, account: cash }), { name: "Chase", type: "BANK" });
});

test("legacy source inference remains available for edit defaults only", async () => {
  const { api, load } = fixture({ transactionType: "EXPENSE", accounts: [
    { id: 6, name: "FUEL", type: "EXPENSE", debit: 80, credit: 0 },
    { ...cash, debit: 0, credit: 80 },
  ], paymentAccount: undefined });
  const journal = await api.createDailyIncomeJournal(statement, { transactionType: "EXPENSE", amount: 80, refNumber: "", description: "" });
  assert.equal(journal.sourceAccount, undefined);
  const { journalToFormValues } = load("src/lib/accounting/daily-income/journal-form.ts");
  assert.equal(journalToFormValues(journal).sourceAccountId, 1);
});
