#!/usr/bin/env node
/**
 * Smoke-test Loans API endpoints used by the portal (read + search only).
 *
 * Covers:
 *   GET  /loans                (envelope: data.items + data.summary)
 *   POST /loans/search
 *   GET  /loans/{id}
 *   GET  /loans/{id}/transactions
 *
 * No create/update/delete: creating a loan (or loan payment) posts ledger
 * journal entries against real accounts and the API exposes no way to delete
 * a loan, so a throwaway record could not be cleaned up.
 *
 * Usage:
 *   node scripts/test-loans-api.mjs '<jwt>'
 */
import { createApiSuite } from "./lib/api-suite.mjs";

const RESOURCE = "/loans";
const suite = createApiSuite({ title: "Loans API smoke test (read-only)" });
const { request, check, note, rowsOf } = suite;

suite.banner();

console.log("=== List / read ===");
const list = await suite.listOrExit(`${RESOURCE}?page=1&limit=20&offset=0`);
const summary = list.json?.data?.summary;
if (summary && typeof summary === "object") {
  suite.pass("list summary", `active=${summary.activeLoans ?? "?"} paid=${summary.paidLoans ?? "?"} balance=${summary.balance ?? "?"}`);
} else {
  note("GET /loans returned no summary block.");
}

const sample = rowsOf(list)[0];
if (sample?.id != null) {
  check(`GET ${RESOURCE}/${sample.id}`, await request("GET", `${RESOURCE}/${sample.id}`), (r) => {
    const data = r.json?.data?.loan ?? r.json?.data;
    return `status=${data?.status ?? "?"} balance=${data?.balance ?? "?"}`;
  });
  check(`GET ${RESOURCE}/${sample.id}/transactions`, await request("GET", `${RESOURCE}/${sample.id}/transactions`), (r) =>
    `items=${Array.isArray(r.json?.data) ? r.json.data.length : rowsOf(r).length}`,
  );
} else {
  note("No loans returned; detail and transactions checks skipped.");
}

console.log("\n=== Search ===");
const search = (label, filters) =>
  request("POST", `${RESOURCE}/search`, { operator: "and", filters, pagination: { page: 1, limit: 5, offset: 0 }, sort: [] }).then((res) =>
    check(label, res, suite.summarizeList),
  );
await search("POST /loans/search status eq ACTIVE", [{ field: "status", operator: "eq", value: "ACTIVE" }]);
if (sample?.referenceNumber) {
  await search(`search referenceNumber eq ${sample.referenceNumber}`, [{ field: "referenceNumber", operator: "eq", value: sample.referenceNumber }]);
}
await search("search openedAt gte 2020-01-01", [{ field: "openedAt", operator: "gte", value: "2020-01-01" }]);

note("Loan create/update/delete intentionally not exercised: loans post ledger entries and cannot be deleted.");
suite.finish("All loan checks passed.");
