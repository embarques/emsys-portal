import assert from "node:assert/strict";
import test from "node:test";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

function fixture(data) {
  const calls = [];
  const load = createPortalLoader({ apiClient: { get: async url => {
    calls.push(url);
    return { success: true, data };
  } } });
  return { calls, api: load("src/lib/accounting/daily-income/api.ts") };
}

test("bank settlement totals come from the existing scoped summary response without converting twice", async () => {
  const { api, calls } = fixture({ currency: "DOP", rate: 58,
    totals: [{ header: "Total Ingresos", value: 580 }],
    bankSettlement: { pendingCents: 58000, clearedCents: 11600 } });
  const summary = await api.fetchIncomeStatementSummaryTotals(42);
  assert.deepEqual(calls, ["/income-statements/42/summary-total"]);
  assert.deepEqual(summary.bankSettlement, { pendingCents: 58000, clearedCents: 11600 });
  assert.equal(summary.totals[0].value, 580);
});

test("zero settlement is distinct from an older API that omits the new totals", async () => {
  const zero = fixture({ currency: "USD", bankSettlement: { pendingCents: 0, clearedCents: 0 } });
  assert.deepEqual((await zero.api.fetchIncomeStatementSummaryTotals(42)).bankSettlement, { pendingCents: 0, clearedCents: 0 });
  const old = fixture({ currency: "USD", totals: [] });
  assert.equal((await old.api.fetchIncomeStatementSummaryTotals(42)).bankSettlement, undefined);
});

test("invalid or incomplete settlement amounts fail visibly rather than displaying invented zeros", async () => {
  for (const bankSettlement of [{ pendingCents: 0 }, { pendingCents: "10", clearedCents: 0 },
    { pendingCents: Number.MAX_SAFE_INTEGER + 1, clearedCents: 0 }]) {
    const { api } = fixture({ bankSettlement });
    await assert.rejects(api.fetchIncomeStatementSummaryTotals(42), /Bank settlement totals/);
  }
});
