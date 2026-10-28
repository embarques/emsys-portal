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
  incomeRecipients: [{ id: "15", name: "Carlos Ruiz", role: "SUPERVISOR" }, { id: "12", name: "Ana Pérez", role: "RESPONSIBLE" }],
  salesRecordedAtDispatch: false,
  dispatchedQuantity: 40, reconciledQuantity: 15, awaitingConfirmationQuantity: 0, outstandingQuantity: 25, pendingReconciliationCount: 0,
  lines: [
    { id: "line-1", item: { id: "box", name: "Small box" }, dispatchedQuantity: 30, reconciledQuantity: 5, awaitingConfirmationQuantity: 0, outstandingQuantity: 25 },
    { id: "line-2", item: { id: "barrel", name: "Barrel" }, dispatchedQuantity: 10, reconciledQuantity: 10, awaitingConfirmationQuantity: 0, outstandingQuantity: 0 },
  ],
};
const empty = { SOLD: "", RETURNED: "", DAMAGED: "", LOST: "", MISSING: "", STOLEN: "", revenue: "", damageResolution: "" };
const payment = (values) => ({
  key: "p", paymentMethodId: "1", paymentMethodName: "CASH", amount: "", paymentAccountId: "", checkNumber: "", externalReferenceNumber: "", ...values,
});
const formWith = (line, extra = {}) => ({
  occurredAt: "2026-10-28T09:30",
  notes: "",
  salesRecordedAtDispatch: false,
  incomeEmployeeId: "15",
  lines: [{ dispatchLineId: "line-1", itemName: "Small box", outstanding: 25, ...empty, ...line }],
  payments: [],
  ...extra,
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
  assert.equal(result.items[0].awaitingConfirmationQuantity, 0);
  assert.equal(result.items[0].salesRecordedAtDispatch, false);
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

test("form only offers lines that still have supplies in custody and defaults income to the supervisor", () => {
  const { createReconciliationForm } = loadFeature("src/lib/inventory/pending-dispatches/reconciliation.ts");
  const form = createReconciliationForm(dispatch, "2026-10-28T09:30");
  assert.equal(form.lines.length, 1);
  assert.equal(form.lines[0].dispatchLineId, "line-1");
  assert.equal(form.lines[0].outstanding, 25);
  assert.equal(form.incomeEmployeeId, "15");
  assert.deepEqual(form.payments, []);
});

test("validation blocks empty, oversized, and incomplete reconciliations", () => {
  const { reconciliationFormSchema } = loadFeature("src/lib/inventory/pending-dispatches/schemas.ts");
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({}))), ["nothing"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ RETURNED: "20", MISSING: "6" }, { notes: "short" }))), ["exceeds"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ SOLD: "5" }))), ["revenue"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ DAMAGED: "1" }, { notes: "Crushed" }))), ["resolution"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ RETURNED: "1.5" }))), ["nothing", "quantity"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse({ ...formWith({ RETURNED: "1" }), occurredAt: "" })), ["occurredAt"]);
  assert.equal(reconciliationFormSchema.safeParse(formWith(
    { SOLD: "10", revenue: "120.10", DAMAGED: "2", damageResolution: "QUARANTINE", RETURNED: "13" },
    { notes: "2 crushed", payments: [payment({ amount: "120.10" })] },
  )).success, true);
});

test("losses need a description", () => {
  const { reconciliationFormSchema } = loadFeature("src/lib/inventory/pending-dispatches/schemas.ts");
  for (const outcome of ["DAMAGED", "LOST", "MISSING", "STOLEN"]) {
    const line = { [outcome]: "1", ...(outcome === "DAMAGED" ? { damageResolution: "WRITE_OFF" } : {}) };
    assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(line, { notes: "  " }))), ["notesRequired"], outcome);
  }
  assert.equal(reconciliationFormSchema.safeParse(formWith({ RETURNED: "3" })).success, true);
});

