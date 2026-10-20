import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
const swagger = JSON.parse(fs.readFileSync(new URL("../fixtures/inventory-swagger-contract.json", import.meta.url), "utf8"));
const props = (name) => swagger.definitions[`inventory.${name}`].properties;

// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
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

function recordingClient(responder = () => ({ success: true, data: {} })) {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "patch", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return responder(method, ...args);
  }]));
  return { calls, client };
}

const receiptValues = {
  supplierId: "sup-1",
  toHolderId: "wh-1",
  receivedAt: "2026-10-15T09:30",
  notes: " Dock 2 ",
  lines: [
    { key: "a", itemId: "box", quantity: "30", unitCost: "1.25" },
    { key: "b", id: "line-2", itemId: "tape", quantity: "4", unitCost: "0.99" },
  ],
};

test("receipt drafts are created with documented multi-line fields and integer cents", async () => {
  const { calls, client } = recordingClient((method, url, body) => ({ success: true, data: { id: "rcpt-1", status: "DRAFT", version: 1, ...body } }));
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  const created = await api.createInventoryReceipt(receiptValues);
  const [method, url, body] = calls[0];
  assert.equal(method, "post");
  assert.equal(url, "/inventory/receipts");
  assert.equal(body.receivedAt, new Date("2026-10-15T09:30").toISOString());
  assert.equal(body.notes, "Dock 2");
  assert.deepEqual(body.lines, [
    { itemId: "box", quantity: 30, unitCostMinor: 125 },
    { id: "line-2", itemId: "tape", quantity: 4, unitCostMinor: 99 },
  ]);
  for (const key of Object.keys(body)) assert.ok(key in props("Receipt"), `Receipt.${key}`);
  for (const key of Object.keys(body.lines[0])) assert.ok(key in props("ReceiptLine"), `ReceiptLine.${key}`);
  assert.equal(created.status, "DRAFT");
  assert.equal(created.version, 1);
});

test("draft edits PATCH with If-Match; post and cancel send the documented headers", async () => {
  const { calls, client } = recordingClient((method) => ({ success: true, data: method === "patch" ? { id: "rcpt-1", status: "DRAFT", version: 3 } : {} }));
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  await api.updateInventoryReceipt({ id: "rcpt-1", version: 2 }, receiptValues);
  await api.postInventoryReceipt({ id: "rcpt-1", version: 3 });
  await api.cancelInventoryDispatch({ id: "dsp-9", version: 0 });
  assert.equal(calls[0][0], "patch");
  assert.equal(calls[0][1], "/inventory/receipts/rcpt-1");
  assert.deepEqual(calls[0][3], { headers: { "If-Match": "2" } });
  assert.deepEqual(calls[1].slice(0, 3), ["post", "/inventory/receipts/rcpt-1/post", undefined]);
  assert.deepEqual(calls[1][3], { headers: { "If-Match": "3", "Idempotency-Key": "inventory-receipt-post:rcpt-1:v3" } });
  assert.deepEqual(calls[2][3], { headers: { "If-Match": "0" } });
  await assert.rejects(api.postInventoryReceipt({ id: "rcpt-1", version: null }), /current version/);
  assert.equal(calls.length, 3);
});

test("dispatch drafts transfer between holders and never send revenue", async () => {
  const { calls, client } = recordingClient(() => ({ success: true, data: { id: "dsp-1" } }));
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  const values = { fromHolderId: "wh-1", toHolderId: "truck-3", assigneeEmployeeId: "", dailyRouteId: "", dispatchedAt: "2026-10-15T13:00", notes: "", lines: [{ key: "a", itemId: "box", quantity: "30" }] };
  await api.createInventoryDispatch(values);
  const body = calls[0][2];
  assert.deepEqual(body.lines, [{ itemId: "box", quantity: 30 }]);
  assert.equal("incomeGained" in body, false);
  assert.equal("dispatchedTo" in body, false);
  assert.equal("assigneeEmployeeId" in body, false);
  for (const key of Object.keys(body)) assert.ok(key in props("Dispatch"), `Dispatch.${key}`);
  await assert.rejects(api.createInventoryDispatch({ ...values, toHolderId: "wh-1" }), /sameHolder/);
  await assert.rejects(api.createInventoryDispatch({ ...values, lines: [{ key: "a", itemId: "box", quantity: "1.5" }] }), /quantityRequired/);
  assert.equal(calls.length, 1);
});

test("items and suppliers are deactivated with PATCH (full catalog fields + isActive), not deleted", async () => {
  const { calls, client } = recordingClient();
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  const item = {
    id: "item-1", version: 4, sku: "BOX", name: "Small box", unitOfMeasure: "unit", category: "",
    defaultSellingPriceMinor: 250, currency: "USD", reorderThreshold: 2, isActive: true,
  };
  const result = await api.setInventoryItemsActive([item, item, { ...item, id: "item-2", version: null }], false);
  assert.deepEqual(result.succeededIds, ["item-1"]);
  assert.deepEqual(result.failedIds, ["item-2"]);
  // The API rejects `{ isActive }` alone ("required inventory catalog fields missing").
  assert.deepEqual(calls, [[
    "patch",
    "/inventory/items/item-1",
    { sku: "BOX", name: "Small box", unitOfMeasure: "unit", category: "", currency: "USD", reorderThreshold: 2, defaultSellingPriceMinor: 250, isActive: false },
    { headers: { "If-Match": "4" } },
  ]]);
  const supplier = { id: "sup-1", version: 1, companyName: "Acme", contacts: [], addresses: ["1 Main St"], isActive: false };
  await api.setInventorySuppliersActive([supplier], true);
  assert.deepEqual(calls[1], [
    "patch",
    "/inventory/suppliers/sup-1",
    { companyName: "Acme", contacts: [], addresses: ["1 Main St"], isActive: true },
    { headers: { "If-Match": "1" } },
  ]);
  assert.equal(calls.some(([method]) => method === "delete"), false);
});

