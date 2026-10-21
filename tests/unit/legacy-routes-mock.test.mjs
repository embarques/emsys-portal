import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Each loader gets a fresh module graph, so every test starts from the seeded mock store.
function createLoader(apiClient = {}) {
  const cache = new Map();
  return function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
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
const row = (field, operator, value, join = "and") => ({ id: `${field}-${operator}`, join, field, operator, value });
const listParams = (extra = {}) => ({ page: 1, limit: 40, sort: "name:asc", ...extra });
const ids = (result) => result.items.map((item) => item.id);
const form = (name, ...cities) => ({ name, cities: cities.map((value) => ({ value })) });

function unreachableClient() {
  return Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async () => {
    throw new Error(`mock mode must not call apiClient.${method}`);
  }]));
}

function loadMockApi() {
  delete process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK;
  return createLoader(unreachableClient())(feature);
}

test("mock mode is the default and lists seeded routes sorted by name without calling the API", async () => {
  const api = loadMockApi();
  const result = await api.fetchLegacyRoutesPage(listParams());
  assert.equal(result.total, 12);
  const names = result.items.map((item) => item.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.ok(result.items.every((item) => item.content.includes(",")), "seed routes list several cities");
});

test("mock list paginates with page, limit and offset", async () => {
  const api = loadMockApi();
  const first = await api.fetchLegacyRoutesPage(listParams({ page: 1, limit: 5 }));
  const third = await api.fetchLegacyRoutesPage(listParams({ page: 3, limit: 5 }));
  assert.equal(first.items.length, 5);
  assert.equal(third.items.length, 2);
  assert.equal(third.total, 12);
  assert.equal(new Set([...ids(first), ...ids(third)]).size, 7);
});

test("mock search box matches route name or any city, ignoring case and accents", async () => {
  const api = loadMockApi();
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "MIAMI" }))), [3, 1, 2]);
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "dóral" }))), [4]);
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "no such city" }))), []);
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "33157" }))), [2], "ZIP codes match too");
});

test("mock advanced filters apply name, city and numeric ID operators", async () => {
  const api = loadMockApi();
  const page = (filterRows) => api.fetchLegacyRoutesPage(listParams({ filterRows }));

  assert.deepEqual(ids(await page([row("content", "contains", "beach")])), [6]);
  assert.deepEqual(ids(await page([row("name", "startsWith", "miami")])), [1, 2]);
  assert.deepEqual(ids(await page([row("name", "eq", "orlando")])), [7]);
  assert.deepEqual(ids(await page([row("id", "gte", "10")])), [12, 11, 10]);
  assert.deepEqual(ids(await page([row("id", "lte", "2"), row("id", "neq", "1")])), [2]);
  assert.equal((await page([row("name", "neq", "Orlando")])).total, 11);
});

test("mock search and filter rows combine with AND", async () => {
  const api = loadMockApi();
  const result = await api.fetchLegacyRoutesPage(listParams({
    query: "miami",
    filterRows: [row("content", "contains", "lakes")],
  }));
  assert.deepEqual(ids(result), [3]);
});

test("mock CRUD round-trip creates, edits and deletes routes in the session store", async () => {
  const api = loadMockApi();

  const created = await api.createLegacyRoute(form("  Atlanta ", "Atlanta", "30060", "", "atlanta ", "Smyrna"));
  assert.deepEqual(created, { id: 13, name: "Atlanta", content: "Atlanta, 30060, Smyrna" }, "the mock assigns the next id");
  assert.equal((await api.fetchLegacyRoutesPage(listParams())).total, 13);
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "smyrna" }))), [13]);
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "30060" }))), [13], "ZIP codes are searchable");

  const updated = await api.updateLegacyRoute(13, form("Atlanta Metro", "Atlanta", "Decatur"));
  assert.deepEqual(updated, { id: 13, name: "Atlanta Metro", content: "Atlanta, Decatur" });
  assert.deepEqual(await api.fetchLegacyRoute(13), updated);
  assert.deepEqual(ids(await api.fetchLegacyRoutesPage(listParams({ query: "smyrna" }))), []);

  await api.deleteLegacyRoute(13);
  assert.equal((await api.fetchLegacyRoutesPage(listParams())).total, 12);
  await assert.rejects(api.fetchLegacyRoute(13), /not found/i);
  await assert.rejects(api.updateLegacyRoute(13, form("Gone", "Nowhere")), /not found/i);
  await assert.rejects(api.deleteLegacyRoute(13), /not found/i);
});

test("mock stores are isolated and never leak references to callers", async () => {
  const { createLegacyRoutesMockClient } = createLoader()("src/lib/legacy-routes/api/legacy-routes-mock.ts");
  const left = createLegacyRoutesMockClient({ seed: [{ id: 1, name: "A", content: "X" }] });
  const right = createLegacyRoutesMockClient({ seed: [{ id: 1, name: "A", content: "X" }] });

  await left.delete("/legacy-routes/1");
  assert.equal((await left.get("/legacy-routes?page=1&limit=10")).total, 0);
  assert.equal((await right.get("/legacy-routes?page=1&limit=10")).total, 1);

  const detail = await right.get("/legacy-routes/1");
  detail.data.name = "Mutated";
  assert.equal((await right.get("/legacy-routes/1")).data.name, "A");
  assert.equal((await right.post("/legacy-routes", { name: " ", content: "X" })).success, false);
});

test("disabling the mock flag sends requests to the central API client", async () => {
  process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK = "false";
  try {
    const calls = [];
    const api = createLoader({
      get: async (url) => {
        calls.push(url);
        return { success: true, data: [], total: 0 };
      },
    })(feature);
    await api.fetchLegacyRoutesPage(listParams());
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^\/legacy-routes\?/);
  } finally {
    delete process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK;
  }
});
