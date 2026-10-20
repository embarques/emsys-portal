import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier in overrides) return overrides[specifier];
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        return load(target.endsWith(".json") ? target : fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

test("branch depot coordinates survive normalization and optimizer submission", async () => {
  const location = { type: "Point", coordinates: [-73.9, 40.7] };
  let sent;
  const api = {
    get: async () => ({ data: { id: 1, address: { address1: "Depot", location } } }),
    post: async (url, body) => { sent = body; return { data: { routes: [] } }; },
  };
  const branches = loadFeature("src/lib/branches/api/branches-api.ts", api);
  const optimizer = loadFeature("src/lib/route-optimizer/api/route-optimizer-api.ts", api);
  const branch = await branches.fetchBranchById(1);
  assert.deepEqual(branch.address.location, location);
  const { branchToFormValues } = loadFeature("src/lib/branches/types.ts", api);
  assert.deepEqual(branchToFormValues(branch).address.location, location);
  const request = { start: branch.address, end: branch.address, stops: [
    { id: "a", location: { type: "Point", coordinates: [0, 0] } },
    { id: "b", location: { type: "Point", coordinates: [-70, 42] } },
  ] };
  await optimizer.optimizeSingleRoute(request);
  assert.deepEqual(sent, request);
});

test("optimizer rejects invalid depot or stop coordinates before HTTP", async () => {
  let calls = 0;
  const optimizer = loadFeature("src/lib/route-optimizer/api/route-optimizer-api.ts", {
    post: async () => { calls++; },
  });
  const valid = { location: { type: "Point", coordinates: [0, 0] } };
  for (const invalid of [{}, { location: { type: "Point", coordinates: [181, 0] } },
    { location: { type: "Point", coordinates: [0, 91] } },
    { location: { type: "Point", coordinates: [null, 0] } },
    { location: { type: "Point", coordinates: [0, 0, 0] } }]) {
    await assert.rejects(optimizer.optimizeSingleRoute({ start: invalid, end: valid, stops: [valid, valid] }), /start requires/);
    await assert.rejects(optimizer.optimizeSingleRoute({ start: valid, end: invalid, stops: [valid, valid] }), /end requires/);
    await assert.rejects(optimizer.optimizeSingleRoute({ start: valid, end: valid, stops: [valid, invalid] }), /stops\[1\] requires/);
  }
  assert.equal(calls, 0);
});

test("endpoint form requires both coordinate pairs and preserves GeoJSON order", () => {
  const { routeEndpointsSchema, toRouteEndpointLocations } = loadFeature("src/lib/orders/schemas/route-endpoints.schema.ts", {});
  const values = { startLongitude: "-73.9", startLatitude: "40.7", endLongitude: "0", endLatitude: "0" };
  assert.deepEqual(toRouteEndpointLocations(values), {
    start: { type: "Point", coordinates: [-73.9, 40.7] },
    end: { type: "Point", coordinates: [0, 0] },
  });
  for (const field of Object.keys(values)) {
    for (const invalid of ["", " ", "NaN", "Infinity", "181", "-181"]) {
      assert.equal(routeEndpointsSchema.safeParse({ ...values, [field]: invalid }).success, false);
    }
  }
  assert.equal(routeEndpointsSchema.safeParse({ ...values, endLatitude: "91" }).success, false);
});

test("optimizer defaults to branch coordinates and accepts manual endpoints without a branch fetch", async () => {
  let branchReads = 0;
  let posts = [];
  let location = { type: "Point", coordinates: [-73.9, 40.7] };
  const api = {
    get: async () => { branchReads++; return { data: { id: 1, address: { location } } }; },
    post: async (_url, body) => {
      posts.push(body);
      return { data: { routes: [{ addresses: body.stops.map((stop, routeOrder) => ({ ...stop, routeOrder })) }] } };
    },
  };
  const { useOptimizeAppointmentRoute } = loadFeature("src/lib/orders/hooks/use-optimize-appointment-route.ts", api, {
    "@tanstack/react-query": {
      useMutation: (options) => options,
      useQueryClient: () => ({ fetchQuery: ({ queryFn }) => queryFn() }),
    },
    "@/lib/api/axios": { normalizeApiError: (error) => error },
  });
  const plan = { routeId: "route", branchId: 1, stops: [
    { orderRecordId: "1", address: { id: "a", location: { type: "Point", coordinates: [-70, 42] } } },
    { orderRecordId: "2", address: { id: "b", location: { type: "Point", coordinates: [-71, 43] } } },
  ] };
  const { mutationFn } = useOptimizeAppointmentRoute();
  await mutationFn(plan);
  assert.deepEqual(posts[0].start.location, location);
  assert.deepEqual(posts[0].end.location, location);
  location = undefined;
  await assert.rejects(mutationFn(plan), (error) => error.code === "branchCoordinatesMissing");
  assert.equal(posts.length, 1);
  const endpoints = { start: { type: "Point", coordinates: [0, 0] }, end: { type: "Point", coordinates: [-72, 41] } };
  await mutationFn({ ...plan, endpoints });
  assert.equal(branchReads, 2);
  assert.deepEqual(posts[1].start.location, endpoints.start);
  assert.deepEqual(posts[1].end.location, endpoints.end);
});
