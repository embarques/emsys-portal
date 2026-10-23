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
      if (specifier === "@/lib/api/axios") return { axiosInstance: {} };
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

const invoiceId = "68f800000000000000000001";
for (const [label, balance, expected] of [
  ["zero", 0, 0], ["string zero", "0.00", 0], ["outstanding", 25.5, 25.5],
  ["credit", -10, -10], ["missing", undefined, null], ["null", null, null],
  ["empty", "", null], ["invalid", "bad", null], ["boolean", false, null],
]) {
  test(`delivery balance read: ${label}`, async () => {
    const calls = [];
    const api = loadFeature("src/lib/invoices/api/invoices-api.ts", {
      get: async (url) => { calls.push(url); return { data: { id: invoiceId, number: "INV-1", balance } }; },
    });
    if (expected == null) await assert.rejects(() => api.fetchInvoiceById(invoiceId, undefined, true), /balance is unavailable/);
    else assert.equal((await api.fetchInvoiceById(invoiceId, undefined, true)).balance, expected);
    assert.deepEqual(calls, [`/invoices/${invoiceId}`]);
  });
}
test("balance review rejects a foreign invoice response", async () => {
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { get: async () => ({ data: { id: "68f800000000000000000002", balance: 0 } }) });
  await assert.rejects(() => api.fetchInvoiceById(invoiceId, undefined, true), /does not match/);
});
test("payment statement lookup uses a single filtered search", async () => {
  const calls = [];
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
    post: async (url, body) => { calls.push({url, body}); return {data: []}; },
    get: async () => { throw new Error("Must not list all statements"); },
  });
  assert.equal(await api.searchIncomeStatementForDate(3, "2026-10-23"), null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /income-statements\/search/);
  const body = JSON.stringify(calls[0].body);
  assert.match(body, /branch.id/); assert.match(body, /2026-10-23/);
});
