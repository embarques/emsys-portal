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
  "employees.id", "employees.name", "id", "updatedAt", "updatedBy.id", "updatedBy.name",
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
    employees: normalized.employees,
  });
  assert.deepEqual(calls[0][1].supervisor, { id: 7, name: "Lead" });
  assert.deepEqual(calls[0][1].driver, { id: 7, name: "Lead" });
  assert.equal(calls[0][1].employees[0].role, "driver");
  assert.equal("appraiser" in calls[0][1], false);
});


for (const method of ["createRoute", "updateRoute"]) {
  test(`${method} requires two distinct crew members before sending a request`, async () => {
    const captured = [];
    const stop = new Error("Request captured");
    const send = async (_url, payload) => { captured.push(payload); throw stop; };
    const api = loadFeature("src/lib/route-manager/api/route-manager-api.ts", { post: send, put: send });
    const types = loadFeature("src/lib/route-manager/types.ts", {});
    const first = { id: 1, name: "First" };
    const second = { id: 2, name: "Second" };
    const save = (employees) => {
      const values = { ...types.createEmptyRouteForm(), branch: { id: 1, code: "NY", name: "New York" }, employees };
      return method === "createRoute" ? api.createRoute(values) : api.updateRoute("crew-1", values);
    };
    for (const employees of [[], [first], [first, first]]) {
      await assert.rejects(save(employees), /at least two crew members/);
    }
    assert.equal(captured.length, 0);
    for (const employees of [[first, second], [first, second, { id: 3, name: "Third" }]]) {
      await assert.rejects(save(employees), (error) => error === stop);
      assert.deepEqual(captured.at(-1).employees, employees);
    }
  });
}


for (const routeType of ["pickup", "delivery"]) {
  for (const method of ["createActiveRoute", "updateActiveRoute"]) {
    test(`${method} omits server-generated ${routeType} daily route name`, async () => {
      let payload;
      const stop = new Error("Request captured");
      const send = async (_url, body) => { payload = body; throw stop; };
      const api = loadFeature("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", { post: send, put: send });
      const types = loadFeature("src/lib/pickup-delivery-routes/types.ts", {});
      const values = {
        ...types.createEmptyActiveRouteForm(routeType),
        name: "Old or client-provided name",
        date: "2026-10-28", branch: { id: 1, code: routeType === "delivery" ? "RD" : "NY", name: "Branch" },
        vehicle: { id: "vehicle-1", name: "Truck" },
        routeRecordId: "crew-1",
        container: routeType === "delivery" ? { id: 1, name: "Container" } : null,
        employees: [{ id: 1, name: "Driver", role: "driver" }, { id: 2, name: "Supervisor", role: "supervisor" }],
      };
      await assert.rejects(method === "createActiveRoute" ? api.createActiveRoute(values) : api.updateActiveRoute("daily-route-1", values), error => error === stop);
      assert.equal(Object.hasOwn(payload, "name"), false);
      assert.equal(Object.hasOwn(payload, "route"), false);
      assert.deepEqual(payload.vehicle, { id: "vehicle-1", name: "Truck" });
      assert.equal(Object.hasOwn(payload, "dayOfWeek"), false);
      assert.equal(Object.hasOwn(payload, "type"), false);
      assert.equal(payload.routeType, routeType);
    });
  }
}

