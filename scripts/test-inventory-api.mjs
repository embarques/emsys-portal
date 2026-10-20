#!/usr/bin/env node
/**
 * Inventory API suite driven by the portal's own inventory module
 * (`src/lib/inventory/api/inventory-api.ts`): the same payload builders,
 * `If-Match` version headers and normalizers the UI uses, over real HTTP.
 *
 * Flow:
 *   1. Seed  — create a supplier, an item, a DRAFT receipt and a DRAFT dispatch
 *   2. List / read / search / filter each directory (seeds must be findable)
 *   3. Update each seed (PATCH with version)
 *   4. Retire — the API has no DELETE for inventory records, so drafts are
 *      cancelled and the item/supplier are deactivated. The ZZ_PROBE_* records
 *      remain (hidden from active lists). Nothing is posted, so stock never moves.
 *
 * Stock balances are read-only and only listed.
 *
 * Usage:
 *   node scripts/test-inventory-api.mjs '<jwt>' [--skip-crud]
 */
import { createApiSuite } from "./lib/api-suite.mjs";
import { createHttpApiClient, createPortalLoader } from "./lib/portal-modules.mjs";

const suite = createApiSuite({ title: "Inventory API suite (portal inventory module over HTTP)" });
const { pass, fail, note, stamp } = suite;

const load = createPortalLoader({ apiClient: createHttpApiClient(suite.request) });
const api = load("src/lib/inventory/api/inventory-api.ts");
const types = load("src/lib/inventory/types/index.ts");

suite.banner();

/** Runs a portal call, records PASS/FAIL, and returns the result (or null). */
async function step(label, run, detail) {
  try {
    const result = await run();
    pass(label, detail ? detail(result) : "");
    return result;
  } catch (error) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      fail(`${label} (auth check)`, error.response.status, String(error.message));
      console.log("\nAuth failed. Refresh the temporary token and try again.");
      process.exit(1);
    }
    fail(label, error?.response?.status ?? 0, String(error?.message ?? error).slice(0, 200));
    return null;
  }
}

const nowLocal = new Date().toISOString().slice(0, 16);
const line = (fields) => ({ key: `line-${stamp}`, ...fields });
const seeds = { supplier: null, item: null, receipt: null, dispatch: null };

// ---------------------------------------------------------------------------
// 1. Seed (create first so list/search run against known records)
// ---------------------------------------------------------------------------
const holders = (await step("fetchInventoryHolders", () => api.fetchInventoryHolders({ page: 1, limit: 200 }), (r) => `total=${r.total}`))?.items ?? [];
const warehouse = holders.find((holder) => holder.type === "WAREHOUSE" && holder.isActive) ?? holders.find((holder) => holder.type === "WAREHOUSE");
const custodian = holders.find((holder) => holder.id !== warehouse?.id && holder.isActive) ?? holders.find((holder) => holder.id !== warehouse?.id);

if (!suite.opts.skipCrud) {
  console.log("\n=== Seed ===");
  seeds.supplier = await step(
    "createInventorySupplier",
    () =>
      api.createInventorySupplier({
        companyName: `ZZ_PROBE_SEED_SUPPLIER_${stamp}`,
        contacts: [{ name: "Probe Contact", phone: "555-0100", email: `probe-${stamp}@example.com` }],
        addresses: ["1 Probe St"],
      }),
    (supplier) => `id=${supplier.id}`,
  );
  seeds.item = await step(
    "createInventoryItem",
    () =>
      api.createInventoryItem({
        sku: `ZZSKU${stamp}`,
        name: `ZZ_PROBE_SEED_ITEM_${stamp}`,
        unitOfMeasure: "box",
        category: "ZZ probe",
        defaultSellingPrice: "1.00",
        reorderThreshold: "1",
      }),
    (item) => `id=${item.id} sku=${item.sku}`,
  );

  if (seeds.supplier && seeds.item && warehouse) {
    seeds.receipt = await step(
      "createInventoryReceipt (DRAFT)",
      () =>
        api.createInventoryReceipt({
          supplierId: seeds.supplier.id,
          toHolderId: warehouse.id,
          receivedAt: nowLocal,
          notes: `ZZ_PROBE_SEED_RECEIPT_${stamp}`,
          lines: [line({ itemId: seeds.item.id, quantity: "1", unitCost: "0.50" })],
        }),
      (receipt) => `id=${receipt.id} status=${receipt.status}`,
    );
  } else {
    note("Receipt seed skipped: needs a supplier, an item and a WAREHOUSE holder.");
  }

  if (seeds.item && warehouse && custodian) {
    seeds.dispatch = await step(
      "createInventoryDispatch (DRAFT)",
      () =>
        api.createInventoryDispatch({
          fromHolderId: warehouse.id,
          toHolderId: custodian.id,
          assigneeEmployeeId: "",
          dailyRouteId: "",
          dispatchedAt: nowLocal,
          notes: `ZZ_PROBE_SEED_DISPATCH_${stamp}`,
          lines: [line({ itemId: seeds.item.id, quantity: "1" })],
        }),
      (dispatch) => `id=${dispatch.id} status=${dispatch.status}`,
    );
  } else {
    note("Dispatch seed skipped: needs an item, a WAREHOUSE holder and a second holder.");
  }
}

