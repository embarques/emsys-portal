import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// These tests pin the real HTTP contract; the in-memory mock is covered in legacy-routes-mock.test.mjs.
process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK = "false";

// Compile feature modules with only the central HTTP boundary replaced.
function createLoader(apiClient = {}) {
  const cache = new Map();
  return function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
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
  };
}

const feature = "src/lib/legacy-routes/api/legacy-routes-api.ts";
const route = { id: 12, name: "North Dade", content: "Miami, Hialeah, Doral" };
const row = (field, operator, value, join = "and") => ({ id: `${field}-${operator}`, join, field, operator, value });
const form = (name, ...cities) => ({ name, cities: cities.map((value) => ({ value })) });

function createRecordingClient(respond = () => ({ success: true, data: [], total: 0 })) {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return respond(method, ...args);
  }]));
  return { calls, client };
}

function searchLeaves(calls) {
  const post = calls.find(([method, url]) => method === "post" && url.includes("/search"));
  assert.ok(post, "expected a POST to /legacy-routes/search");
  const leaves = [];
  (function walk(node) {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      if (typeof node.field === "string" && "operator" in node && !Array.isArray(node.filters)) leaves.push(node);
      Object.entries(node).forEach(([key, value]) => key !== "sort" && walk(value));
    }
  })(post[2]);
  return leaves.map((leaf) => [leaf.field, leaf.operator, leaf.value]);
}

test("legacy route CRUD sends the city/ZIP rows as normalized content and never sends an id", async () => {
  const { calls, client } = createRecordingClient(() => ({ success: true, data: route }));
  const api = createLoader(client)(feature);

  assert.deepEqual(await api.fetchLegacyRoute(12), route);
  assert.deepEqual(
    await api.createLegacyRoute(form("  North Dade ", " Miami ", "33010", "", "  Hialeah   Gardens ", "miami", "33010")),
    route,
  );
  await api.updateLegacyRoute(12, form("North Dade", "Miami", "Hialeah", "Doral"));
  await api.deleteLegacyRoute(12);

  assert.deepEqual(calls, [
    ["get", "/legacy-routes/12"],
    ["post", "/legacy-routes", { name: "North Dade", content: "Miami, 33010, Hialeah Gardens" }],
    ["put", "/legacy-routes/12", { name: "North Dade", content: "Miami, Hialeah, Doral" }],
    ["delete", "/legacy-routes/12"],
  ]);
});

test("invalid legacy route input never reaches the API", async () => {
  const { calls, client } = createRecordingClient(() => ({ success: true, data: route }));
  const api = createLoader(client)(feature);

  await assert.rejects(api.createLegacyRoute(form("   ", "Miami")));
  await assert.rejects(api.createLegacyRoute(form("North Dade")), "at least one city or ZIP is required");
  await assert.rejects(api.createLegacyRoute(form("North Dade", " ", "")), "blank rows do not count");
  await assert.rejects(api.createLegacyRoute(form("North Dade", "Miami, Doral")), "a row cannot hold a comma");
  await assert.rejects(api.updateLegacyRoute(0, form("North Dade", "Miami")));
  await assert.rejects(api.updateLegacyRoute(12, form("North Dade", "")));
  await assert.rejects(api.deleteLegacyRoute(1.5));
  await assert.rejects(api.fetchLegacyRoute(-3));
  assert.equal(calls.length, 0);
});

test("legacy route API failures are not reported as successful mutations", async () => {
  const api = createLoader({
    post: async () => ({ success: false, message: "Route name already exists" }),
    put: async () => ({ success: false, message: "Legacy route not found" }),
    delete: async () => ({ success: false, message: "Route is in use" }),
  })(feature);
  await assert.rejects(api.createLegacyRoute(form("North Dade", "Miami")), /already exists/);
  await assert.rejects(api.updateLegacyRoute(12, form("North Dade", "Miami")), /not found/);
  await assert.rejects(api.deleteLegacyRoute(12), /Route is in use/);
});

