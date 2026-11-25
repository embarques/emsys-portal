import assert from "node:assert/strict";
import test from "node:test";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

function portal(data) {
  const calls = [];
  const load = createPortalLoader({
    apiClient: {
      get: async (url) => {
        calls.push(url);
        return { success: true, data };
      },
    },
  });
  return {
    calls,
    api: load("src/lib/invoices/api/invoices-api.ts"),
    types: load("src/lib/invoices/types.ts"),
    display: load("src/lib/invoices/display.ts"),
  };
}

const CHECK_PENDING = {
  id: "68f0000000000000000000a1",
  number: "INV-7001",
  cost: 1000,
  discount: 0,
  payment: 300,
  balance: 700,
  paidStatus: "OPEN",
  paymentSummary: {
    invoiceTotal: 1000,
    discount: 0,
    totalPaid: 300,
    outstandingBalance: 700,
    pendingClearance: 250,
    pendingClearanceCount: 2,
    balanceAfterClearance: 450,
    customerStatus: "PARTIALLY_PAID",
    clearanceStatus: "PARTIALLY_CLEARED",
  },
};

test("the API payment summary is what the view reports, not a recomputed balance", async () => {
  const { api, types } = portal(CHECK_PENDING);
  const invoice = await api.fetchInvoiceById(CHECK_PENDING.id);
  const summary = types.resolveInvoicePaymentSummary(invoice);

  // Total paid and outstanding balance are the posted figures and match the
  // stored invoice totals.
  assert.equal(summary.totalPaid, 300);
  assert.equal(summary.outstandingBalance, 700);
  assert.equal(summary.totalPaid, invoice.amountPaid);
  assert.equal(summary.outstandingBalance, invoice.balance);
  // Two pending receipts are totalled into one amount, with the balance they
  // settle the invoice to.
  assert.equal(summary.pendingClearance, 250);
  assert.equal(summary.pendingClearanceCount, 2);
  assert.equal(summary.balanceAfterClearance, 450);
  assert.equal(summary.customerStatus, "PARTIALLY_PAID");
  assert.equal(summary.clearanceStatus, "PARTIALLY_CLEARED");
});

test("a client whose only payment awaits clearance keeps the posted balance and clears to zero", async () => {
  const { api, types } = portal({
    ...CHECK_PENDING,
    payment: 0,
    balance: 1000,
    paymentSummary: {
      ...CHECK_PENDING.paymentSummary,
      totalPaid: 0,
      outstandingBalance: 1000,
      pendingClearance: 1000,
      pendingClearanceCount: 1,
      balanceAfterClearance: 0,
      customerStatus: "PAID",
      clearanceStatus: "OUTSTANDING",
    },
  });
  const invoice = await api.fetchInvoiceById(CHECK_PENDING.id);
  const summary = types.resolveInvoicePaymentSummary(invoice);

  assert.equal(summary.outstandingBalance, 1000, "the posted balance stays open until the check clears");
  assert.equal(summary.balanceAfterClearance, 0, "nothing is left to collect once it clears");
  assert.equal(summary.customerStatus, "PAID", "collections must not chase money already received");
  assert.equal(summary.clearanceStatus, "OUTSTANDING");
});

test("an API without the summary reports no pending clearance instead of guessing one", async () => {
  const { api, types } = portal({
    id: CHECK_PENDING.id,
    number: "INV-7002",
    cost: 500,
    discount: 0,
    payment: 200,
    balance: 300,
    paidStatus: "OPEN",
  });
  const invoice = await api.fetchInvoiceById(CHECK_PENDING.id);
  assert.equal(invoice.paymentSummary, undefined);

  const summary = types.resolveInvoicePaymentSummary(invoice);
  assert.equal(summary.pendingClearance, 0);
  assert.equal(summary.pendingClearanceCount, 0);
  assert.equal(summary.totalPaid, 200);
  assert.equal(summary.outstandingBalance, 300, "falls back to the stored balance");
  assert.equal(summary.balanceAfterClearance, 300);
  assert.equal(summary.customerStatus, "PARTIALLY_PAID");
  assert.equal(summary.clearanceStatus, "CLEARED");
});