// ---------------------------------------------------------------------------
// 2. List / read / search / filter
// ---------------------------------------------------------------------------
const directories = [
  { label: "items", fetch: "fetchInventoryItems", byId: "fetchInventoryItemById", seed: () => seeds.item, query: (item) => item.name, filterRows: (item) => [{ id: "f", join: "and", field: "sku", operator: "eq", value: item.sku }] },
  { label: "suppliers", fetch: "fetchInventorySuppliers", byId: "fetchInventorySupplierById", seed: () => seeds.supplier, query: (supplier) => supplier.companyName, filterRows: () => [{ id: "f", join: "and", field: "isActive", operator: "eq", value: "true" }] },
  { label: "receipts", fetch: "fetchInventoryReceipts", byId: "fetchInventoryReceiptById", seed: () => seeds.receipt, query: () => null, filterRows: (receipt) => [{ id: "f", join: "and", field: "supplierId", operator: "eq", value: receipt.supplierId }] },
  { label: "dispatches", fetch: "fetchInventoryDispatches", byId: "fetchInventoryDispatchById", seed: () => seeds.dispatch, query: () => null, filterRows: (dispatch) => [{ id: "f", join: "and", field: "toHolderId", operator: "eq", value: dispatch.toHolderId }] },
];

for (const directory of directories) {
  console.log(`\n=== ${directory.label} ===`);
  const page = await step(`${directory.fetch} page 1`, () => api[directory.fetch]({ page: 1, limit: 20 }), (r) => `total=${r.total} items=${r.items.length}`);
  const seed = directory.seed();
  const sample = seed ?? page?.items?.[0];
  if (!sample) {
    note(`No ${directory.label} to read.`);
    continue;
  }
  await step(`${directory.byId}(${sample.id})`, () => api[directory.byId](sample.id), (record) => `version=${record.version}`);
  if (!seed) continue;

  const query = directory.query(seed);
  if (query) {
    const found = await step(`${directory.fetch} search "${query}"`, () => api[directory.fetch]({ page: 1, limit: 20, search: { value: query } }), (r) => `total=${r.total}`);
    if (found && !found.items.some((record) => record.id === seed.id)) fail(`seed ${directory.label} in search results`, 200, "not found");
    else if (found) pass(`seed ${directory.label} in search results`);
  }
  const filtered = await step(
    `${directory.fetch} filter ${directory.filterRows(seed)[0].field}`,
    () => api[directory.fetch]({ page: 1, limit: 50, filterRows: directory.filterRows(seed) }),
    (r) => `total=${r.total}`,
  );
  if (filtered && !filtered.items.some((record) => record.id === seed.id)) fail(`seed ${directory.label} in filtered results`, 200, "not found");
  else if (filtered) pass(`seed ${directory.label} in filtered results`);
}

console.log("\n=== stock (read-only) ===");
await step("fetchInventoryStock", () => api.fetchInventoryStock({ page: 1, limit: 5 }), (r) => `total=${r.total}`);

