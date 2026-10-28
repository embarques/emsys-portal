import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadFeature(relative) {
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

const assigned = loadFeature("src/lib/invoices/assigned-invoice.ts");
const invoiceTypes = loadFeature("src/lib/invoices/types.ts");

const DATE = "2026-10-23";
const employee = (overrides = {}) => ({
  id: 5, name: "Jane Driver", title: "Driver", department: "Operations", email: "jane@x.com", active: true,
  branch: { id: 2, code: "NY", name: "New York" }, user: { id: 9, name: "jane" }, ...overrides,
});
const dailyRoute = (overrides = {}) => ({
  id: "route-1", name: "Truck 1 · 10/23", routeType: "pickup", active: true, date: DATE,
  branch: { id: 2, code: "NY" },
  employees: [{ id: 5, name: "Jane Driver", role: "driver" }], ...overrides,
});
const base = {
  date: DATE,
  currentUser: { branch: { id: 2, name: "New York" } },
  latestContainer: { id: 674, name: "95-25", containerNumber: "MSCU1" },
  branches: [{ id: 2, code: "NY", name: "New York", type: "office" }, { id: 3, code: "WH", name: "Warehouse", type: "warehouse" }],
};

test("crew on today's pickup route is received via that route with the latest container", () => {
  const context = assigned.resolveAssignedInvoiceContext({ ...base, employee: employee(), routes: [dailyRoute()] });
  assert.deepEqual(context.receivedBy, {
    source: "route", dailyRoute: { id: "route-1", name: "Truck 1 · 10/23" },
  });
  assert.deepEqual(context.container, { id: 674, name: "95-25" });
  assert.deepEqual(context.branch, { id: 2, code: "NY", name: "New York" });

  const values = assigned.applyAssignedInvoiceContext(invoiceTypes.createEmptyInvoiceForm(), context);
  assert.equal(values.date, DATE);
  assert.equal(values.containerId, "674");
  assert.equal(values.pickupSource, "route");
  assert.equal(values.routeId, "route-1");
  assert.equal(values.routeCrewId, "");
  assert.equal(values.pickupEmployeeId, "");
});

test("routes on other days, inactive, delivery, or without the employee are ignored", () => {
  const routes = [
    dailyRoute({ id: "other-day", date: "2026-10-22" }),
    dailyRoute({ id: "inactive", active: false }),
    dailyRoute({ id: "delivery", branch: { id: 7, code: "RD" } }),
    dailyRoute({ id: "not-crew", employees: [{ id: 99, name: "Other", role: "driver" }] }),
  ];
  assert.equal(assigned.findEmployeeDailyRoute(routes, 5, DATE), null);
  const context = assigned.resolveAssignedInvoiceContext({ ...base, employee: employee(), routes });
  assert.equal(context.receivedBy.source, "office");
});

test("without a route, office and warehouse employees are received in-house", () => {
  const office = assigned.resolveAssignedInvoiceContext({ ...base, employee: employee(), routes: [] });
  assert.equal(office.receivedBy.source, "office");
  assert.equal(office.receivedBy.employee.id, 5);
  assert.deepEqual(office.receivedBy.officeBranch, { id: 2, code: "NY", name: "New York" });

  const byBranch = assigned.resolveAssignedInvoiceContext({ ...base, employee: employee({ branch: { id: 3, code: "WH", name: "Warehouse" } }), routes: [] });
  assert.equal(byBranch.receivedBy.source, "warehouse");
  const byDepartment = assigned.resolveAssignedInvoiceContext({ ...base, employee: employee({ department: "Warehouse" }), routes: [] });
  assert.equal(byDepartment.receivedBy.source, "warehouse");

  const values = assigned.applyAssignedInvoiceContext(invoiceTypes.createEmptyInvoiceForm(), byBranch);
  assert.equal(values.pickupEmployeeId, "5");
  assert.equal(values.officeBranchName, "WH — Warehouse");
  assert.equal(values.routeId, "");
});

test("missing employee link, assignment, or container block with a specific code", () => {
  const code = (input) => {
    try { assigned.resolveAssignedInvoiceContext({ ...base, routes: [], ...input }); } catch (error) { return error.code; }
    return null;
  };
  assert.equal(code({ employee: null }), "employeeNotLinked");
  assert.equal(code({ employee: employee({ branch: { id: 7, code: "RD", name: "Santo Domingo" } }) }), "noAssignment");
  assert.equal(code({ employee: employee({ active: false }) }), "noAssignment");
  assert.equal(code({ employee: employee(), latestContainer: null }), "noContainer");
});

test("save context reuses the resolved assignment instead of re-reading it", () => {
  const route = assigned.buildAssignedInvoiceWriteContext(
    assigned.resolveAssignedInvoiceContext({ ...base, employee: employee(), routes: [dailyRoute()] }),
  );
  assert.equal(route.employee, undefined);
  assert.deepEqual(route.pickupAssignment.dailyRoute, { id: "route-1", name: "Truck 1 · 10/23" });
  assert.deepEqual(route.container, { id: 674, name: "95-25" });

  const office = assigned.buildAssignedInvoiceWriteContext(
    assigned.resolveAssignedInvoiceContext({ ...base, employee: employee(), routes: [] }),
  );
  assert.deepEqual(office.employee, { id: 5, name: "Jane Driver", userName: "jane@x.com", fullName: "Jane Driver" });
  assert.equal(office.pickupAssignment.source, "office");
});