test("legacy route list pages via GET when no search or filters are active", async () => {
  const { calls, client } = createRecordingClient(() => ({
    success: true,
    data: [route, { id: 13, name: "Keys", content: null }],
    total: 42,
  }));
  const result = await createLoader(client)(feature).fetchLegacyRoutesPage({ page: 3, limit: 20, sort: "name:asc" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "get");
  assert.match(calls[0][1], /^\/legacy-routes\?page=3&limit=20&offset=40&sort=name/);
  assert.equal(result.total, 42);
  assert.deepEqual(result.items, [route, { id: 13, name: "Keys", content: "" }], "null content becomes empty text");
});

test("legacy route list treats an empty or null payload as no rows and rejects malformed rows", async () => {
  for (const data of [[], null]) {
    const { client } = createRecordingClient(() => ({ success: true, data, total: 0 }));
    const result = await createLoader(client)(feature).fetchLegacyRoutesPage({ page: 1, limit: 20, sort: "name:asc" });
    assert.deepEqual(result.items, []);
  }
  const { client } = createRecordingClient(() => ({ success: true, data: [{ id: "abc", name: "Bad" }] }));
  await assert.rejects(createLoader(client)(feature).fetchLegacyRoutesPage({ page: 1, limit: 20, sort: "name:asc" }));
});

test("search box matches route name or cities through POST /legacy-routes/search", async () => {
  const { calls, client } = createRecordingClient();
  await createLoader(client)(feature).fetchLegacyRoutesPage({ page: 1, limit: 20, sort: "name:asc", query: "doral" });

  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /^\/legacy-routes\/search\?/);
  assert.deepEqual(searchLeaves(calls), [
    ["name", "contains", "doral"],
    ["content", "contains", "doral"],
  ]);
  assert.deepEqual(calls[0][2].sort, [{ field: "name", direction: "asc" }]);
});

test("advanced filter rows send typed name, city and ID filters", async () => {
  const { calls, client } = createRecordingClient();
  await createLoader(client)(feature).fetchLegacyRoutesPage({
    page: 1,
    limit: 20,
    sort: "name:asc",
    filterRows: [
      row("name", "startsWith", "North"),
      row("content", "contains", "Hialeah"),
      row("id", "gte", "10"),
      row("id", "neq", "13"),
    ],
  });
  assert.deepEqual(searchLeaves(calls), [
    ["name", "startsWith", "North"],
    ["content", "contains", "Hialeah"],
    ["id", "gte", 10],
    ["id", "neq", 13],
  ]);
});

test("search and filter rows combine, and incomplete or invalid rows are ignored", async () => {
  const combined = createRecordingClient();
  await createLoader(combined.client)(feature).fetchLegacyRoutesPage({
    page: 1,
    limit: 20,
    sort: "name:asc",
    query: "miami",
    filterRows: [row("content", "eq", "Doral"), row("name", "contains", "")],
  });
  assert.deepEqual(searchLeaves(combined.calls), [
    ["name", "contains", "miami"],
    ["content", "contains", "miami"],
    ["content", "eq", "Doral"],
  ]);

  const invalidId = createRecordingClient();
  await createLoader(invalidId.client)(feature).fetchLegacyRoutesPage({
    page: 1,
    limit: 20,
    sort: "name:asc",
    filterRows: [row("id", "eq", "abc"), row("name", "eq", "Keys")],
  });
  assert.deepEqual(searchLeaves(invalidId.calls), [["name", "eq", "Keys"]], "non-numeric IDs are dropped");

  const blank = createRecordingClient();
  await createLoader(blank.client)(feature).fetchLegacyRoutesPage({
    page: 1,
    limit: 20,
    sort: "name:asc",
    query: "   ",
    filterRows: [row("name", "contains", "")],
  });
  assert.equal(blank.calls[0][0], "get", "blank search and empty rows fall back to the plain list");
});