// ---------------------------------------------------------------------------
// 3. Update
// ---------------------------------------------------------------------------
if (!suite.opts.skipCrud) {
  console.log("\n=== Update ===");
  if (seeds.item) {
    const values = { ...types.inventoryItemToFormValues(seeds.item), name: `${seeds.item.name}_UPD`, reorderThreshold: "2" };
    seeds.item = (await step("updateInventoryItem", () => api.updateInventoryItem(seeds.item, values), (item) => `name=${item.name} version=${item.version}`)) ?? seeds.item;
  }
  if (seeds.supplier) {
    const values = { ...types.supplierToFormValues(seeds.supplier), companyName: `${seeds.supplier.companyName}_UPD` };
    seeds.supplier =
      (await step("updateInventorySupplier", () => api.updateInventorySupplier(seeds.supplier, values), (supplier) => `companyName=${supplier.companyName}`)) ?? seeds.supplier;
  }
  for (const [kind, fetchById] of [["item", "fetchInventoryItemById"], ["supplier", "fetchInventorySupplierById"]]) {
    if (!seeds[kind]) continue;
    await step(`${kind} still active after edit`, async () => {
      const record = await api[fetchById](seeds[kind].id);
      if (!record.isActive) throw new Error("edit deactivated the record");
      return record;
    });
  }
  if (seeds.receipt) {
    const values = { ...types.receiptToFormValues(seeds.receipt), notes: `ZZ_PROBE_SEED_RECEIPT_${stamp}_UPD` };
    seeds.receipt = (await step("updateInventoryReceipt", () => api.updateInventoryReceipt(seeds.receipt, values), (receipt) => `version=${receipt.version}`)) ?? seeds.receipt;
  }
  if (seeds.dispatch) {
    const values = { ...types.dispatchToFormValues(seeds.dispatch), notes: `ZZ_PROBE_SEED_DISPATCH_${stamp}_UPD` };
    seeds.dispatch = (await step("updateInventoryDispatch", () => api.updateInventoryDispatch(seeds.dispatch, values), (dispatch) => `version=${dispatch.version}`)) ?? seeds.dispatch;
  }
}

// ---------------------------------------------------------------------------
// 4. Retire (no DELETE in the inventory API)
// ---------------------------------------------------------------------------
if (seeds.dispatch || seeds.receipt || seeds.item || seeds.supplier) {
  console.log("\n=== Retire seeds (cancel / deactivate) ===");
  if (seeds.dispatch) {
    await step("cancelInventoryDispatch", () => api.cancelInventoryDispatch(seeds.dispatch));
    await step("dispatch is CANCELLED", async () => {
      const dispatch = await api.fetchInventoryDispatchById(seeds.dispatch.id);
      if (dispatch.status !== "CANCELLED") throw new Error(`status=${dispatch.status}`);
      return dispatch;
    });
  }
  if (seeds.receipt) {
    await step("cancelInventoryReceipt", () => api.cancelInventoryReceipt(seeds.receipt));
    await step("receipt is CANCELLED", async () => {
      const receipt = await api.fetchInventoryReceiptById(seeds.receipt.id);
      if (receipt.status !== "CANCELLED") throw new Error(`status=${receipt.status}`);
      return receipt;
    });
  }
  if (seeds.item) {
    await step("setInventoryItemsActive(false)", async () => {
      const result = await api.setInventoryItemsActive([seeds.item], false);
      if (result.failedIds.length) throw new Error(result.firstErrorMessage ?? "deactivate failed");
      return result;
    });
    await step("item is inactive", async () => {
      const item = await api.fetchInventoryItemById(seeds.item.id);
      if (item.isActive) throw new Error("still active");
      return item;
    });
  }
  if (seeds.supplier) {
    await step("setInventorySuppliersActive(false)", async () => {
      const result = await api.setInventorySuppliersActive([seeds.supplier], false);
      if (result.failedIds.length) throw new Error(result.firstErrorMessage ?? "deactivate failed");
      return result;
    });
    await step("supplier is inactive", async () => {
      const supplier = await api.fetchInventorySupplierById(seeds.supplier.id);
      if (supplier.isActive) throw new Error("still active");
      return supplier;
    });
  }
  note(
    `Retired (not deleted — the API has no inventory DELETE): ${Object.entries(seeds)
      .filter(([, record]) => record)
      .map(([kind, record]) => `${kind}=${record.id}`)
      .join(" ")}`,
  );
}

suite.finish("All inventory checks passed.");
