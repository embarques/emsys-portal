import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, { apiClient = {}, axiosInstance = {} }) {
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
      if (specifier === "@/lib/api/axios") return { axiosInstance };
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

const emptyEnvelopes = [{ success: true, data: null, total: 0 }, { success: true, total: 0 }];

test("employee title and department lists treat null or missing data as empty", async () => {
  for (const envelope of emptyEnvelopes) {
    const titles = loadFeature("src/lib/employee-titles/api/employee-titles-api.ts", {
      apiClient: { get: async () => envelope },
    });
    assert.deepEqual(await titles.fetchAllEmployeeTitles(), []);

    const departments = loadFeature("src/lib/employee-departments/api/employee-departments-api.ts", {
      apiClient: { get: async () => envelope },
    });
    assert.deepEqual(await departments.fetchAllEmployeeDepartments(), []);
  }
});

test("invoice documents treat a null page or null items as an empty list", async () => {
  for (const data of [null, { items: null }, { items: null, nextCursor: null }]) {
    const api = loadFeature("src/lib/invoices/api/invoice-documents-api.ts", {
      axiosInstance: { get: async () => ({ data: { success: true, data } }) },
    });
    assert.deepEqual(await api.fetchInvoiceDocuments("inv-1"), { items: [], nextCursor: undefined });
  }
});

test("inventory workflow lists treat null data as empty but still reject malformed lists", async () => {
  for (const body of [null, { success: true, data: null, total: 0 }, {}]) {
    const api = loadFeature("src/lib/inventory/workflow/api/workflow-api.ts", {
      apiClient: { get: async () => body },
    });
    const page = await api.listWorkflow("holders", {});
    assert.deepEqual(page.data, []);
    assert.equal(api.nextWorkflowPage(page, [page]), undefined);
  }

  const api = loadFeature("src/lib/inventory/workflow/api/workflow-api.ts", {
    apiClient: { get: async () => ({ data: { id: "1" } }) },
  });
  await assert.rejects(() => api.listWorkflow("holders", {}), /listContract/);
});
