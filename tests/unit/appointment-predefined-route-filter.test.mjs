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


function leaves(node) {
 if (Array.isArray(node)) return node.flatMap(leaves);
 if (!node || typeof node !== "object") return [];
 return node.field ? [node] : leaves(node.filters);
}

test("route selection sends a server-side route ID in one pickup request", async () => {
 const {calls,client}=createRecordingClient();
 await createLoader(client)(ordersApi).fetchOrders({ page: 2, limit: 25, filterRows: [row("predefinedRoute.id","eq","5")] });
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],"post");
 assert.match(calls[0][1], /page=2/);
 assert.deepEqual(leaves(pickupSearchBody(calls)).filter(leaf=>leaf.field==="predefinedRoute.id"), [{field:"predefinedRoute.id",operator:"eq",value:5}]);
});

test("route restriction is ANDed with the existing OR filter group", async () => {
 const {calls,client}=createRecordingClient();
 await createLoader(client)(ordersApi).fetchOrders({ filterRows: [row("sender.address.city","eq","Miami"),row("sender.address.zipcode","eq","02119","or"),row("predefinedRoute.id","eq","2")] });
 const body=pickupSearchBody(calls);
 assert.equal(body.operator,"and");
 assert.ok(leaves(body).some(leaf=>leaf.field==="predefinedRoute.id" && leaf.value===2));
 assert.ok(JSON.stringify(body).includes('"operator":"or"'));
 assert.equal(calls.length,1,"no route detail request per pickup page");
});

test("All routes omits the route condition and preserves other filters", async () => {
 const {calls,client}=createRecordingClient();
 await createLoader(client)(ordersApi).fetchOrders({filterRows:[row("sender.address.city","contains","Miami"),row("predefinedRoute.id","eq","")]});
 assert.ok(!leaves(pickupSearchBody(calls)).some(leaf=>leaf.field==="predefinedRoute.id"));
 assert.ok(leaves(pickupSearchBody(calls)).some(leaf=>leaf.field==="sender.address.city"));
});

test("route appointments search only pickups with an assigned route, even without other filters", async () => {
 const {calls,client}=createRecordingClient();
 await createLoader(client)(ordersApi).fetchOrders({ page: 1, limit: 50, assignedRouteOnly: true });
 assert.equal(calls.length,1);
 assert.deepEqual(pickupSearchBody(calls).filters,[{field:"route.id",operator:"gt",value:""}]);
});

test("assigned-route scope is ANDed with search and filter rows", async () => {
 const {calls,client}=createRecordingClient();
 await createLoader(client)(ordersApi).fetchOrders({ assignedRouteOnly: true, filterRows: [row("sender.address.city","eq","Miami"),row("sender.address.zipcode","eq","02119","or")] });
 const body=pickupSearchBody(calls);
 assert.equal(body.operator,"and");
 assert.ok(leaves(body).some(leaf=>leaf.field==="route.id" && leaf.operator==="gt" && leaf.value===""));
 assert.ok(leaves(body).some(leaf=>leaf.field==="sender.address.city"));
});

test("route appointments bar search covers every text column; regular appointments keep their fields", async () => {
 const route=createRecordingClient();
 await createLoader(route.client)(ordersApi).fetchOrders({ assignedRouteOnly: true, search: { value: "santiago" } });
 const routeFields=leaves(pickupSearchBody(route.calls)).map(leaf=>leaf.field);
 for (const field of ["route.name","employee.name","sector.name","branch.code","createdBy.name","updatedBy.name","purpose","sender.name"]) assert.ok(routeFields.includes(field), field);
 const regular=createRecordingClient();
 await createLoader(regular.client)(ordersApi).fetchOrders({ search: { value: "santiago" } });
 const regularFields=leaves(pickupSearchBody(regular.calls)).map(leaf=>leaf.field);
 assert.ok(!regularFields.includes("route.name"));
 assert.ok(!regularFields.includes("employee.name"));
});

test("regular appointments keep the unfiltered GET without a route scope", async () => {
 const {calls,client}=createRecordingClient();
 await createLoader(client)(ordersApi).fetchOrders({ page: 1, limit: 50 });
 assert.equal(calls[0][0],"get");
 assert.match(calls[0][1],/^\/pickups\?/);
});

test("invalid route ID fails without issuing an API request", async () => {
 const {calls,client}=createRecordingClient();
 await assert.rejects(createLoader(client)(ordersApi).fetchOrders({filterRows:[row("predefinedRoute.id","eq","abc")]}),/invalid predefined route/i);
 assert.equal(calls.length,0);
});

test("a deleted route returns an error instead of removing its restriction", async () => {
 const {client}=createRecordingClient(()=>{throw new Error("Predefined route not found")});
 await assert.rejects(createLoader(client)(ordersApi).fetchOrders({filterRows:[row("predefinedRoute.id","eq","99")]}),/not found/);
});

test("mixed entries preserve order and ZIP leading zeros for display and editing", () => {
 const load=createLoader();
 const types=load("src/lib/predefined-routes/types.ts");
 const original={id:1,name:"Mixed",content:"Kendall, 02119, Cutler Bay, 33030-1234"};
 const form=types.predefinedRouteToFormValues(original);
 assert.deepEqual(form.cities.map(entry=>entry.value),["Kendall","02119","Cutler Bay","33030-1234"]);
 assert.deepEqual(types.toPredefinedRoutePayload(form),{name:original.name,content:original.content});
 assert.deepEqual(load("src/lib/orders/predefined-route-filter.ts").splitPredefinedRouteEntries(original.content),{cities:["Kendall","Cutler Bay"],zips:["02119","33030-1234"]});
});
