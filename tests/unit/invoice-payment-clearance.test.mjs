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
    totalPaid: 550,
    pendingClearance: 250,
    outstandingBalance: 450,
    receivableBalance: 700,
    customerStatus: "PARTIALLY_PAID",
    clearanceStatus: "PARTIALLY_CLEARED",
  },
};

test("the API payment summary is what the view reports, not a recomputed balance", async () => {
  const { api, types } = portal(CHECK_PENDING);
  const invoice = await api.fetchInvoiceById(CHECK_PENDING.id);
  const summary = types.resolveInvoicePaymentSummary(invoice);

  assert.equal(summary.totalPaid, 550);
  assert.equal(summary.pendingClearance, 250);
  // The balance before clearance is 700; once the pending 250 clears it is 450.
  assert.equal(summary.receivableBalance, 700);
  assert.equal(summary.outstandingBalance, 450);
  assert.equal(summary.customerStatus, "PARTIALLY_PAID");
  assert.equal(summary.clearanceStatus, "PARTIALLY_CLEARED");
  // The accounting balance still drives the existing balance column.
  assert.equal(invoice.balance, 700);
  assert.equal(invoice.amountPaid, 300);
});

test("a client whose only payment awaits clearance owes nothing while the receivable stays open", async () => {
  const { api, types } = portal({
    ...CHECK_PENDING,
    payment: 0,
    balance: 1000,
    paymentSummary: {
      ...CHECK_PENDING.paymentSummary,
      totalPaid: 1000,
      clearedAmount: 0,
      pendingClearance: 1000,
      outstandingBalance: 0,
      receivableBalance: 1000,
      customerStatus: "PAID",
      clearanceStatus: "OUTSTANDING",
    },
  });
  const invoice = await api.fetchInvoiceById(CHECK_PENDING.id);
  const summary = types.resolveInvoicePaymentSummary(invoice);

  assert.equal(summary.outstandingBalance, 0, "collections must not chase money already received");
  assert.equal(summary.customerStatus, "PAID");
  assert.equal(summary.clearanceStatus, "OUTSTANDING");
  assert.equal(summary.receivableBalance, 1000, "accounting keeps the open receivable");
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
  assert.equal(summary.totalPaid, 200);
  assert.equal(summary.outstandingBalance, 300, "falls back to the stored balance");
  assert.equal(summary.receivableBalance, 300);
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
    { ...complete, receivableBalance: null },
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
    "view.payment.currentBalance",
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