test("incomplete or unknown summary payloads are rejected rather than partially displayed", async () => {
  const { types } = portal(CHECK_PENDING);
  const complete = CHECK_PENDING.paymentSummary;

  assert.deepEqual(types.normalizeApiInvoicePaymentSummary(complete), complete);
  for (const broken of [
    null,
    {},
    { ...complete, pendingClearance: undefined },
    { ...complete, balanceAfterClearance: null },
    { ...complete, pendingClearanceCount: undefined },
    { ...complete, pendingClearanceCount: 1.5 },
    { ...complete, pendingClearanceCount: -1 },
    { ...complete, totalPaid: "not-a-number" },
    { ...complete, outstandingBalance: Number.NaN },
    { ...complete, customerStatus: "SETTLED" },
    { ...complete, clearanceStatus: "RECONCILED" },
  ]) {
    assert.equal(types.normalizeApiInvoicePaymentSummary(broken), undefined);
  }
});

test("client payment status and clearance status use separate labels and tones", async () => {
  const { display } = portal(CHECK_PENDING);
  const t = (key) => key;

  assert.equal(display.getInvoiceCustomerPaymentLabel("PAID", t), "invoices.view.payment.clientPaid");
  assert.equal(display.getInvoiceClearanceLabel("OUTSTANDING", t), "invoices.view.payment.clearanceOutstanding");
  // Pending clearance is an internal settlement state, so it must not reuse the
  // red tone that signals money owed.
  assert.match(display.getInvoiceClearanceBadgeClass("OUTSTANDING"), /sky-/);
  assert.match(display.getInvoiceCustomerPaymentBadgeClass("UNPAID"), /rose-/);
  assert.match(display.getInvoiceCustomerPaymentBadgeClass("PAID"), /emerald-/);
});

test("every payment clearance string is translated in English and Spanish", async () => {
  const { display } = portal(CHECK_PENDING);
  const load = createPortalLoader({ apiClient: { get: async () => ({}) } });
  const catalogs = {
    en: load("src/locales/en/invoices.json"),
    es: load("src/locales/es/invoices.json"),
  };

  const keys = new Set([
    "view.fields.clientPaymentStatus",
    "view.fields.clearanceStatus",
    "view.payment.totalPaid",
    "view.payment.outstandingBalance",
    "view.payment.clearanceBreakdown",
    "view.payment.pendingClearance",
    "view.payment.pendingPaymentCount_one",
    "view.payment.pendingPaymentCount_other",
    "view.payment.balanceAfterClearance",
    "view.payment.pendingClearanceHint",
  ]);
  for (const status of ["UNPAID", "PARTIALLY_PAID", "PAID", "VOID"]) {
    keys.add(display.getInvoiceCustomerPaymentLabel(status, (key) => key).replace("invoices.", ""));
  }
  for (const status of ["NOT_REQUIRED", "OUTSTANDING", "PARTIALLY_CLEARED", "CLEARED"]) {
    keys.add(display.getInvoiceClearanceLabel(status, (key) => key).replace("invoices.", ""));
  }

  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const key of keys) {
      const value = key.split(".").reduce((node, part) => node?.[part], catalog);
      assert.equal(typeof value, "string", `${locale} is missing invoices.${key}`);
      assert.ok(value.trim().length > 0, `${locale} invoices.${key} is empty`);
    }
  }
  assert.notEqual(
    catalogs.en.view.payment.pendingClearanceHint,
    catalogs.es.view.payment.pendingClearanceHint,
    "Spanish copy must be translated, not English left in place",
  );
});

test("only an explicit API flag marks an invoice as holding accounting entries", async () => {
  const withEntries = await portal({ ...CHECK_PENDING, hasAccountingEntries: true }).api.fetchInvoiceById(CHECK_PENDING.id);
  assert.equal(withEntries.hasAccountingEntries, true);

  const without = await portal({ ...CHECK_PENDING, hasAccountingEntries: false }).api.fetchInvoiceById(CHECK_PENDING.id);
  assert.equal(without.hasAccountingEntries, false);

  // An older API omits the flag; the API delete check still refuses.
  const legacy = await portal({ ...CHECK_PENDING, hasAccountingEntries: undefined }).api.fetchInvoiceById(CHECK_PENDING.id);
  assert.equal(legacy.hasAccountingEntries, false);
});