test("city/ZIP parsing trims, collapses whitespace and removes case-insensitive duplicates", () => {
  const { parseRouteCities, formatRouteCities } = createLoader()("src/lib/legacy-routes/utils/route-cities.ts");
  assert.deepEqual(parseRouteCities(" Miami ,  West   Palm Beach,,MIAMI, 33010 "), ["Miami", "West Palm Beach", "33010"]);
  assert.deepEqual(parseRouteCities(""), []);
  assert.equal(formatRouteCities(["Doral", " ", "02119", "doral"]), "Doral, 02119");
});

test("editing a route loads one form row per city/ZIP and new routes start with one empty row", () => {
  const types = createLoader()("src/lib/legacy-routes/types.ts");
  assert.deepEqual(types.legacyRouteToFormValues({ ...route, content: "Miami, 33010" }), form("North Dade", "Miami", "33010"));
  assert.deepEqual(types.legacyRouteToFormValues({ ...route, content: "" }).cities, [{ value: "" }]);
  assert.deepEqual(types.createEmptyLegacyRouteForm(), form("", ""));
  assert.equal("id" in types.toLegacyRoutePayload(form("North Dade", "Miami")), false, "the API assigns ids");
});

test("unchanged edits are detected after normalizing name, spacing, blank rows and duplicates", () => {
  const types = createLoader()("src/lib/legacy-routes/types.ts");
  const current = types.legacyRouteToFormValues(route);
  assert.equal(types.areLegacyRouteFormValuesEquivalent(form(" North Dade ", "Miami ", "", "Hialeah", "Doral", "doral"), current), true);
  assert.equal(types.areLegacyRouteFormValuesEquivalent(form("North Dade", "Miami", "Hialeah", "DORAL"), current), false, "re-casing a city is a change");
  assert.equal(types.areLegacyRouteFormValuesEquivalent(form("North Dade", "Miami", "Doral", "Hialeah"), current), false, "row order is meaningful");
  assert.equal(types.areLegacyRouteFormValuesEquivalent(form("North Dade", "Miami", "Hialeah"), current), false, "removing a row is a change");
  assert.equal(types.areLegacyRouteFormValuesEquivalent(form("North Dade", "Miami", "Hialeah", "Doral", "33166"), current), false, "adding a row is a change");
  assert.equal(types.areLegacyRouteFormValuesEquivalent({ ...current, name: "South Dade" }, current), false);
});

test("legacy route filters and copy exist in English and Spanish with matching keys", () => {
  const load = createLoader();
  const read = (tree, key) => key.split(".").reduce((node, segment) => node?.[segment], tree);
  const keys = (node, prefix = "") => Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
  const en = load("src/locales/en/legacy-routes.json");
  const es = load("src/locales/es/legacy-routes.json");
  assert.deepEqual(keys(es).sort(), keys(en).sort());

  const { LEGACY_ROUTE_TABLE_FILTER_FIELDS } = load("src/lib/legacy-routes/filter-fields.ts");
  for (const tree of [en, es]) {
    for (const definition of LEGACY_ROUTE_TABLE_FILTER_FIELDS) {
      assert.equal(typeof read(tree, `filters.fields.${definition.field}.label`), "string");
      assert.equal(typeof read(tree, `filters.fields.${definition.field}.placeholder`), "string");
    }
  }
  for (const lang of ["en", "es"]) {
    assert.equal(typeof load(`src/locales/${lang}/navigation.json`).items.legacyRoutes, "string");
  }
});

test("legacy routes are listed under the Routes submenu with a registered workspace and page gate", () => {
  const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
  const navigation = read("src/config/navigation.ts");
  const routesBlock = navigation.slice(navigation.indexOf("const routesItem"), navigation.indexOf("const customersItem"));
  assert.match(routesBlock, /href: "\/legacy-routes"/);
  assert.match(read("src/lib/layout/workspace-registry.ts"), /"\/legacy-routes": LegacyRoutesWorkspace/);
  assert.match(read("src/lib/auth/page-permissions.ts"), /"\/legacy-routes": PERMISSIONS\.dispatchView/);
  assert.ok(fs.existsSync(path.join(root, "src/app/(dashboard)/legacy-routes/page.tsx")));
});
