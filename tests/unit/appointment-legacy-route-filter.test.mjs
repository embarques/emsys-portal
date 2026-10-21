import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

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
        const resolved = [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")].find(
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

const ordersApi = "src/lib/orders/api/orders-api.ts";
const row = (field, operator, value, join = "and") => ({ id: `${field}-${operator}`, join, field, operator, value });

function createRecordingClient(respond = () => ({ success: true, data: [], total: 0 })) {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return respond(method, ...args);
  }]));
  return { calls, client };
}

function pickupSearchBody(calls) {
  const post = calls.find(([method, url]) => method === "post" && url.startsWith("/pickups/search"));
  assert.ok(post, "expected POST /pickups/search");
  return post[2];
}

/** Finds the legacy-route node (the one filtering sender city / ZIP with in / notIn). */
function findAddressNode(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findAddressNode(entry);
      if (found) return found;
    }
    return null;
  }
  const isAddressLeaf = (entry) =>
    ["sender.address.city", "sender.address.zipcode"].includes(entry?.field) && ["in", "notIn"].includes(entry?.operator);
  if (isAddressLeaf(node)) return node;
  if (Array.isArray(node.filters) && node.filters.length && node.filters.every(isAddressLeaf)) {
    return { operator: node.operator, filters: node.filters };
  }
  return findAddressNode(node.filters);
}

function withMockFlag(value, run) {
  const previous = process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK;
  if (value == null) delete process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK;
  else process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK = value;
  return Promise.resolve(run()).finally(() => {
    if (previous == null) delete process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK;
    else process.env.NEXT_PUBLIC_LEGACY_ROUTES_MOCK = previous;
  });
}

const route = { id: 5, name: "South Dade", content: "Kendall, 33157, cutler bay, Homestead, 33030-1234" };

test("appointments offer a localized Legacy route select filter", () => {
  const load = createLoader();
  const definition = load("src/lib/orders/filter-fields.ts").ORDER_TABLE_FILTER_FIELDS.find((field) => field.field === "legacyRoute.id");
  assert.deepEqual(definition, {
    field: "legacyRoute.id",
    label: "Legacy route",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "legacyRoutes",
  });
  assert.equal(load("src/locales/en/orders.json").filters.fields.legacyRoute.id.label, "Legacy route");
  assert.equal(load("src/locales/es/orders.json").filters.fields.legacyRoute.id.label, "Ruta heredada");
});

test("legacy route 'equals' shows appointments whose sender city (any case) or ZIP is on the route", async () => {
  await withMockFlag("false", async () => {
    const { calls, client } = createRecordingClient((method, url) =>
      method === "get" && url === "/legacy-routes/5" ? { success: true, data: route } : { success: true, data: [], total: 0 });
    await createLoader(client)(ordersApi).fetchOrders({ filterRows: [row("legacyRoute.id", "eq", "5")] });

    assert.deepEqual(calls.map(([method, url]) => [method, url.split("?")[0]]), [
      ["get", "/legacy-routes/5"],
      ["post", "/pickups/search"],
    ]);
    assert.deepEqual(findAddressNode(pickupSearchBody(calls)), {
      operator: "or",
      filters: [
        {
          field: "sender.address.city",
          operator: "in",
          value: [
            "Kendall", "kendall", "KENDALL",
            "cutler bay", "CUTLER BAY", "Cutler Bay",
            "Homestead", "homestead", "HOMESTEAD",
          ],
        },
        { field: "sender.address.zipcode", operator: "in", value: ["33157", "33030-1234"] },
      ],
    });
  });
});

test("legacy route 'not equals' excludes appointments whose sender city or ZIP is on the route", async () => {
  await withMockFlag("false", async () => {
    const { calls, client } = createRecordingClient((method) =>
      method === "get" ? { success: true, data: route } : { success: true, data: [], total: 0 });
    await createLoader(client)(ordersApi).fetchOrders({ filterRows: [row("legacyRoute.id", "neq", "5")] });
    const node = findAddressNode(pickupSearchBody(calls));
    assert.equal(node.operator, "and");
    assert.deepEqual(node.filters.map((leaf) => [leaf.field, leaf.operator]), [
      ["sender.address.city", "notIn"],
      ["sender.address.zipcode", "notIn"],
    ]);
  });
});

