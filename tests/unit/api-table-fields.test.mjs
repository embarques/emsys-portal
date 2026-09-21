import assert from "node:assert/strict";
import test from "node:test";
import { captureApiTableFields, completeApiTableColumns, formatApiTableValue } from "../../src/lib/table/api-table-fields.ts";

const formatters = {
  label: (key) => key,
  date: (value) => `date:${value}`,
  number: (value) => String(value),
  yes: "Yes", no: "No", empty: "—",
};

test("response-only values survive normalization and appear in visible, copyable columns", () => {
  const fields = [{ field: "id" }, { field: "updatedBy" }, { field: "surcharge" }, { field: "isVoid" }, { field: "updatedAt", format: "date" }];
  const raw = { id: 42, updatedBy: { id: 9, userName: "ana.lopez", name: "Ana" }, surcharge: 0, isVoid: false, updatedAt: "2026-09-14T12:00:00Z" };
  const row = { ...captureApiTableFields(raw, fields), id: "42" };
  const columns = completeApiTableColumns([], fields, formatters);
  assert.deepEqual(columns.map(c => c.renderCell(row)), ["42", "ana.lopez", "0", "No", "date:2026-09-14T12:00:00Z"]);
  for (const column of columns) {
    assert.equal(column.defaultVisible, true);
    assert.equal(column.copyValue(row), column.renderCell(row));
    assert.equal(column.sortable, false);
  }
});

test("updatedBy columns prefer username over dumping the full user object", () => {
  const [column] = completeApiTableColumns([], [{ field: "updatedBy" }], formatters);
  assert.equal(column.renderCell({ apiTableValues: { updatedBy: { id: 9, userName: "ana", name: "Ana Lopez", email: "a@x.com" } } }), "ana");
  assert.equal(column.renderCell({ apiTableValues: { updatedBy: { id: 9, name: "Ana" } } }), "Ana");
  assert.equal(column.renderCell({ updatedBy: "legacy-user" }), "legacy-user");
});

test("existing business renderers and API aliases remain one column per concept", () => {
  const renderCell = () => "Received by route crew";
  const columns = completeApiTableColumns([
    { id: "pickupAssignment", label: "Received by", renderCell, defaultVisible: false },
  ], [
    { field: "receivedBy", columnId: "pickupAssignment" },
    { field: "employee", columnId: "pickupAssignment" },
    { field: "route", columnId: "pickupAssignment" },
    { field: "updatedBy" },
  ], formatters);
  assert.deepEqual(columns.map(c => c.id), ["pickupAssignment", "updatedBy"]);
  assert.equal(columns[0].renderCell, renderCell);
  assert.equal(columns[0].defaultVisible, true);
});

test("a conditional column absent from the base table is restored from its API field", () => {
  const fields = [{ field: "container", columnId: "container.name" }];
  const [column] = completeApiTableColumns([], fields, formatters);
  assert.equal(column.id, "container.name");
  assert.equal(column.renderCell(captureApiTableFields({ container: { name: "NY-42" } }, fields)), "name: NY-42");
});

test("missing data uses a dash, explicit null stays missing, and normalized records can supply fallbacks", () => {
  const [column] = completeApiTableColumns([], [{ field: "updatedBy" }], formatters);
  assert.equal(column.renderCell({}), "—");
  assert.equal(column.renderCell({ updatedBy: "Ana" }), "Ana");
  assert.equal(column.renderCell({ updatedBy: "Fallback", apiTableValues: { updatedBy: null } }), "—");
  assert.equal(formatApiTableValue([], formatters), "—");
  assert.equal(formatApiTableValue([{ quantity: 0, active: false }], formatters), "quantity: 0 · active: No");
});

test("only documented fields are retained and credentials inside legacy references are omitted", () => {
  const raw = { employee: { id: 1, name: "Ana", password: "private", accessCode: "private", role: { name: "Driver", token: "private" } }, undocumented: "ignored" };
  const row = captureApiTableFields(raw, [{ field: "employee" }]);
  assert.deepEqual(row.apiTableValues, { employee: { id: 1, name: "Ana", role: { name: "Driver" } } });
  assert.equal(raw.employee.password, "private");
  assert.equal(formatApiTableValue(raw.employee, formatters).includes("private"), false);
});

test("numeric record IDs remain exact while quantities use locale formatting", () => {
  const localized = { ...formatters, number: value => value.toLocaleString("en-US") };
  const columns = completeApiTableColumns([], [{ field: "id" }, { field: "quantity" }], localized);
  assert.equal(columns[0].renderCell({ id: 12345 }), "12345");
  assert.equal(columns[1].renderCell({ quantity: 12345 }), "12,345");
  assert.equal(formatApiTableValue({ id: 12345 }, localized), "id: 12345");
});
