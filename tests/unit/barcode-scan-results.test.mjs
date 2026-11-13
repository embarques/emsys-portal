import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadScanner(invoices, catalog) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(id) {
      if (id === "@/lib/invoices/api/invoices-api") return invoices;
      if (id === "@/lib/labels/api/barcodes-api") return catalog;
      if (id === "@/lib/pickup-delivery-routes/api/route-business-date-api") return {fetchRouteDateGuard: async () => load(path.join(root, "src/lib/pickup-delivery-routes/assignment-policy.ts")).assertAssignableRouteDate};
      if (id.startsWith("@/") || id.startsWith(".")) {
        const target = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(filename), id);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(id);
    }
    new Function("require", "module", "exports", source)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load(path.join(root, "src/lib/labels/api/label-updater-api.ts"));
}

const options = {
  changeStatus: true, newStatusId: 3, changeContainer: false, changeRoute: false,
  statusOptions: [{ id: 1, name: "ALM-NY" }, { id: 3, name: "EN TRANSITO" }],
};
const translate = key => key;
const embedded = number => ({
  invoiceId: "invoice", invoiceNumber: "INV-1",
  barcode: { barcodeId: number, number, statusId: 1, statusName: "ALM-NY" },
});
const noCatalog = { fetchBarcodeByNumber: async () => { throw new Error("Not found"); } };

test("rejected invoice updates produce a failed change row without claiming applied fields", async () => {
  const api = loadScanner({
    findInvoiceBarcodeByNumber: async number => embedded(number),
    patchInvoiceEmbeddedBarcodes: async () => { throw new Error("VERSION_REQUIRED"); },
  }, noCatalog);
  const row = await api.applyBarcodeScanUpdate(" LABEL-1 ", options, "Scanner user", translate);
  assert.equal(row.success, false);
  assert.equal(row.barcode, "LABEL-1");
  assert.match(row.message, /VERSION_REQUIRED/);
  assert.equal(row.createdBy, "Scanner user");
  assert.ok(row.id);
  assert.ok(row.dateTime);
  for (const field of ["previousStatus", "newStatus", "previousContainer", "newContainer", "previousRoute", "newRoute"]) {
    assert.equal(row[field], undefined);
  }
});

test("bulk scan retains successful rows and continues after lookup and catalog write failures", async () => {
  const writes = [];
  const api = loadScanner({
    findInvoiceBarcodeByNumber: async number => {
      if (number === "lookup-fails") throw new Error("Lookup unavailable");
      return number === "catalog-fails" ? null : embedded(number);
    },
    patchInvoiceEmbeddedBarcodes: async (_id, patches) => { writes.push(patches[0].number); },
  }, {
    fetchBarcodeByNumber: async number => ({ id: 1, number, status: { id: 1, name: "ALM-NY" }, container: null, route: null, delivery: null }),
    updateBarcode: async () => { throw new Error("Update rejected"); },
  });
  const rows = await api.applyBarcodeScanUpdates(["first", "lookup-fails", "catalog-fails", "last"], options, "Scanner user", translate);
  assert.deepEqual(rows.map(row => [row.barcode, row.success]), [
    ["first", true], ["lookup-fails", false], ["catalog-fails", false], ["last", true],
  ]);
  assert.deepEqual(writes, ["first", "last"]);
  assert.match(rows[1].message, /Lookup unavailable/);
  assert.match(rows[2].message, /Update rejected/);
});

test("scanner records rejected past-route and delivered-label assignments as failed rows", async () => {
  for (const delivered of [false, true]) {
    let writes = 0;
    const api = loadScanner({
      findInvoiceBarcodeByNumber: async number => {
        const record = embedded(number);
        if (delivered) {
          record.barcode.statusId = 7;
          record.barcode.statusName = "ENTREGADO";
        }
        return record;
      },
      patchInvoiceEmbeddedBarcodes: async () => { writes++; },
    }, noCatalog);
    const row = await api.applyBarcodeScanUpdate("LABEL-1", {
      ...options, changeStatus: false, changeRoute: true, newRouteRecordId: "new-route",
      statusOptions: [...options.statusOptions, { id: 7, name: "ENTREGADO" }],
      newRouteDate: delivered ? "2099-01-01" : "2000-01-01",
    }, "Scanner user", translate);
    assert.equal(row.success, false);
    assert.equal(row.barcode, "LABEL-1");
    assert.match(row.message, delivered ? /cannot be reassigned or unassigned/ : /today or later/);
    assert.equal(writes, 0);
  }
});
