import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier in overrides) return overrides[specifier];
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        return load(target.endsWith(".json") ? target : fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

function fixture() {
  let raw = { id: 42, date: "2026-10-20", branch: { id: 1 }, sender: { id: "s", name: "Sender" }, receivers: [] };
  const writes = [];
  const transport = {
    get: async () => ({ data: raw }),
    post: async (url, body) => { writes.push({ url, body }); raw = { ...raw, ...body }; return { success: true, data: 42 }; },
    put: async (url, body) => { writes.push({ url, body }); raw = { ...raw, ...body }; return { success: true, data: raw }; },
  };
  const overrides = { "@/lib/api/axios": { axiosInstance: {}, normalizeApiError: (e) => e } };
  const api = loadFeature("src/lib/orders/api/orders-api.ts", transport, overrides);
  const types = loadFeature("src/lib/orders/types.ts", transport, overrides);
  const customers = loadFeature("src/lib/customers/api/customers-api.ts", transport, overrides);
  function customer(id) {
    return customers.normalizeApiCustomer({ id, name: id, customerType: 2,
      phones: [{ type: "mobile", number: "8095550100", isPrimary: true }],
      addresses: [{ id: `${id}-a`, address1: "First street", city: "Santiago", country: "DO" },
        { id: `${id}-b`, address1: "Second street", city: "Santiago", country: "DO" }] });
  }
  const values = { ...types.createEmptyOrderForm(), sender: customer("sender"), senderId: "sender",
    receivers: [{ key: "row-a", customer: customer("receiver-a"), addressIndex: 1 },
      { key: "row-b", customer: customer("receiver-b"), addressIndex: 0 }] };
  return { api, types, values, writes, setRaw: (next) => { raw = next; } };
}

test("create sends all receivers with each selected address and phone snapshot; read/edit preserves both", async () => {
  const { api, types, values, writes } = fixture();
  const order = await api.createOrder(values);
  const payload = writes[0].body;
  assert.equal(writes[0].url, "/pickups");
  assert.equal("receiver" in payload, false);
  assert.deepEqual(payload.receivers.map((r) => r.id), ["receiver-a", "receiver-b"]);
  assert.deepEqual(payload.receivers.map((r) => r.address.id), ["receiver-a-b", "receiver-b-a"]);
  assert.ok(payload.receivers.every((r) => r.phones.length === 1));
  assert.equal(JSON.stringify(payload).includes("row-a"), false);
  const editing = types.orderToFormValues(order);
  assert.deepEqual(editing.receivers.map((r) => r.customer.id), ["receiver-a", "receiver-b"]);
  await api.updateOrder("42", editing);
  assert.deepEqual(writes[1].body.receivers.map((r) => r.address.id), ["receiver-a-b", "receiver-b-a"]);
});

test("removing every receiver sends an explicit empty array on update", async () => {
  const { api, values, writes } = fixture();
  await api.createOrder(values);
  const order = await api.updateOrder("42", { ...values, id: 42, receivers: [] });
  assert.deepEqual(writes[1].body.receivers, []);
  assert.deepEqual(order.receivers, []);
  assert.equal(order.receiver, null);
});

test("legacy singular receiver reads remain editable; an explicit empty array takes precedence", async () => {
  const { api, types, setRaw } = fixture();
  const raw = { id: 42, sender: { name: "Sender" }, receiver: { id: "legacy", name: "Legacy" } };
  setRaw(raw);
  assert.equal(types.orderToFormValues(await api.fetchOrderById("42")).receivers[0].customer.id, "legacy");
  setRaw({ ...raw, receivers: [] });
  assert.deepEqual(types.orderToFormValues(await api.fetchOrderById("42")).receivers, []);
});

test("UI row keys do not trigger unchanged saves; receiver or address changes do", () => {
  const { types, values } = fixture();
  const rekeyed = { ...values, receivers: values.receivers.map((r) => ({ ...r, key: `new-${r.key}` })) };
  assert.equal(types.areOrderFormValuesEquivalent(values, rekeyed), true);
  assert.equal(types.areOrderFormValuesEquivalent(values, { ...values, receivers: [] }), false);
  assert.equal(types.areOrderFormValuesEquivalent(values, { ...values, receivers: values.receivers.map((r) => ({ ...r, addressIndex: 0 })) }), false);
  assert.deepEqual(types.resetOrderFormForNextEntry(values).receivers, []);
});

test("unselected receiver rows fail before any request", async () => {
  const { api, values, writes } = fixture();
  await assert.rejects(api.createOrder({ ...values, receivers: [{ key: "blank", customer: null, addressIndex: 0 }] }), /Select a receiver/);
  assert.equal(writes.length, 0);
});

test("customer tab return keeps the original receiver row identity during an asynchronous fetch", async () => {
  let effect;
  let resolveCustomer;
  let returned;
  const hook = loadFeature("src/lib/customers/hooks/use-apply-customer-on-tab-return.ts", {}, {
    react: { useCallback: (fn) => fn, useEffect: (fn) => { effect = fn; }, useRef: (value) => ({ current: value }) },
    "@tanstack/react-query": { useQueryClient: () => ({ fetchQuery: () => new Promise((resolve) => { resolveCustomer = resolve; }) }) },
    "@/lib/customers/api/customers-api": { fetchCustomerById: () => {} },
    "@/lib/layout/hooks/use-workspace-tabs": { useWorkspaceTabs: () => ({ tabs: [] }) },
    "@/lib/layout/workspace-tab-scope": { useWorkspaceTabScope: () => ({ isActive: true }) },
  });
  const pending = hook.useApplyCustomerOnTabReturn((side, customer, meta) => { returned = { side, customer, meta }; });
  pending.markPendingPartyEdit("receiver", "receiver-a", undefined, "row-a");
  effect();
  pending.markPendingPartyEdit("receiver", "receiver-b", undefined, "row-b");
  resolveCustomer({ id: "receiver-a" });
  await new Promise(setImmediate);
  assert.equal(returned.meta.contextKey, "row-a");
  assert.equal(returned.customer.id, "receiver-a");
});

test("appointment steps validate sender, then receivers, then date and purpose", () => {
  const { values, types } = fixture();
  const { getAppointmentStepError } = loadFeature("src/lib/orders/utils/appointment-form-steps.ts");
  assert.equal(getAppointmentStepError(types.createEmptyOrderForm(), 1, false), "orders.form.validation.senderRequired");
  assert.equal(getAppointmentStepError(values, 1, true), "orders.form.validation.unverifiedSenderAddress");
  assert.equal(getAppointmentStepError(values, 1, false), null);
  assert.equal(getAppointmentStepError(values, 2, false), null);
  assert.equal(getAppointmentStepError(values, 3, false), "orders.form.validation.commentRequired");
  assert.equal(getAppointmentStepError({ ...values, date: "" }, 1, false), null);
  assert.equal(getAppointmentStepError({ ...values, date: "" }, 2, false), null);
  assert.equal(getAppointmentStepError({ ...values, date: "" }, 3, false), "orders.form.validation.pickupDateRequired");
});

test("skipping receivers permits saving without them and leaves original selections intact", () => {
  const { values, types } = fixture();
  const { getAppointmentStepError, canSelectAppointmentStep } = loadFeature("src/lib/orders/utils/appointment-form-steps.ts");
  const comments = [{ ...types.createEmptyOrderComment(), purpose: "PAYMENT" }];
  const draft = { ...values, receivers: [{ key: "empty", customer: null, addressIndex: 0 }], comments };
  assert.equal(getAppointmentStepError(draft, 1, false), null);
  assert.equal(getAppointmentStepError(draft, 2, false), "orders.form.validation.receiverRequired");
  assert.equal(canSelectAppointmentStep(draft, 3, false), false);
  assert.equal(canSelectAppointmentStep({ ...draft, receivers: [] }, 3, false), true);
  assert.equal(getAppointmentStepError({ ...draft, receivers: [] }, 3, false), null);
  assert.equal(draft.receivers.length, 1);
  assert.equal(canSelectAppointmentStep({ ...draft, sender: null, receivers: [] }, 3, false), false);
});

test("wizard preserves duplicate receiver and comment item validation", () => {
  const { values, types } = fixture();
  const { getAppointmentStepError } = loadFeature("src/lib/orders/utils/appointment-form-steps.ts");
  assert.equal(getAppointmentStepError({ ...values, receivers: [values.receivers[0], values.receivers[0]] }, 2, false),
    "orders.form.validation.duplicateReceiver");
  const comment = { ...types.createEmptyOrderComment(), purpose: "PICKUP", itemType: "box", quantity: "1" };
  assert.equal(getAppointmentStepError({ ...values, comments: [comment, comment] }, 3, false),
    "orders.form.validation.duplicateCommentItem");
});

test("appointment navigation checks preceding steps without requiring a date or purpose before the final step", () => {
  const { values, types } = fixture();
  const { canSelectAppointmentStep } = loadFeature("src/lib/orders/utils/appointment-form-steps.ts");
  const empty = types.createEmptyOrderForm();
  assert.equal(canSelectAppointmentStep(empty, 1, false), true);
  assert.equal(canSelectAppointmentStep(empty, 2, false), false);
  assert.equal(canSelectAppointmentStep(empty, 3, false), false);
  assert.equal(canSelectAppointmentStep(values, 3, false), true);
  assert.equal(canSelectAppointmentStep({ ...values, date: "" }, 3, false), true);
  assert.equal(canSelectAppointmentStep(values, 2, true), false);
  const incompleteReceiver = { ...values, receivers: [{ key: "empty", customer: null, addressIndex: 0 }] };
  assert.equal(canSelectAppointmentStep(incompleteReceiver, 2, false), true);
  assert.equal(canSelectAppointmentStep(incompleteReceiver, 3, false), false);
  assert.equal(canSelectAppointmentStep(values, 4, false), false);
});
