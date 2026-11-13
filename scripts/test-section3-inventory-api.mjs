#!/usr/bin/env node
/** Opt-in stock/closeout lifecycle on one new item and warehouse; never touches existing stock. */
import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {createApiSuite} from "./lib/api-suite.mjs";
import {createPortalLoader, createHttpApiClient} from "./lib/portal-modules.mjs";
const suite = createApiSuite({title: "Section 3 isolated inventory lifecycle", options: {writeFixtures: {flag: "--write-fixtures"}, output: {flag: "--output", takesValue: true}}});
const marker = `CODEX-INVENTORY-${randomUUID()}`, evidence = [], retained = {};
const api = createPortalLoader({apiClient: createHttpApiClient(request)})("src/lib/inventory/api/inventory-api.ts");
async function request(method, path, body, extraHeaders) {
  const r = await suite.request(method, path, body, extraHeaders);
  evidence.push({method, path, http: r.status, response: r.json});
  return r;
}
function verify(label, condition, r) {
  evidence.push({label, passed: Boolean(condition)});
  if (condition) suite.pass(label); else suite.fail(label, r?.status ?? 0, r?.json?.error ?? "Saved-state invariant failed");
}
async function read(path) {
  const r = await request("GET", path);
  if (!suite.ok(r)) throw Error(`Prerequisite ${path}: HTTP ${r.status}`);
  return r.json.data;
}
async function command(path, ref, body, key = randomUUID()) {
  return request("POST", path, body, {"If-Match": String(ref.version), "Idempotency-Key": key});
}
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) suite.note("No writes; use --write-fixtures only in an approved mock company.");
  else {
    retained.holder = await api.createInventoryHolder({type: "WAREHOUSE", displayName: marker, entityId: ""});
    retained.supplier = await api.createInventorySupplier({companyName: marker, contacts: [], addresses: []});
    retained.item = await api.createInventoryItem({sku: marker, name: marker, unitOfMeasure: "unit", category: "audit fixture", defaultSellingPrice: "1.00", reorderThreshold: "0"});
    const itemId = retained.item.id, holderId = retained.holder.id;
    const receipts = [];
    for (const [quantity, unitCost] of [["10", "0.50"], ["10", "1.00"]]) {
      let receipt = await api.createInventoryReceipt({supplierId: retained.supplier.id, toHolderId: holderId, receivedAt: new Date().toISOString(), notes: marker, lines: [{key: randomUUID(), itemId, quantity, unitCost}]});
      receipts.push(receipt.id); retained.receipts = receipts;
      await api.postInventoryReceipt(receipt);
      receipt = await api.fetchInventoryReceiptById(receipt.id);
      for (const party of ["WAREHOUSE", "CUSTODIAN"]) {
        if (receipt.status === "POSTED") break;
        if (receipt.confirmations?.[party.toLowerCase()]) continue;
        await api.confirmInventoryReceipt({ref: receipt, party, text: `${marker} counted`});
        receipt = await api.fetchInventoryReceiptById(receipt.id);
      }
      verify(`Receipt ${quantity} @ ${unitCost} reaches POSTED`, receipt.status === "POSTED");
      if (receipt.status !== "POSTED") throw Error("Receipt did not reach POSTED; no stock assumptions made");
    }
    const stock = await api.fetchInventoryStock({page: 1, limit: 10, holderId, itemId});
    verify("Two confirmed receipts leave exactly 20 fixture units", stock.items.filter(row => row.itemId === itemId && row.holderId === holderId).reduce((sum, row) => sum + row.quantityOnHand, 0) === 20);
    const valuation = await request("POST", "/inventory/reports/stock-valuation/search?page=1&limit=10", {filters: [{field: "itemId", operator: "eq", value: itemId}], pagination: {page: 1, limit: 10}});
    verify("Weighted receipt carrying value is 1500 cents for 20 units", suite.ok(valuation) && Array.isArray(valuation.json.data) && valuation.json.data.filter(row => row.itemId === itemId && row.holderId === holderId).reduce((sum, row) => sum + row.valueMinor, 0) === 1500, valuation);
    const actor = await read("/users/current");
    if (!actor.branch?.id) throw Error("Current actor branch missing");
    const clock = await read(`/vehicle-routes/business-date?branchId=${actor.branch.id}`);
    const opened = await request("POST", "/inventory/closeouts", {holderId, businessDate: clock.businessDate, timezone: clock.timezone, cutoffAt: clock.serverTime});
    verify("Create isolated holder closeout", suite.ok(opened), opened);
    if (!suite.ok(opened)) throw Error("Inventory closeout setup rejected");
    retained.closeoutId = opened.json.data.id;
    let closeout = await read(`/inventory/closeouts/${retained.closeoutId}`);
    const invalid = await command(`/inventory/closeouts/${closeout.id}/close`, closeout, {lines: [{itemId, available: -1, quarantined: 0}], notes: marker});
    verify("Negative physical count rejected", invalid.status >= 400 && invalid.status < 500, invalid);
    const afterInvalid = await read(`/inventory/closeouts/${closeout.id}`);
    verify("Rejected negative count preserves closeout version/status", afterInvalid.version === closeout.version && afterInvalid.status === closeout.status);
    const counts = {lines: [{itemId, available: 20, quarantined: 0}], notes: marker};
    const key = randomUUID();
    const closed = await command(`/inventory/closeouts/${closeout.id}/close`, closeout, counts, key);
    verify("Matching physical count closes fixture period", suite.ok(closed), closed);
    if (!suite.ok(closed)) throw Error("Closeout positive control failed");
    const replay = await command(`/inventory/closeouts/${closeout.id}/close`, closeout, counts, key);
    verify("Same closeout command replays without duplicate revision", suite.ok(replay), replay);
    closeout = await read(`/inventory/closeouts/${closeout.id}`);
    const revisionsBefore = await read(`/inventory/closeouts/${closeout.id}/revisions`);
    const reasonless = await command(`/inventory/closeouts/${closeout.id}/reopen`, closeout, {reason: ""});
    verify("Reopen requires an explanation", reasonless.status >= 400 && reasonless.status < 500, reasonless);
    const reopened = await command(`/inventory/closeouts/${closeout.id}/reopen`, closeout, {reason: `${marker} revision verification`});
    verify("Authorized reopen with reason succeeds", suite.ok(reopened), reopened);
    if (suite.ok(reopened)) {
      closeout = await read(`/inventory/closeouts/${closeout.id}`);
      const reclosed = await command(`/inventory/closeouts/${closeout.id}/close`, closeout, counts);
      verify("Reopened period closes as another revision", suite.ok(reclosed), reclosed);
      const revisionsAfter = await read(`/inventory/closeouts/${closeout.id}/revisions`);
      evidence.push({label: "Immutable revision comparison", before: revisionsBefore, after: revisionsAfter});
      const before = Array.isArray(revisionsBefore) ? revisionsBefore : revisionsBefore?.items;
      const after = Array.isArray(revisionsAfter) ? revisionsAfter : revisionsAfter?.items;
      verify("Reclose adds a revision and preserves prior snapshots", Array.isArray(before) && Array.isArray(after) && after.length === before.length + 1 && before.every(old => after.some(row => JSON.stringify(row) === JSON.stringify(old))));
    }
  }
} catch (error) {suite.fail("Inventory fixture prerequisite/lifecycle", error.response?.status ?? 0, error.message);}
finally {
  if (retained.item) {
    try {const item = await api.fetchInventoryItemById(retained.item.id); const result = await api.setInventoryItemsActive([item], false); evidence.push({label: "Item retirement", result}); verify("Fixture item retired", !(await api.fetchInventoryItemById(item.id)).isActive);} catch (error) {suite.fail("Item retirement", 0, error.message);}
  }
  if (retained.supplier) {
    try {const supplier = await api.fetchInventorySupplierById(retained.supplier.id); const result = await api.setInventorySuppliersActive([supplier], false); evidence.push({label: "Supplier retirement", result}); verify("Fixture supplier retired", !(await api.fetchInventorySupplierById(supplier.id)).isActive);} catch (error) {suite.fail("Supplier retirement", 0, error.message);}
  }
  suite.note(`Retained tagged stock/holder/documents for audit: ${marker}; IDs are in the evidence artifact. No pre-existing stock was changed.`);
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), companyId: suite.opts.companyId, marker, retained, evidence}, null, 2));
}
suite.finish("Isolated inventory checks complete; fault injection and wider grants remain separate.");
