import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadDisplay(relative = "src/lib/pickup-delivery-routes/display.ts", apiClient = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (filename.endsWith(".json")) {
      loadedModule.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      return loadedModule.exports;
    }
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        const resolved = [target, `${target}.ts`, path.join(target, "index.ts")].find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        return load(resolved);
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

function route(overrides) {
  return {
    id: "route-1",
    name: "2-70-26",
    routeType: "pickup",
    container: { id: 70, name: "70-26" },
    date: "2026-10-22",
    branch: { id: 1, code: "NY", name: "New York" },
    vehicle: { id: "v1", name: "Truck 1" },
    active: true,
    employees: [{ id: 1, name: "Basilio", role: "driver", roles: ["driver", "supervisor"] }],
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
    ...overrides,
  };
}

const {
  formatActiveRouteAssignmentLabel,
  formatActiveRouteReferenceLabel,
  formatActiveRouteRowLabel,
  buildActiveRouteAssignmentOptions,
} = loadDisplay();

test("daily route dropdowns order by scheduled date regardless of creation date without mutating cached records", () => {
  const records = [
    route({ id: "old", date: "2026-10-20", createdAt: "2026-11-01T09:00:00Z" }),
    route({ id: "new", date: "2026-11-10", createdAt: "2026-10-01T09:00:00Z" }),
    route({ id: "middle", date: "2026-11-01", createdAt: "2026-10-15T09:00:00Z" }),
  ];
  assert.deepEqual(buildActiveRouteAssignmentOptions(records).map(option => option.value), ["new", "middle", "old"]);
  assert.deepEqual(records.map(record => record.id), ["old", "new", "middle"]);
});

test("daily route table defaults sort by date descending on every server page and preserve explicit header sorting", async () => {
  const calls = [];
  const { buildActiveRouteListParams } = loadDisplay("src/lib/pickup-delivery-routes/types.ts");
  const { fetchActiveRoutes } = loadDisplay("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", {
    post: async (url, body) => { calls.push({ url, body }); return { data: [], total: 0 }; },
  });
  for (const page of [1, 2]) {
    const params = buildActiveRouteListParams({ page, limit: 25, query: "", rows: [], routeType: "pickup", branchCode: "NY" });
    await fetchActiveRoutes(params);
    const call = calls.at(-1);
    assert.equal(new URL(call.url, "https://fixture.invalid").searchParams.get("page"), String(page));
    assert.deepEqual(call.body.sort, [{ field: "date", direction: "desc" }]);
    assert.ok(JSON.stringify(call.body.filters).includes("branch.code"));
    assert.ok(JSON.stringify(call.body.filters).includes("routeType"));
  }
  await fetchActiveRoutes(buildActiveRouteListParams({ page: 1, query: "", rows: [], sort: "date:asc" }));
  assert.deepEqual(calls.at(-1).body.sort, [{ field: "date", direction: "asc" }]);
  assert.equal(calls.length, 3, "One request per server page; no fetch-all sorting");
});

test("delivery daily routes display the stored conduce name", () => {
  const delivery = route({
    routeType: "delivery",
    branch: { id: 2, code: "RD", name: "RD" },
    name: "2-70-26",
  });
  assert.equal(formatActiveRouteRowLabel(delivery), "2-70-26");
  assert.equal(formatActiveRouteReferenceLabel(delivery), "2-70-26");
  assert.equal(formatActiveRouteAssignmentLabel(delivery), "2-70-26");
});

test("pickup daily routes display the API-generated name", () => {
  const generated = "2026-10-22_Truck 1_Basilio+Ana";
  const pickup = route({ routeType: "pickup", name: generated, container: null });
  assert.equal(formatActiveRouteRowLabel(pickup), generated);
  assert.equal(formatActiveRouteAssignmentLabel(pickup), generated);
});

test("daily routes without a generated name fall back to the schedule · employees label", () => {
  const pickup = route({
    routeType: "pickup",
    branch: { id: 2, code: "RD", name: "RD" },
    name: "",
    container: null,
  });
  const label = formatActiveRouteRowLabel(pickup);
  assert.equal(label.includes("Basilio"), true);
  assert.equal(label.includes("2026"), true);
});