test("legacy route filter combines with other rows and only loads each route once", async () => {
  await withMockFlag("false", async () => {
    const { calls, client } = createRecordingClient((method) =>
      method === "get" ? { success: true, data: route } : { success: true, data: [], total: 0 });
    await createLoader(client)(ordersApi).fetchOrders({
      filterRows: [
        row("branch.id", "eq", "3"),
        row("legacyRoute.id", "eq", "5"),
        row("legacyRoute.id", "eq", "5", "or"),
      ],
    });
    assert.equal(calls.filter(([method]) => method === "get").length, 1, "duplicate route rows share one lookup");
    const body = JSON.stringify(pickupSearchBody(calls));
    assert.match(body, /"field":"branch.id","operator":"eq","value":3/);
    assert.match(body, /"sender.address.zipcode","operator":"in","value":\["33157","33030-1234"\]/);
  });
});

test("appointment lists without a legacy route filter never look up legacy routes", async () => {
  await withMockFlag("false", async () => {
    const { calls, client } = createRecordingClient();
    const api = createLoader(client)(ordersApi);
    await api.fetchOrders({ filterRows: [row("sender.address.city", "contains", "Miami"), row("legacyRoute.id", "eq", "")] });
    await api.fetchOrders({});
    assert.deepEqual(calls.map(([method, url]) => [method, url.split("?")[0]]), [
      ["post", "/pickups/search"],
      ["get", "/pickups"],
    ]);
  });
});

test("a missing or invalid legacy route fails the search instead of silently showing every appointment", async () => {
  await withMockFlag("false", async () => {
    const { calls, client } = createRecordingClient((method) =>
      method === "get" ? { success: false, message: "Legacy route not found." } : { success: true, data: [], total: 0 });
    const api = createLoader(client)(ordersApi);
    await assert.rejects(api.fetchOrders({ filterRows: [row("legacyRoute.id", "eq", "99")] }), /not found/i);
    await assert.rejects(api.fetchOrders({ filterRows: [row("legacyRoute.id", "eq", "abc")] }), /invalid legacy route/i);
    assert.equal(calls.some(([method]) => method === "post"), false);
  });
});

test("with mock data enabled, the filter expands the sample route without calling the legacy routes API", async () => {
  await withMockFlag(undefined, async () => {
    const { calls, client } = createRecordingClient();
    await createLoader(client)(ordersApi).fetchOrders({ filterRows: [row("legacyRoute.id", "eq", "2")] });
    assert.deepEqual(calls.map(([method, url]) => [method, url.split("?")[0]]), [["post", "/pickups/search"]]);
    const node = findAddressNode(pickupSearchBody(calls));
    assert.ok(node.filters[0].value.includes("KENDALL"));
    assert.deepEqual(node.filters[1].value, ["33157", "33030"]);
  });
});

test("city case variants and city / ZIP classification", () => {
  const filter = createLoader()("src/lib/orders/legacy-route-filter.ts");
  assert.deepEqual(filter.cityCaseVariants("west palm beach"), ["west palm beach", "WEST PALM BEACH", "West Palm Beach"]);
  assert.ok(filter.cityCaseVariants("WILKES-BARRE").includes("Wilkes-Barre"));
  assert.ok(filter.cityCaseVariants("o'fallon").includes("O'Fallon"));
  assert.deepEqual(filter.cityCaseVariants("  "), []);
  assert.deepEqual(filter.splitLegacyRouteEntries("Boston, 02119, Lynn, 01902-4455, 1234, 123456"), {
    cities: ["Boston", "Lynn", "1234", "123456"],
    zips: ["02119", "01902-4455"],
  });
});
