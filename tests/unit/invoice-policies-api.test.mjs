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


const feature = "src/lib/invoice-policies/api/invoice-policies-api.ts";
const policy = { id: 1, title: "Shipping terms", body: "Terms", sortOrder: 0, active: true };

test("active policies are ordered for agreement display", async () => {
  const api = loadFeature(feature, { get: async (url) => {
    assert.equal(url, "/invoice-policies/active");
    return { success: true, data: [{ ...policy, id: 2, sortOrder: 2 }, policy] };
  } });
  assert.deepEqual((await api.fetchActiveInvoicePolicies()).map((row) => row.id), [1, 2]);
});

test("empty active policies are allowed, but failed and malformed responses cannot bypass agreement", async () => {
  for (const response of [{ success: false, message: "Unavailable", data: [] }, { success: true, data: {} }, {}]) {
    const api = loadFeature(feature, { get: async () => response });
    await assert.rejects(() => api.fetchActiveInvoicePolicies());
  }
  for (const data of [[], null]) {
    const api = loadFeature(feature, { get: async () => ({ success: true, data }) });
    assert.deepEqual(await api.fetchActiveInvoicePolicies(), []);
  }
});

test("policy list treats a null data payload as an empty list", async () => {
  const api = loadFeature(feature, { get: async () => ({ success: true, data: null, total: 0 }) });
  assert.deepEqual(await api.fetchInvoicePolicies(), { items: [], page: 1, resultsPerPage: 0, total: 0 });
  assert.deepEqual(await api.fetchAllInvoicePolicies(), []);
});