test("editing an item or supplier keeps its current active status", async () => {
  const { calls, client } = recordingClient((method, url, body) => ({ success: true, data: { id: "x", version: 2, ...body } }));
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  await api.updateInventoryItem(
    { id: "item-1", version: 1, isActive: true },
    { sku: "BOX", name: "Box", unitOfMeasure: "", category: "", defaultSellingPrice: "", reorderThreshold: "0" },
  );
  assert.equal(calls[0][2].isActive, true, "PATCH without isActive deactivates the record");
  await api.updateInventorySupplier({ id: "sup-1", version: 1, isActive: false }, { companyName: "Acme", contacts: [], addresses: [] });
  assert.equal(calls[1][2].isActive, false);
});

test("catalog and supplier payloads match inventory.Item and inventory.Supplier", async () => {
  const { calls, client } = recordingClient((method, url, body) => ({ success: true, data: { id: "x", ...body } }));
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  await api.createInventoryItem({ sku: " BOX ", name: " Small box ", unitOfMeasure: "unit", category: "", defaultSellingPrice: "2.50", reorderThreshold: "0" });
  assert.deepEqual(calls[0][2], { sku: "BOX", name: "Small box", unitOfMeasure: "unit", category: "", currency: "USD", reorderThreshold: 0, defaultSellingPriceMinor: 250, isActive: true });
  for (const key of Object.keys(calls[0][2])) assert.ok(key in props("Item"), `Item.${key}`);
  await api.createInventorySupplier({ companyName: "Acme", contacts: [{ name: "Ana", phone: "+12015550100", email: "ana@acme.test" }, { name: " ", phone: "", email: "" }], addresses: ["1 Main St", ""] });
  assert.deepEqual(calls[1][2], { companyName: "Acme", contacts: [{ name: "Ana", phone: "+12015550100", email: "ana@acme.test" }], addresses: ["1 Main St"], isActive: true });
  for (const key of Object.keys(calls[1][2])) assert.ok(key in props("Supplier"), `Supplier.${key}`);
  await assert.rejects(api.createInventorySupplier({ companyName: "Acme", contacts: [{ name: "", phone: "", email: "not-an-email" }], addresses: [] }), /emailInvalid/);
});

test("responses read the nested audit block, versions and stock balances", () => {
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", {});
  const item = api.normalizeInventoryItem({ id: "item-1", name: "Box", version: 0, isActive: false, defaultSellingPriceMinor: 0, audit: { createdAt: "2026-10-01T00:00:00Z", createdBy: "ana", updatedBy: "luis" } });
  assert.equal(item.version, 0);
  assert.equal(item.isActive, false);
  assert.equal(item.defaultSellingPriceMinor, 0);
  assert.equal(item.createdBy, "ana");
  assert.equal(item.updatedBy, "luis");
  assert.equal(api.normalizeInventoryItem({ id: "item-2", name: "Tape" }).version, null);
  const balance = api.normalizeInventoryStockBalance({ holderId: "wh-1", itemId: "box", condition: "QUARANTINED", quantityOnHand: 3, quantityReserved: 1 });
  assert.equal(balance.condition, "QUARANTINED");
  assert.equal(balance.id, "wh-1:box:QUARANTINED");
  const types = loadFeature("src/lib/inventory/types/catalog.ts", {});
  const summary = types.summarizeItemStock([balance, { ...balance, condition: "AVAILABLE", quantityOnHand: 10, quantityReserved: 0 }]).get("box");
  assert.deepEqual(summary, { available: 10, quarantined: 3, reserved: 1 });
});

test("adjustments are created as drafts and posted with the returned version", async () => {
  const { calls, client } = recordingClient((method) => (method === "post" && calls.length === 1 ? { success: true, data: { id: "adj-1", version: 1 } } : { success: true }));
  const api = loadFeature("src/lib/inventory/api/inventory-api.ts", client);
  await api.createAndPostInventoryAdjustment({ holderId: "truck-3", itemId: "box", condition: "AVAILABLE", adjustmentSign: "decrease", quantity: "2", reason: "recount", notes: "", occurredAt: "2026-10-15T18:00" });
  assert.equal(calls[0][1], "/inventory/adjustments");
  assert.deepEqual(calls[0][2].lines, [{ itemId: "box", condition: "AVAILABLE", quantityDelta: -2 }]);
  for (const key of Object.keys(calls[0][2])) assert.ok(key in props("StockAdjustment"), `StockAdjustment.${key}`);
  assert.equal(calls[1][1], "/inventory/adjustments/adj-1/post");
  assert.deepEqual(calls[1][3], { headers: { "If-Match": "1", "Idempotency-Key": "inventory-adjustment-post:adj-1:v1" } });
});
