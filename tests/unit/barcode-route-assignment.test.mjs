import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient, invoices) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/invoices/api/invoices-api") return invoices;
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const feature = "src/lib/labels/api/barcodes-api.ts";
const delay = () => new Promise(resolve => setTimeout(resolve, 5));

function fixture(failInvoice, statusId = 3, routeDate = "2099-01-01") {
  let active = 0;
  let peak = 0;
  const writes = [];
  const targets = Array.from({ length: 12 }, (_, index) => ({
    number: String(index + 1), invoiceId: String(Math.floor(index / 2)),
  }));
  const api = loadFeature(feature, {
    post: async () => { throw new Error("Not in catalog"); },
    get: async () => { throw new Error("Not in catalog"); },
  }, {
    fetchInvoiceById: async (id) => {
      active++;
      peak = Math.max(peak, active);
      await delay();
      active--;
      return { lineItems: [{ barcodes: targets.filter(t => t.invoiceId === id).map(t => ({
        number: t.number, barcodeId: `object-${t.number}`,
        statusId, statusName: statusId === 7 ? "ENTREGADO" : "EN TRANSITO", containerId: "9", containerName: "Container",
      })) }] };
    },
    patchInvoiceEmbeddedBarcodes: async (id, patches) => {
      await delay();
      if (id === failInvoice) throw new Error("Write rejected");
      writes.push({ id, patches });
    },
  });
  return { api, targets, writes, routeDate, peak: () => peak };
}

test("route assignments run concurrently, group invoice labels, and preserve location fields", async () => {
  const f = fixture();
  const progress = [];
  const result = await f.api.assignBarcodesToDailyRoute("route", "Daily route", f.targets, p => progress.push(p), f.routeDate);
  assert.equal(result.assignedCount, 12);
  assert.equal(f.peak(), 4);
  assert.equal(f.writes.length, 6);
  assert.equal(new Set(f.writes.map(w => w.id)).size, 6);
  for (const { patches } of f.writes) {
    assert.equal(patches.length, 2);
    assert.deepEqual(patches[0].status, { id: 3, name: "EN TRANSITO" });
    assert.deepEqual(patches[0].container, { id: 9, name: "Container" });
    assert.deepEqual(patches[0].route, { id: "route", name: "Daily route" });
  }
  assert.deepEqual(progress[0], { phase: "checking", completed: 0, total: 12 });
  assert.deepEqual(progress.at(-1), { phase: "assigning", completed: 12, total: 12 });
});

test("partial failure waits for all assignments and reports the successful count", async () => {
  const f = fixture("0");
  await assert.rejects(f.api.assignBarcodesToDailyRoute("route", "Daily route", f.targets, undefined, f.routeDate), /10 of 12 labels assigned.*Write rejected/);
  assert.equal(f.writes.length, 5);
});

test("unresolved labels prevent any assignments", async () => {
  const f = fixture();
  await assert.rejects(f.api.assignBarcodesToDailyRoute("route", "Daily route", [...f.targets, { number: "missing" }], undefined, f.routeDate), /Barcode not found/);
  assert.equal(f.writes.length, 0);
});


test("catalog lookups and updates are bounded and duplicate catalog IDs are written once", async () => {
  let active = 0;
  let peak = 0;
  const writes = [];
  const records = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1, number: String(index + 1),
    status: { id: 3, name: "EN TRANSITO" }, container: { id: 9, name: "Container" },
  }));
  async function request(result) {
    active++;
    peak = Math.max(peak, active);
    await delay();
    active--;
    return { data: result };
  }
  const api = loadFeature(feature, {
    post: async () => request(records),
    get: async url => request(records[Number(url.split("/").at(-1)) - 1]),
    put: async (url, payload) => {
      writes.push({ url, payload });
      return request(payload);
    },
  }, {});
  const targets = [...records, records[0]].map(row => ({ number: row.number }));
  const result = await api.assignBarcodesToDailyRoute("route", "Daily route", targets, undefined, "2099-01-01");
  assert.equal(peak, 4);
  assert.equal(result.assignedCount, 9);
  assert.equal(writes.length, 9);
  for (const { payload } of writes) {
    assert.deepEqual(payload.status, records[0].status);
    assert.deepEqual(payload.container, records[0].container);
    assert.deepEqual(payload.route, { id: "route", name: "Daily route" });
  }
});

test("historical destination routes are rejected before any barcode writes", async () => {
  const f = fixture(undefined, 3, "2000-01-01");
  await assert.rejects(f.api.assignBarcodesToDailyRoute("route", "Old route", f.targets, undefined, f.routeDate), /today or later/);
  assert.equal(f.writes.length, 0);
});

test("delivered embedded labels cannot move to another daily route", async () => {
  const f = fixture(undefined, 7);
  await assert.rejects(f.api.assignBarcodesToDailyRoute("route", "Daily route", f.targets, undefined, f.routeDate), /cannot be reassigned or unassigned/);
  assert.equal(f.writes.length, 0);
});

test("delivered catalog labels cannot move to another daily route", async () => {
  let writes = 0;
  const api = loadFeature(feature, {
    post: async () => ({ data: [{ id: 1, number: "DELIVERED", status: { id: 7, name: "ENTREGADO" }, route: { id: "original" } }] }),
    get: async () => ({ data: { id: 1, number: "DELIVERED", status: { id: 7, name: "ENTREGADO" }, route: { id: "original" } } }),
    put: async () => { writes++; return {success: true}; },
  }, {});
  await assert.rejects(api.assignBarcodesToDailyRoute("route", "Daily route", [{ number: "DELIVERED" }], undefined, "2099-01-01"), /cannot be reassigned or unassigned/);
  assert.equal(writes, 0);
});
