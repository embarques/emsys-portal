import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Compile the feature modules with only the central HTTP boundary replaced.
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
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const dispatch = {
  id: "disp/1",
  dispatchedAt: "2026-10-27T13:00:00Z",
  ageDays: 1,
  holder: { id: "truck_3", type: "VEHICLE", displayName: "Truck 3" },
  dispatchedQuantity: 40, reconciledQuantity: 15, outstandingQuantity: 25,
  lines: [
    { id: "line-1", item: { id: "box", name: "Small box" }, dispatchedQuantity: 30, reconciledQuantity: 5, outstandingQuantity: 25 },
    { id: "line-2", item: { id: "barrel", name: "Barrel" }, dispatchedQuantity: 10, reconciledQuantity: 10, outstandingQuantity: 0 },
  ],
};
const empty = { SOLD: "", RETURNED: "", DAMAGED: "", LOST: "", MISSING: "", STOLEN: "", revenue: "", damageResolution: "" };
const formWith = (line) => ({
  occurredAt: "2026-10-28T09:30",
  notes: "",
  lines: [{ dispatchLineId: "line-1", itemName: "Small box", outstanding: 25, ...empty, ...line }],
});
const messages = (result) => result.error.issues.map((issue) => issue.message.split(".").pop()).sort();

test("searches posted dispatches with server-side filters, oldest first", async () => {
  const calls = [];
  const api = loadFeature("src/lib/inventory/pending-dispatches/api.ts", {
    post: async (url, body) => { calls.push({ url, body }); return { data: [{ ...dispatch, lines: undefined }], total: 41 }; },
  });
  const result = await api.fetchPendingDispatches({ holder: "truck_3", from: "2026-10-01", through: "2026-10-28", age: "2" }, 2);
  assert.equal(calls[0].url, "/inventory/pending-dispatches/search");
  assert.deepEqual(calls[0].body, {
    filters: [
      { field: "holder.id", operator: "eq", value: "truck_3" },
      { field: "dispatchedAt", operator: "gte", value: "2026-10-01T00:00:00Z" },
      { field: "dispatchedAt", operator: "lte", value: "2026-10-28T23:59:59.999Z" },
      { field: "ageDays", operator: "gte", value: 2 },
    ],
    pagination: { page: 2, limit: 40 },
    sort: [{ field: "dispatchedAt", direction: "asc" }],
  });
  assert.equal(result.total, 41);
  assert.deepEqual(result.items[0].lines, []);
  assert.deepEqual(api.buildPendingDispatchSearch({ holder: "", from: "", through: "", age: "" }, 1).filters, []);
});

test("reconciliation posts to the dispatch and uses the request id as idempotency key", async () => {
  const calls = [];
  const api = loadFeature("src/lib/inventory/pending-dispatches/api.ts", {
    post: async (url, body, config) => { calls.push({ url, body, config }); return {}; },
  });
  const input = { requestId: "req-1", occurredAt: "2026-10-28T13:30:00.000Z", notes: "", lines: [] };
  await api.reconcileDispatch("disp/1", input);
  assert.equal(calls[0].url, "/inventory/dispatches/disp%2F1/reconciliations");
  assert.deepEqual(calls[0].config.headers, { "Idempotency-Key": "req-1" });
  assert.equal(calls[0].body, input);
});

test("form only offers lines that still have supplies in custody", () => {
  const { createReconciliationForm } = loadFeature("src/lib/inventory/pending-dispatches/reconciliation.ts");
  const form = createReconciliationForm(dispatch, "2026-10-28T09:30");
  assert.equal(form.lines.length, 1);
  assert.equal(form.lines[0].dispatchLineId, "line-1");
  assert.equal(form.lines[0].outstanding, 25);
});

test("validation blocks empty, oversized, and incomplete reconciliations", () => {
  const { reconciliationFormSchema } = loadFeature("src/lib/inventory/pending-dispatches/schemas.ts");
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({}))), ["nothing"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ RETURNED: "20", LOST: "6" }))), ["exceeds"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ SOLD: "5" }))), ["revenue"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ DAMAGED: "1" }))), ["resolution"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ RETURNED: "1.5" }))), ["nothing", "quantity"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse({ ...formWith({ RETURNED: "1" }), occurredAt: "" })), ["occurredAt"]);
  assert.equal(reconciliationFormSchema.safeParse(formWith({ SOLD: "10", revenue: "120.10", DAMAGED: "2", damageResolution: "QUARANTINE", RETURNED: "13" })).success, true);
});

test("payload flattens outcomes, omits zeros and sends exact cents", () => {
  const { buildReconciliationInput, accountedQuantity } = loadFeature("src/lib/inventory/pending-dispatches/reconciliation.ts");
  const values = formWith({ SOLD: "10", revenue: "120.10", DAMAGED: "2", damageResolution: "WRITE_OFF", RETURNED: "13", LOST: "0" });
  values.notes = "  Route 5 return  ";
  assert.equal(accountedQuantity(values.lines[0]), 25);
  const input = buildReconciliationInput(values, "req-2");
  assert.equal(input.requestId, "req-2");
  assert.equal(input.notes, "Route 5 return");
  assert.equal(input.occurredAt, new Date("2026-10-28T09:30").toISOString());
  assert.deepEqual(input.lines, [
    { dispatchLineId: "line-1", outcome: "SOLD", quantity: 10, revenueMinor: 12010 },
    { dispatchLineId: "line-1", outcome: "RETURNED", quantity: 13 },
    { dispatchLineId: "line-1", outcome: "DAMAGED", quantity: 2, damageResolution: "WRITE_OFF" },
  ]);
});