test("daily route requires a driver and a supervisor; helpers hold only the helper role", async () => {
  const captured = [];
  const stop = new Error("Request captured");
  const send = async (_url, body) => { captured.push(body); throw stop; };
  const api = loadFeature("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", { post: send, put: send });
  const types = loadFeature("src/lib/pickup-delivery-routes/types.ts", {});
  const save = (employees) => api.createActiveRoute({
    ...types.createEmptyActiveRouteForm("pickup"),
    date: "2026-10-28", branch: { id: 1, code: "NY", name: "Branch" },
    vehicle: { id: "vehicle-1", name: "Truck" },
    employees,
  });

  for (const employees of [
    [{ id: 1, name: "A", role: "helper" }, { id: 2, name: "B", role: "helper" }],
    [{ id: 1, name: "A", role: "driver" }, { id: 2, name: "B", role: "helper" }],
    [{ id: 1, name: "A", role: "supervisor" }, { id: 2, name: "B", role: "helper" }],
  ]) {
    await assert.rejects(save(employees), /driver and a supervisor/);
  }
  assert.equal(captured.length, 0);

  await assert.rejects(save([
    { id: 1, name: "Lead", role: "driver", roles: ["driver", "supervisor"] },
    { id: 2, name: "Helper", role: "helper" },
  ]), (error) => error === stop);
  const payload = captured.at(-1);
  assert.deepEqual(payload.driver, { id: 1, name: "Lead" });
  assert.deepEqual(payload.supervisor, { id: 1, name: "Lead" });
  assert.deepEqual(payload.helpers, [{ id: 2, name: "Helper" }]);
});

test("daily-route reader keeps routeType canonical and only uses the server-generated name", () => {
  const api = loadFeature("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", {});
  const base = { id: "daily-route", date: "2026-10-28" };

  const legacy = api.normalizeApiVehicleRoute({ ...base, type: "delivery", route: { id: "crew", name: "Crew" } });
  assert.equal(legacy.routeType, "pickup");
  assert.equal(legacy.name, "");
  assert.equal(Object.hasOwn(legacy, "route"), false);

  const generated = "2026-10-28_Truck 1_Lead+Helper";
  assert.equal(api.normalizeApiVehicleRoute({ ...base, routeType: "delivery", name: generated }).name, generated);
});

test("a hand-picked single employee becomes driver and supervisor and saves without a crew", async () => {
  const types = loadFeature("src/lib/pickup-delivery-routes/types.ts", {});
  const solo = types.applyDailyRouteEmployeeSelection([], [{ id: 4, name: "Solo", role: "helper" }]);
  assert.deepEqual(solo, [{ id: 4, name: "Solo", role: "driver", roles: ["driver", "supervisor"] }]);
  const withHelper = types.applyDailyRouteEmployeeSelection(solo, [...solo, { id: 5, name: "Help", role: "helper" }]);
  assert.deepEqual(withHelper[1], { id: 5, name: "Help", role: "helper" });

  let payload;
  const stop = new Error("Request captured");
  const api = loadFeature("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", {
    post: async (_url, body) => { payload = body; throw stop; },
  });
  await assert.rejects(api.createActiveRoute({
    ...types.createEmptyActiveRouteForm("pickup"),
    date: "2026-10-28", branch: { id: 1, code: "NY", name: "Branch" },
    vehicle: { id: "vehicle-1", name: "Truck" },
    employees: solo,
  }), (error) => error === stop);
  assert.deepEqual(payload.driver, { id: 4, name: "Solo" });
  assert.deepEqual(payload.supervisor, { id: 4, name: "Solo" });
  assert.deepEqual(payload.helpers, []);
  assert.equal(Object.hasOwn(payload, "route"), false);
});

test("existing daily route lookup matches the exact employee set, not a crew id", async () => {
  const rows = [
    { id: "superset", routeType: "pickup", date: "2026-10-28", employees: [{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }] },
    { id: "exact", routeType: "pickup", date: "2026-10-28", employees: [{ id: 2, name: "B" }, { id: 1, name: "A" }] },
  ];
  let body;
  const api = loadFeature("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", {
    post: async (_url, sent) => { body = sent; return { data: rows }; },
  });
  const found = await api.fetchVehicleRouteByEmployeesAndDate({ employeeIds: [1, 2], date: "2026-10-28", routeType: "pickup" });
  assert.equal(found.id, "exact");
  assert.ok(!collectFields(body).some((filter) => filter.field.startsWith("route.")));
});
