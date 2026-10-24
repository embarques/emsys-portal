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

const ALLOWED_FIELDS = new Set([
  "active", "branch.code", "branch.id", "branch.name", "createdAt", "createdBy.id", "createdBy.name",
  "employees.id", "employees.name", "id", "name", "updatedAt", "updatedBy.id", "updatedBy.name",
]);

function collectFields(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((entry) => collectFields(entry, out));
  } else if (node && typeof node === "object") {
    if (typeof node.field === "string" && "operator" in node && !("filters" in node)) out.push(node);
    Object.values(node).forEach((value) => collectFields(value, out));
  }
  return out;
}

function createRecordingClient() {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return { success: true, data: [], total: 0 };
  }]));
  return { calls, client };
}

function searchBody(calls) {
  const post = calls.find(([method, url]) => method === "post" && url.includes("/search"));
  assert.ok(post, "expected a POST to the routes search endpoint");
  return post[2];
}

test("route crew bar search only sends fields the /routes/search allow-list accepts", async () => {
  const { calls, client } = createRecordingClient();
  const api = loadFeature("src/lib/route-manager/api/route-manager-api.ts", client);

  await api.fetchRoutes({ page: 1, limit: 40, search: { value: "crew" } });

  const filters = collectFields(searchBody(calls)).filter((entry) => entry.field !== "pagination");
  assert.ok(filters.length > 0);
  for (const filter of filters) {
    assert.ok(ALLOWED_FIELDS.has(filter.field), `field "${filter.field}" is not allowed by the API`);
  }
  assert.ok(!filters.some((filter) => filter.field === "routeId"));
});

test("route crew advanced filter rows are sent with API-typed values", async () => {
  const { calls, client } = createRecordingClient();
  const api = loadFeature("src/lib/route-manager/api/route-manager-api.ts", client);

  await api.fetchRoutes({
    page: 1,
    limit: 50,
    filterRows: [
      { id: "a", join: "and", field: "active", operator: "eq", value: "false" },
      { id: "b", join: "and", field: "employees.id", operator: "eq", value: "42" },
    ],
  });

  const filters = collectFields(searchBody(calls));
  const active = filters.find((entry) => entry.field === "active");
  const employee = filters.find((entry) => entry.field === "employees.id");
  assert.equal(active?.value, false);
  assert.equal(employee?.value, 42);
});

test("daily-route API reads and writes canonical supervisor combined with driver", async () => {
  const raw = {
    id: "daily-route", routeType: "pickup", date: "2026-10-23",
    route: { id: "crew", name: "Crew" },
    driver: { id: 7, name: "Lead" }, supervisor: { id: 7, name: "Lead" },
  };
  const calls = [];
  const api = loadFeature("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", {
    post: async (url, body) => {
      calls.push([url, body]);
      return { success: true, data: raw };
    },
  });
  const normalized = api.normalizeApiVehicleRoute(raw);
  assert.equal(normalized.employees.length, 1);
  assert.deepEqual(normalized.employees[0].roles, ["driver", "supervisor"]);
  const types = loadFeature("src/lib/pickup-delivery-routes/types.ts", {});
  await api.createActiveRoute({
    ...types.createEmptyActiveRouteForm("pickup"),
    date: "2026-10-23", branch: { id: 1, code: "US", name: "Origin" },
    routeRecordId: "crew", routeAssignmentName: "Crew",
    employees: normalized.employees,
  });
  assert.deepEqual(calls[0][1].supervisor, { id: 7, name: "Lead" });
  assert.deepEqual(calls[0][1].driver, { id: 7, name: "Lead" });
  assert.equal(calls[0][1].employees[0].role, "driver");
  assert.equal("appraiser" in calls[0][1], false);
});
