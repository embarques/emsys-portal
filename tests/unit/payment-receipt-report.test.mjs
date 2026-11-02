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


const feature = "src/lib/reports/api/reports-api.ts";
const id = "507f1f77bcf86cd799439011";
const request = { reportKey: "payment-receipt", filters: { receiptNumber: " RC-123 " }, format: "pdf" };

test("receipt number resolves exactly once and posts the journal id to transaction reports", async () => {
 const calls = [];
 const api = loadFeature(feature, { post: async (url, body) => {
  calls.push({ url, body });
  if (url.startsWith("/journals/search")) return { data: [{ id }], total: 1 };
  return { success: true, data: { url: "https://example.test/receipt.pdf" } };
 } });
 const result = await api.requestReportGeneration(request);
 assert.equal(result.status, "generated");
 assert.equal(calls.length, 2);
 assert.match(calls[0].url, /limit=2/);
 assert.match(JSON.stringify(calls[0].body), /RC-123/);
 assert.match(JSON.stringify(calls[0].body), /refNumber/);
 assert.equal(calls[1].url, "/reports/transactions");
 assert.equal(calls[1].body.type, "transaction");
 assert.equal(calls[1].body.collection, "journals");
 assert.deepEqual(calls[1].body.values, [id]);
});

test("missing, ambiguous, and invalid receipt matches never generate a PDF", async () => {
 for (const data of [[], [{ id }, { id }], [{ id: "invalid" }]]) {
  let calls = 0;
  const api = loadFeature(feature, { post: async () => { calls++; return { data, total: data.length }; } });
  await assert.rejects(() => api.requestReportGeneration(request));
  assert.equal(calls, 1);
 }
 const api = loadFeature(feature, { post: async () => { throw new Error("must not request"); } });
 await assert.rejects(() => api.requestReportGeneration({ ...request, filters: {} }), /Receipt number is required/);
});
