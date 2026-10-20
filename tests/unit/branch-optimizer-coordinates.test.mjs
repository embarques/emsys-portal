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


const feature = "src/lib/branches/api/branches-api.ts";
const point = { type: "Point", coordinates: [-73.9, 40.8] };
const branch = { id: 1, name: "Depot", address: { address1: "101 Main St", location: point } };

test("branch read and update preserve depot coordinates and trim only strings", async () => {
 let saved;
 const api = loadFeature(feature, {
  get: async () => ({ success: true, data: branch }),
  put: async (_url, body) => { saved = body; return { success: true, data: { ...branch, ...body } }; },
 });
 const loaded = await api.fetchBranchById(1);
 assert.deepEqual(loaded.address.location, point);
 const result = await api.updateBranch(1, { ...loaded, address: { ...loaded.address, address1: " 101 Main St " } });
 assert.deepEqual(saved.address.location, point);
 assert.equal(saved.address.address1, "101 Main St");
 assert.deepEqual(result.address.location, point);
});

test("explicitly clearing branch coordinates survives replacement updates", async () => {
 let saved;
 const api = loadFeature(feature, {
  get: async () => ({ data: branch }),
  put: async (_url, body) => { saved = body; return { success: true, data: { ...branch, ...body } }; },
 });
 const loaded = await api.fetchBranchById(1);
 await api.updateBranch(1, { ...loaded, address: { ...loaded.address, location: null } });
 assert.equal(saved.address.location, null);
});