test("payments carry method-specific fields and cannot exceed sale revenue", () => {
  const { reconciliationFormSchema } = loadFeature("src/lib/inventory/pending-dispatches/schemas.ts");
  const sold = { SOLD: "10", revenue: "120.00" };
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(sold, { payments: [payment({ amount: "130.00" })] }))), ["paymentExceeds"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(sold, {
    payments: [payment({ paymentMethodId: "2", paymentMethodName: "CHECK", amount: "120.00" })],
  }))), ["checkNumber", "paymentAccount"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(sold, {
    notes: "On credit", payments: [payment({ paymentMethodId: "", paymentMethodName: "", amount: "0" })],
  }))), ["paymentAmount", "paymentMethod"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(sold, {
    incomeEmployeeId: "", payments: [payment({ amount: "120.00" })],
  }))), ["incomeEmployee"]);
  assert.equal(reconciliationFormSchema.safeParse(formWith({ SOLD: "2", revenue: "0" })).success, true);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith({ RETURNED: "2" }, { payments: [payment({ amount: "5.00" })] }))), ["paymentExceeds"]);
});

test("unpaid revenue is a credit sale that needs a description and an income recipient", () => {
  const { reconciliationFormSchema, creditMinor } = loadFeature("src/lib/inventory/pending-dispatches/schemas.ts");
  const { buildReconciliationInput } = loadFeature("src/lib/inventory/pending-dispatches/reconciliation.ts");
  const sold = { SOLD: "10", revenue: "120.00" };
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(sold))), ["creditNotesRequired"]);
  assert.deepEqual(messages(reconciliationFormSchema.safeParse(formWith(sold, { notes: "Owed by Ana", incomeEmployeeId: "" }))), ["incomeEmployee"]);
  const partial = formWith(sold, { notes: "Customer pays Friday", payments: [payment({ amount: "100.00" })] });
  assert.equal(reconciliationFormSchema.safeParse(partial).success, true);
  assert.equal(creditMinor(partial), 2000);
  assert.equal(creditMinor({ ...partial, salesRecordedAtDispatch: true }), 0);
  const allCredit = buildReconciliationInput(formWith(sold, { notes: "All on credit" }), "req-4");
  assert.equal(allCredit.incomeEmployeeId, "15");
  assert.deepEqual(allCredit.payments, []);
});

test("dispatches whose sales were posted at dispatch skip revenue and payments", () => {
  const { reconciliationFormSchema } = loadFeature("src/lib/inventory/pending-dispatches/schemas.ts");
  const { buildReconciliationInput } = loadFeature("src/lib/inventory/pending-dispatches/reconciliation.ts");
  const values = formWith({ SOLD: "4" }, { salesRecordedAtDispatch: true, payments: [payment({ amount: "9.00" })] });
  assert.equal(reconciliationFormSchema.safeParse(values).success, true);
  const input = buildReconciliationInput(values, "req-3");
  assert.deepEqual(input.lines, [{ dispatchLineId: "line-1", outcome: "SOLD", quantity: 4 }]);
  assert.deepEqual(input.payments, []);
  assert.equal("incomeEmployeeId" in input, false);
});

test("payload flattens outcomes, omits zeros and sends exact cents and payment fields", () => {
  const { buildReconciliationInput, accountedQuantity } = loadFeature("src/lib/inventory/pending-dispatches/reconciliation.ts");
  const values = formWith({ SOLD: "10", revenue: "120.10", DAMAGED: "2", damageResolution: "WRITE_OFF", RETURNED: "13", LOST: "0" }, {
    payments: [
      payment({ amount: "80.00", paymentAccountId: "21", checkNumber: "ignored" }),
      payment({ paymentMethodId: "2", paymentMethodName: "CHECK", amount: "30.10", paymentAccountId: "21", checkNumber: " 000123 " }),
      payment({ paymentMethodId: "4", paymentMethodName: "ZELLE", amount: "10.00", paymentAccountId: "22", externalReferenceNumber: "ZL-1" }),
    ],
  });
  values.notes = "  Route 5 return  ";
  assert.equal(accountedQuantity(values.lines[0]), 25);
  const input = buildReconciliationInput(values, "req-2");
  assert.equal(input.requestId, "req-2");
  assert.equal(input.notes, "Route 5 return");
  assert.equal(input.incomeEmployeeId, "15");
  assert.equal(input.occurredAt, new Date("2026-10-28T09:30").toISOString());
  assert.deepEqual(input.lines, [
    { dispatchLineId: "line-1", outcome: "SOLD", quantity: 10, revenueMinor: 12010 },
    { dispatchLineId: "line-1", outcome: "RETURNED", quantity: 13 },
    { dispatchLineId: "line-1", outcome: "DAMAGED", quantity: 2, damageResolution: "WRITE_OFF" },
  ]);
  assert.deepEqual(input.payments, [
    { paymentMethod: { id: 1, name: "CASH" }, amountMinor: 8000 },
    { paymentMethod: { id: 2, name: "CHECK" }, amountMinor: 3010, paymentAccountId: 21, paymentReference: "000123", checkNumber: "000123" },
    { paymentMethod: { id: 4, name: "ZELLE" }, amountMinor: 1000, paymentAccountId: 22, externalReferenceNumber: "ZL-1" },
  ]);
});

