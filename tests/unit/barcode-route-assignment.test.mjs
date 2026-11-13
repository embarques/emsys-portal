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
      if (specifier === "@/lib/pickup-delivery-routes/api/route-business-date-api") return {
        fetchRouteDateGuard: async () => load(path.join(root, "src/lib/pickup-delivery-routes/assignment-policy.ts")).assertAssignableRouteDate,
      };
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
    post: async () => ({ data: [] }),
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

function httpError(status) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: { message: `HTTP ${status}` } } });
}

for (const status of [401, 403, 500, 503]) {
  test(`catalog lookup HTTP ${status} cannot fall through to an invoice write`, async () => {
    let fallbackReads = 0;
    const api = loadFeature(feature, {
      post: async () => { throw httpError(status); },
      get: async () => { fallbackReads++; },
    }, {
      fetchInvoiceById: async () => { fallbackReads++; },
      patchInvoiceEmbeddedBarcodes: async () => { throw new Error("Unexpected write"); },
    });
    await assert.rejects(api.assignBarcodesToDailyRoute("next", "Next", [{ number: "A", catalogId: 42, invoiceId: "invoice" }], undefined, "2099-01-01"), status === 401 ? /session has expired/ : new RegExp(`HTTP ${status}`));
    assert.equal(fallbackReads, 0);
  });
}

test("mixed catalog/invoice failures settle every job and report only persisted pieces", async () => {
  const catalog = [
    { id: 1, number: "A", status: { id: 3, name: "EN TRANSITO" } },
    { id: 2, number: "B", status: { id: 7, name: "ENTREGADO" }, route: { id: "old" } },
  ];
  const writes = [];
  const progress = [];
  const api = loadFeature(feature, {
    post: async () => ({ data: catalog }),
    get: async url => ({ data: catalog[Number(url.split("/").at(-1)) - 1] }),
    put: async (_url, payload) => { await delay(); writes.push(payload.number); return { success: true, data: payload }; },
  }, {
    fetchInvoiceById: async id => ({ lineItems: [{ barcodes: id === "good" ? ["C", "D"].map(number => ({ number, barcodeId: number, statusId: 3, statusName: "EN TRANSITO" })) : [] }] }),
    patchInvoiceEmbeddedBarcodes: async (_id, patches) => { await delay(); writes.push(...patches.map(p => p.number)); },
  });
  const targets = [{ number: "A" }, { number: "B" }, { number: "C", invoiceId: "good" }, { number: "D", invoiceId: "good" }, { number: "E", invoiceId: "missing" }];
  await assert.rejects(api.assignBarcodesToDailyRoute("next", "Next", targets, p => progress.push(p), "2099-01-01"), /3 of 5 labels assigned/);
  assert.deepEqual(writes.sort(), ["A", "C", "D"]);
  assert.deepEqual(progress.at(-1), { phase: "assigning", completed: 5, total: 5 });
});

test("completion after lookup is checked again before a catalog route write", async () => {
  let writes = 0;
  const pending = { id: 1, number: "A", status: { id: 6, name: "CONDUCE" }, route: { id: "old" } };
  const api = loadFeature(feature, {
    post: async () => ({ data: [pending] }),
    get: async () => ({ data: { ...pending, status: { id: 7, name: "ENTREGADO" } } }),
    put: async () => { writes++; },
  }, {});
  await assert.rejects(api.assignBarcodesToDailyRoute("next", "Next", [{ number: "A" }], undefined, "2099-01-01"), /0 of 1.*cannot be reassigned or unassigned/);
  assert.equal(writes, 0);
});

for (const embedded of [false, true]) {
  test(`${embedded ? "embedded" : "catalog"} assignment rechecks calendar rollover after asynchronous reads`, async () => {
    const RealDate = globalThis.Date;
    let instant = new RealDate("2099-01-01T23:59:59").getTime();
    let writes = 0;
    const pending = { id: 1, number: "A", status: { id: 3, name: "EN TRANSITO" } };
    const api = loadFeature(feature, {
      post: async () => ({ data: embedded ? [] : [pending] }),
      get: async () => { instant = new RealDate("2099-01-02T00:00:01").getTime(); return { data: pending }; },
      put: async () => { writes++; },
    }, {
      fetchInvoiceById: async () => {
        instant = new RealDate("2099-01-02T00:00:01").getTime();
        return { lineItems: [{ barcodes: [{ number: "A", barcodeId: "A", statusId: 3, statusName: "EN TRANSITO" }] }] };
      },
      patchInvoiceEmbeddedBarcodes: async () => { writes++; },
    });
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
    };
    try {
      await assert.rejects(api.assignBarcodesToDailyRoute("next", "Next", [{ number: "A", ...(embedded ? { invoiceId: "invoice" } : {}) }], undefined, "2099-01-01"), /0 of 1.*today or later/);
      assert.equal(writes, 0);
    } finally { globalThis.Date = RealDate; }
  });
}

