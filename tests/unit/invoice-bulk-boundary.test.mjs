import assert from "node:assert/strict";
import test from "node:test";
import {createPortalLoader} from "../../scripts/lib/portal-modules.mjs";

function fixture() {
  const calls = [];
  const load = createPortalLoader({apiClient: {
    get: async (path, config) => { calls.push({method: "GET", path, config}); return {data: {businessDate: "2026-11-12", timezone: "America/New_York", serverTime: "2026-11-12T18:00:00Z", nextMidnight: "2026-11-13T05:00:00Z"}}; },
    put: async (path, body) => {calls.push({method: "PUT", path, body}); return {success: true, data: {route: {id: "route-1"}, assignedCount: body.barcodeIds.length}};},
  }});
  return {api: load("src/lib/labels/api/barcodes-api.ts"), calls};
}

test("invalid invoice piece batches never reach the clock or write boundary", async () => {
  for (const ids of [[], [0], [-1], [1.5], ["1e2"], ["wrong"], [4294967296], [1, "1"], Array.from({length: 201}, (_, index) => index + 1)]) {
    const {api, calls} = fixture();
    await assert.rejects(api.assignInvoiceItemBarcodesToRoute("route-1", ids, "2026-11-12", 2));
    assert.deepEqual(calls, []);
  }
});

test("200 invoice pieces use numeric IDs, one scoped clock read and one bulk mutation", async () => {
  const {api, calls} = fixture();
  const ids = Array.from({length: 200}, (_, index) => String(index + 1));
  const result = await api.assignInvoiceItemBarcodesToRoute("route-1", ids, "2026-11-12", 2);
  assert.equal(result.assignedCount, 200);
  assert.deepEqual(calls.map(call => call.method), ["GET", "PUT"]);
  assert.equal(calls[0].config.params.branchId, 2);
  assert.equal(calls[1].path, "/invoices/item/barcode/route/route-1");
  assert.deepEqual(calls[1].body, {barcodeIds: ids.map(Number)});
});

test("invoice deletion requires the captured revision and propagates attached-document conflicts without retry", async () => {
  const calls = [];
  const conflict = Object.assign(new Error("Invoice has attached documents"), {response: {status: 409}});
  const api = createPortalLoader({apiClient: {delete: async (...args) => {calls.push(args); throw conflict;}}})("src/lib/invoices/api/invoices-api.ts");
  const id = "650000000000000000000001", version = `v1:${"a".repeat(64)}`;
  await assert.rejects(api.deleteInvoice(id));
  assert.equal(calls.length, 0);
  await assert.rejects(api.deleteInvoice(id, version), error => error === conflict);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [`/invoices/${id}`, undefined, {headers: {"If-Match": `"${version}"`}}]);
});