test("history marks legacy entries confirmed and reads confirmation state", async () => {
  const api = loadFeature("src/lib/inventory/pending-dispatches/api.ts", {
    get: async () => ({ data: [
      { id: "r1", recordedAt: "2026-10-27T10:00:00Z", lines: [] },
      {
        id: "r2", status: "PENDING_CONFIRMATION", version: 3, recordedAt: "2026-10-28T10:00:00Z", lines: [],
        confirmations: { warehouse: { confirmedAt: "2026-10-28T11:00:00Z", confirmedBy: { id: 7, name: "Luis" }, notes: "ok" } },
        allowedActions: ["CONFIRM_CUSTODIAN", "REJECT", "UNKNOWN"],
      },
    ] }),
  });
  const [legacy, pending] = await api.fetchDispatchReconciliations("disp/1");
  assert.equal(legacy.status, "CONFIRMED");
  assert.deepEqual(legacy.payments, []);
  assert.deepEqual(legacy.allowedActions, []);
  assert.equal(pending.status, "PENDING_CONFIRMATION");
  assert.equal(pending.version, 3);
  assert.deepEqual(pending.confirmations, { warehouse: { confirmedAt: "2026-10-28T11:00:00Z", confirmedBy: "Luis", notes: "ok" }, custodian: null });
  assert.deepEqual(pending.allowedActions, ["CONFIRM_CUSTODIAN", "REJECT"]);
});

test("reconciliation confirm and reject send the party, If-Match and an idempotency key", async () => {
  const calls = [];
  const api = loadFeature("src/lib/inventory/pending-dispatches/api.ts", {
    post: async (url, body, config) => { calls.push({ url, body, config }); return {}; },
  });
  const command = { dispatchId: "disp/1", reconciliation: { id: "r/2", version: 3 }, party: "CUSTODIAN", text: "  ok  " };
  await api.confirmReconciliation(command);
  await api.rejectReconciliation({ ...command, text: " sold 8 " });
  assert.equal(calls[0].url, "/inventory/dispatches/disp%2F1/reconciliations/r%2F2/confirm");
  assert.deepEqual(calls[0].body, { party: "CUSTODIAN", notes: "ok" });
  assert.deepEqual(calls[0].config.headers, { "If-Match": "3", "Idempotency-Key": "inventory-reconciliation-confirm:r/2:v3:CUSTODIAN" });
  assert.equal(calls[1].url, "/inventory/dispatches/disp%2F1/reconciliations/r%2F2/reject");
  assert.deepEqual(calls[1].body, { party: "CUSTODIAN", reason: "sold 8" });
  assert.deepEqual(calls[1].config.headers, { "If-Match": "3" });
});

test("confirmation actions need the party permission and the API's allowed action", () => {
  const { resolveConfirmationActions } = loadFeature("src/lib/inventory/utils/confirmations.ts");
  const state = { confirmations: { warehouse: null, custodian: null }, rejection: null, allowedActions: ["CONFIRM_WAREHOUSE", "REJECT"] };
  const both = ["WAREHOUSE", "CUSTODIAN"];
  assert.deepEqual(resolveConfirmationActions(state, both, { WAREHOUSE: true, CUSTODIAN: true }), [
    { kind: "confirm", party: "WAREHOUSE" },
    { kind: "reject", party: "WAREHOUSE" },
  ]);
  assert.deepEqual(resolveConfirmationActions(state, both, { WAREHOUSE: false, CUSTODIAN: false }), []);
  const confirmed = { ...state, confirmations: { warehouse: { confirmedAt: "x", confirmedBy: "", notes: "" }, custodian: null } };
  assert.deepEqual(resolveConfirmationActions(confirmed, both, { WAREHOUSE: true, CUSTODIAN: false }), [{ kind: "reject", party: "WAREHOUSE" }]);
});