test("unfinished catalog route null is sent explicitly; omitted route stays omitted", async () => {
  const sent = [];
  const existing = { id: 1, number: "A", status: { id: 6, name: "CONDUCE" }, route: { id: "old", name: "Old" } };
  const api = loadFeature(feature, {
    put: async (_url, payload) => { sent.push(JSON.parse(JSON.stringify(payload))); return { success: true, data: payload }; },
  }, {});
  await api.updateBarcode(1, { number: "A", status: existing.status, route: null }, existing);
  await api.updateBarcode(1, { number: "A", status: existing.status }, existing);
  assert.equal(sent[0].route, null);
  assert.equal(Object.hasOwn(sent[1], "route"), false);
  await assert.rejects(api.updateBarcode(1, { number: "A", status: { id: 7, name: "ENTREGADO" }, route: null }, { ...existing, status: { id: 7, name: "ENTREGADO" } }), /cannot be reassigned or unassigned/);
  assert.equal(sent.length, 2);
});

for (const route of [null, undefined]) {
  test(`embedded barcode patch ${route === null ? "clears" : "preserves"} route without changing delivery identity`, async () => {
    const invoice = { id: 42, version: `v1:${"a".repeat(64)}`, invoiceDetails: [{ barcodes: [{
      id: 123, barcodeId: "piece", number: "A", status: { id: 6, name: "CONDUCE" },
      route: { id: "old", name: "Old", tripNumber: 4 }, delivery: { id: 987 },
    }] }] };
    const writes = [];
    const api = loadFeature("src/lib/invoices/api/invoices-api.ts", {
      get: async () => ({ data: structuredClone(invoice) }),
      put: async (url, body, config) => { writes.push({ url, body, config }); return { success: true }; },
    });
    await api.patchInvoiceEmbeddedBarcodes("42", [{ barcodeId: "piece", number: "A", status: { id: 6, name: "CONDUCE" }, ...(route === null ? { route } : {}) }]);
    const saved = writes[0].body.invoiceDetails[0].barcodes[0];
    assert.deepEqual(saved.route, route === null ? null : invoice.invoiceDetails[0].barcodes[0].route);
    assert.deepEqual(saved.delivery, { id: 987 });
    assert.deepEqual(saved.status, { id: 6, name: "CONDUCE" });
    assert.equal(writes[0].config.headers["If-Match"], JSON.stringify(invoice.version));
  });
}

test("delivered embedded barcode route removal is rejected before PUT", async () => {
  let writes = 0;
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", {
    get: async () => ({ data: { id: 42, version: `v1:${"a".repeat(64)}`, invoiceDetails: [{ barcodes: [{ id: 123, number: "A", status: { id: 7, name: "ENTREGADO" }, route: { id: "old" } }] }] } }),
    put: async () => { writes++; },
  });
  await assert.rejects(api.patchInvoiceEmbeddedBarcodes("42", [{ barcodeId: "123", number: "A", status: { id: 7, name: "ENTREGADO" }, route: null }]), /cannot be reassigned or unassigned/);
  assert.equal(writes, 0);
});

test("atomic invoice batch validates all IDs before transport and preserves numeric IDs", async () => {
  const writes = [];
  const api = loadFeature(feature, { put: async (url, body) => { writes.push({url, body}); return {success: true, data: {}}; } }, {});
  for (const invalid of [[], [1, "1"], [1, 0], [1, -1], [1, 1.5], [1, "abc"], [1, 4294967296], Array.from({length: 201}, (_, i) => i + 1)]) {
    await assert.rejects(api.assignInvoiceItemBarcodesToRoute("route", invalid, "2099-01-01"));
  }
  assert.equal(writes.length, 0);
  await api.assignInvoiceItemBarcodesToRoute("route", [1, "2", 4294967295], "2099-01-01");
  assert.deepEqual(writes[0].body, {barcodeIds: [1, 2, 4294967295]});
  assert.equal(writes.length, 1);
});

test("embedded update adapter forwards null and preserves omission without a catalog fallback", async () => {
  const calls = [];
  const api = loadFeature(feature, {
    get: async () => {throw new Error("Unexpected catalog read");},
    post: async () => {throw new Error("Unexpected catalog search");},
  }, {patchInvoiceEmbeddedBarcodes: async (id, patches) => {calls.push({id, patches});}});
  for (const route of [null, undefined]) {
    await api.updateBarcodes([{id: 123, barcodeId: "piece", invoiceId: "42", writeTarget: "invoice-embedded", payload: {
      number: "A", status: {id: 6, name: "CONDUCE"}, ...(route === null ? {route} : {}),
    }}]);
  }
  assert.equal(calls[0].id, "42");
  assert.equal(calls[0].patches[0].route, null);
  assert.equal(Object.hasOwn(calls[1].patches[0], "route"), false);
});
