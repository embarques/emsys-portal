import assert from "node:assert/strict";
import test from "node:test";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

const statement = { id: 1, status: "OPEN", branch: { id: 2 }, currency: "USD", rate: 1 };
const processor = { id: 4000000001, name: "CARD PROCESSOR RECEIVABLE", type: "ASSET" };
const base = { amount: 80, invoiceCost: 100, invoiceDiscount: 20, invoiceNumber: "0042", invoiceId: "invoice-1", invoiceBalance: 100, accountId: 7, refNumber: "", description: "", paymentMethodId: 5, paymentMethodName: "CREDIT-CARD" };

function fixture() {
  const calls = [];
  const load = createPortalLoader({ apiClient: { post: async (url, body) => {
    calls.push({ url, body });
    return { success: true, data: { id: "journal-card", transactionType: body.transactionType, transactionAmount: body.amount, paymentMethod: body.paymentMethod, paymentAccount: processor, clearanceStatus: "OUTSTANDING", reconciliationStatus: "OUTSTANDING", invoice: { cost: 100, discount: 20, payment: 0, balance: 80 } } };
  } } });
  return { calls, load, api: load("src/lib/accounting/daily-income/api.ts") };
}

test("card receipt bank selection is independent of bank settlement classification", () => {
  const { load } = fixture();
  const { requiresBankAccountSelection, requiresBankAccount } = load("src/lib/accounting/daily-income/types.ts");
  const { isBankInvoicePayment, isAutoClearEligible } = load("src/lib/accounting/daily-income/auto-clear.ts");
  for (const name of ["CREDIT-CARD", "credit card", "CREDIT_CARD", "CreditCard"]) {
    for (const transactionType of ["INITIAL-PAYMENT", "PAYMENT", "SALES", "REFUND"]) {
      assert.equal(requiresBankAccountSelection(transactionType, name), false);
    }
    assert.equal(requiresBankAccountSelection("EXPENSE", name), true);
    assert.equal(requiresBankAccount(name), true);
    assert.equal(isBankInvoicePayment({ transactionType: "INITIAL-PAYMENT", paymentMethodName: name }), true);
    assert.equal(isAutoClearEligible({ transactionType: "INITIAL-PAYMENT", paymentMethodName: name }), false);
  }
});

for (const transactionType of ["INITIAL-PAYMENT", "PAYMENT", "SALES", "REFUND"]) {
  test(`${transactionType} card receipt omits bank metadata, including stale draft values`, async () => {
    const { api, calls } = fixture();
    const journal = await api.createDailyIncomeJournal(statement, { ...base, transactionType, paymentAccountId: 82, paymentAccountName: "Old bank", paymentAccountType: "BANK" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/journals");
    assert.deepEqual(calls[0].body.paymentMethod, { id: 5, name: "CREDIT-CARD" });
    assert.equal(calls[0].body.paymentAccount, undefined);
    assert.equal(calls[0].body.sourceAccount, undefined);
    assert.equal(calls[0].body.autoClear, undefined);
    assert.equal(journal.paymentAccount.id, processor.id);
    assert.equal(journal.clearanceStatus, "OUTSTANDING");
    assert.equal(journal.invoice.balance, 80);
  });
}

test("registration and payment schemas accept cards without a bank while retaining other bank requirements", () => {
  const { load } = fixture();
  const { dailyIncomeJournalSchema } = load("src/lib/accounting/daily-income/schemas.ts");
  const { invoiceDailyIncomeRegistrationSchema } = load("src/lib/invoices/schemas/invoice-daily-income.schema.ts");
  for (const transactionType of ["INITIAL-PAYMENT", "PAYMENT", "SALES"]) {
    const result = dailyIncomeJournalSchema.safeParse({ ...base, transactionType });
    assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error.issues));
    const bank = dailyIncomeJournalSchema.safeParse({ ...base, transactionType, paymentMethodName: "ZELLE" });
    assert.equal(bank.success, false);
    assert.ok(bank.error.issues.some(issue => issue.path[0] === "paymentAccountId"));
  }
  assert.equal(invoiceDailyIncomeRegistrationSchema.safeParse(base).success, true);
  const bank = invoiceDailyIncomeRegistrationSchema.safeParse({ ...base, paymentMethodName: "ZELLE" });
  assert.equal(bank.success, false);
  assert.ok(bank.error.issues.some(issue => issue.path[0] === "paymentAccountId"));
});

test("card-paid expenses retain their bank funding and payload", async () => {
  const previous = process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
  process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = "true";
  try {
    const { api, calls, load } = fixture();
    const { dailyIncomeJournalSchema } = load("src/lib/accounting/daily-income/schemas.ts");
    const values = { ...base, transactionType: "EXPENSE", sourceAccountId: 82, sourceAccountName: "Operating bank", sourceAccountType: "BANK" };
    assert.equal(dailyIncomeJournalSchema.safeParse(values).success, true);
    await api.createDailyIncomeJournal(statement, values);
    assert.deepEqual(calls[0].body.sourceAccount, { id: 82, name: "Operating bank", type: "BANK" });
    assert.equal(calls[0].body.paymentAccount, undefined);
    const invalid = dailyIncomeJournalSchema.safeParse({ ...values, sourceAccountType: "ASSET" });
    assert.equal(invalid.success, false);
    assert.ok(invalid.error.issues.some(issue => issue.path[0] === "sourceAccountId"));
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED;
    else process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED = previous;
  }
});
