import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient) {
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


const feature = "src/lib/barcodes/api/barcode-statuses-api.ts";
const status = { id: 1, name: "ALM-NY", prevStatus: "DEV-NY" };

test("published default catalog preserves all eight statuses and previous-status lists", async () => {
  const data = [
    { id: 1, name: "ALM-NY" },
    { id: 2, name: "DEV-NY", prevStatus: "EN TRANSITO" },
    { id: 3, name: "EN TRANSITO", prevStatus: "ALM-NY,DEV-NY,DEV-RD" },
    { id: 4, name: "ALM-RD", prevStatus: "EN TRANSITO" },
    { id: 5, name: "DEV-RD", prevStatus: "CONDUCE" },
    { id: 6, name: "CONDUCE", prevStatus: "ALM-RD,DEV-RD" },
    { id: 7, name: "ENTREGADO", prevStatus: "CONDUCE" },
    { id: 8, name: "SUBASTADO", prevStatus: "ALM-RD,DEV-RD" },
  ];
  const urls = [];
  const api = loadFeature(feature, { get: async (url) => {
    urls.push(url);
    assert.equal(urls.length, 1, "The complete catalog needs only one request");
    return {
      success: true, message: "Request successful", data, error: "",
      duration: 0.03871175, page: 1, resultsPerPage: 40, total: 8, subtotal: 0,
    };
  }});
  assert.deepEqual(await api.fetchBarcodeStatuses(), data);
  assert.deepEqual(urls, ["/barcode-statuses?page=1&offset=0&limit=40"]);
});

test("barcode status list unwraps the API envelope and loads later pages", async () => {
  const urls = [];
  const api = loadFeature(feature, { get: async (url) => {
    urls.push(url);
    return { success: true, data: [{ ...status, id: urls.length }], total: 2 };
  }});
  assert.deepEqual((await api.fetchBarcodeStatuses()).map(row => row.id), [1, 2]);
  assert.deepEqual(urls, ["/barcode-statuses?page=1&offset=0&limit=40", "/barcode-statuses?page=2&offset=1&limit=40"]);
});

test("barcode status list accepts items envelopes and reports API failures", async () => {
  const api = loadFeature(feature, { get: async () => ({ data: { items: [status] } }) });
  assert.deepEqual(await api.fetchBarcodeStatuses(), [status]);
  const failed = loadFeature(feature, { get: async () => ({ success: false, message: "Access denied" }) });
  await assert.rejects(failed.fetchBarcodeStatuses(), /Access denied/);
});

test("barcode status CRUD sends normalized values and explicitly clears previous status", async () => {
  const calls = [];
  const client = Object.fromEntries(["post", "put", "delete"].map(method => [method, async (...args) => {
    calls.push([method, ...args]);
    return { success: true, data: { id: 1, ...args[1] } };
  }]));
  const api = loadFeature(feature, client);
  assert.deepEqual(await api.createBarcodeStatus({ name: " ALM-NY ", prevStatus: " DEV-NY " }), status);
  assert.deepEqual(await api.updateBarcodeStatus(1, { name: " ALM-NY ", prevStatus: " " }), { id: 1, name: "ALM-NY" });
  await api.deleteBarcodeStatus(1);
  assert.deepEqual(calls, [
    ["post", "/barcode-statuses", { name: "ALM-NY", prevStatus: "DEV-NY" }],
    ["put", "/barcode-statuses/1", { name: "ALM-NY", prevStatus: "" }],
    ["delete", "/barcode-statuses/1"],
  ]);
  await assert.rejects(api.createBarcodeStatus({ name: " ", prevStatus: "" }));
  assert.equal(calls.length, 3);
});

test("barcode status mutations propagate API rejection", async () => {
  const client = Object.fromEntries(["post", "put", "delete"].map(method => [method, async () => ({ success: false, message: "Status is in use" })]));
  const api = loadFeature(feature, client);
  await assert.rejects(api.createBarcodeStatus(status), /Status is in use/);
  await assert.rejects(api.updateBarcodeStatus(1, status), /Status is in use/);
  await assert.rejects(api.deleteBarcodeStatus(1), /Status is in use/);
});
