import assert from "node:assert/strict";
import test from "node:test";
import { compareTableFieldCoverage } from "../../scripts/lib/table-field-coverage.mjs";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

test("schema coverage still rejects missing, unknown and duplicate fields", () => {
  const schema = { properties: { id: {}, version: {}, amount: {} } };
  assert.deepEqual(compareTableFieldCoverage(schema, ["id", "amount", "amount", "invented"]), {
    missing: ["version"], extra: ["invented"], duplicates: ["amount"],
  });
});

test("compatibility allowances are exact, require a reason and do not substitute distinct fields", () => {
  const schema = { properties: { orderNumber: {} } };
  assert.deepEqual(compareTableFieldCoverage(schema, ["routeNumber", "unknown"], { routeNumber: "Legacy route sequence" }), {
    missing: ["orderNumber"], extra: ["unknown"], duplicates: [],
  });
  assert.deepEqual(compareTableFieldCoverage(schema, ["orderNumber", "routeNumber"], { routeNumber: " " }).extra, ["routeNumber"]);
  assert.deepEqual(compareTableFieldCoverage(schema, ["orderNumber", "constructor", "toString"]).extra, ["constructor", "toString"]);
});

test("one shared payment metadata set must satisfy each response schema independently", () => {
  const fields = ["id", "paymentReference", "clearedBy"];
  const common = { properties: { id: {}, paymentReference: {}, clearedBy: {} } };
  const changed = { properties: { ...common.properties, anotherPaymentField: {} } };
  assert.deepEqual(compareTableFieldCoverage(common, fields).missing, []);
  assert.deepEqual(compareTableFieldCoverage(changed, fields).missing, ["anotherPaymentField"]);
});

test("journal controls remain typed without raw generated columns or duplicated money values", () => {
  const load = createPortalLoader({ apiClient: {} });
  const { normalizeJournal } = load("src/lib/accounting/daily-income/api.ts");
  const { DAILY_INCOME_JOURNAL_API_TABLE_FIELDS: fields } = load("src/lib/accounting/daily-income/table-fields.ts");
  const { completeApiTableColumns } = load("src/lib/table/api-table-fields.ts");
  const raw = { id: "journal-1", version: 4, transactionAmount: 0, autoReconciled: false,
    allowedActions: { edit: false, clear: true }, restrictionReason: "Closed period",
    inventoryTotal: 123.45, inventoryHolders: [{ id: "holder-1" }], dailyRouteId: "route-1" };
  const journal = normalizeJournal(raw);
  assert.equal(journal.version, 4);
  assert.equal(journal.allowedActions.edit, false);
  assert.equal(journal.allowedActions.clear, true);
  assert.equal(journal.amount, 0);
  assert.equal(journal.autoReconciled, false);
  for (const key of ["version", "allowedActions", "restrictionReason", "inventoryTotal", "inventoryHolders", "dailyRouteId"]) {
    assert.equal(Object.hasOwn(journal.apiTableValues, key), false, key);
  }
  const renderer = row => `Amount ${row.amount}`;
  const columns = completeApiTableColumns([{ id: "amount", renderCell: renderer }], fields,
    { label: key => key, date: value => value, number: String, yes: "Yes", no: "No", empty: "—" });
  assert.equal(columns[0].renderCell, renderer);
  assert.equal(columns[0].renderCell(journal), "Amount 0");
  assert.ok(!columns.some(column => ["version", "allowedActions", "inventoryTotal", "inventoryHolders"].includes(column.id)));
});

test("report catalog metadata and output formats survive normalization without adding a report directory", async () => {
  const raw = { id: "loan", key: "loan-statement", name: "Loans", type: "loan", enabled: false,
    sortOrder: 0, createdAt: "2026-11-13T12:00:00Z", updatedAt: "2026-11-13T13:00:00Z", outputs: ["excel"] };
  const calls = [];
  const load = createPortalLoader({ apiClient: { get: async url => { calls.push(url); return { data: [raw] }; } } });
  const [report] = await load("src/lib/reports/api/reports-api.ts").fetchReportDefinitions();
  assert.equal(calls.length, 1);
  assert.equal(report.enabled, false);
  assert.equal(report.sortOrder, 0);
  assert.equal(report.createdAt, raw.createdAt);
  assert.equal(report.updatedAt, raw.updatedAt);
  assert.deepEqual(report.outputs, ["excel"]);
});
