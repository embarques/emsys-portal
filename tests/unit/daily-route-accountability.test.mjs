import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient = {}) {
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
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return load(target);
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const ROUTE_ID = "68f800000000000000000abc";
const statement = { id: 1, date: "2026-10-28", status: "OPEN", branch: { id: 2 }, currency: "USD", rate: 1 };
const route = (employees) => ({
  id: ROUTE_ID,
  name: "2026-10-28_Truck_Ana",
  vehicle: { id: "veh-1", name: "Truck" },
  employees,
});

test("a route's only supervisor is responsible; several supervisors need an explicit choice", () => {
  const { resolveDailyRouteSupervisor } = loadFeature("src/lib/accounting/daily-income/assignee.ts");
  const single = route([
    { id: 1, name: "Ana", role: "driver", roles: ["driver", "supervisor"] },
    { id: 2, name: "Ben", role: "helper" },
  ]);
  assert.deepEqual(resolveDailyRouteSupervisor(single), { id: 1, name: "Ana" });

  const shared = route([
    { id: 1, name: "Ana", role: "supervisor" },
    { id: 3, name: "Cy", role: "supervisor" },
    { id: 4, name: "Dee", role: "driver" },
  ]);
  assert.equal(resolveDailyRouteSupervisor(shared), null);
  assert.deepEqual(resolveDailyRouteSupervisor(shared, 3), { id: 3, name: "Cy" });
  // A helper is never accepted as the responsible supervisor.
  assert.equal(resolveDailyRouteSupervisor(shared, 4), null);
});

test("route payments keep the route attribution and post under the supervisor only", async () => {
  let sent;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
    post: async (_url, body) => { sent = body; return { success: true, data: { id: "journal-1" } }; },
  });
  await api.createDailyIncomeJournal(statement, {
    transactionType: "PAYMENT", amount: 20, invoiceId: "inv-1", paymentMethodName: "CASH", refNumber: "", description: "",
    assigneeSource: "route", routeId: ROUTE_ID, routeName: "2026-10-28_Truck_Ana", supervisorId: 1, supervisorName: "Ana",
  });
  assert.deepEqual(sent.vehicleRoute, { id: ROUTE_ID, name: "2026-10-28_Truck_Ana" });
  assert.deepEqual(sent.route, sent.vehicleRoute);
  assert.deepEqual(sent.employee, { id: 1, name: "Ana" });
});

test("inventory dispatch sends joint holders and route attribution, never a journal employee", async () => {
  let sent;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
    post: async (_url, body) => { sent = body; return { success: true, data: { id: "journal-2" } }; },
  });
  await api.createDailyIncomeJournal(statement, {
    transactionType: "INVENTORY", inventoryDirection: "dispatched", inventoryItemId: "box", inventoryItemName: "Box",
    inventoryQuantity: 20, inventoryUnitPrice: 1, inventoryTotal: 20, amount: 20, refNumber: "", description: "",
    routeId: ROUTE_ID, routeName: "2026-10-28_Truck_Ana", employeeId: 9, employeeName: "Stale",
    inventoryHolderVehicleId: "veh-1", inventoryHolderVehicleName: "Truck",
    inventoryHolderEmployees: [{ id: 1, name: "Ana" }, { id: 2, name: "Ben" }, { id: 2, name: "Ben" }],
  });
  assert.equal(sent.employee, null);
  assert.deepEqual(sent.vehicleRoute, { id: ROUTE_ID, name: "2026-10-28_Truck_Ana" });
  assert.equal(sent.inventoryQuantity, 20, "one assignment quantity, not one per holder");
  assert.deepEqual(sent.inventoryHolders, {
    vehicle: { id: "veh-1", name: "Truck" },
    employees: [{ id: 1, name: "Ana" }, { id: 2, name: "Ben" }],
  });
  assert.equal("dispatchedTo" in sent, false);
  assert.equal("autoReconcile" in sent, false);
});

test("auto-reconcile is sent only for dispatched inventory with a quantity", async () => {
  const bodies = [];
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
    post: async (_url, body) => { bodies.push(body); return { success: true, data: { id: "journal-3" } }; },
  });
  const dispatched = {
    transactionType: "INVENTORY", inventoryDirection: "dispatched", inventoryItemId: "box", inventoryItemName: "Box",
    inventoryQuantity: 5, inventoryUnitPrice: 2, inventoryTotal: 10, amount: 10, refNumber: "", description: "",
    inventoryHolderEmployees: [{ id: 1, name: "Ana" }], autoReconcile: true,
  };
  await api.createDailyIncomeJournal(statement, dispatched);
  await api.createDailyIncomeJournal(statement, { ...dispatched, inventoryDirection: "received", inventorySupplierId: "sup-1" });
  await api.createDailyIncomeJournal(statement, { ...dispatched, inventoryQuantity: 0 });
  await api.createDailyIncomeJournal(statement, { transactionType: "PAYMENT", amount: 20, invoiceId: "inv-1", paymentMethodName: "CASH", refNumber: "", description: "", employeeId: 1, autoReconcile: true });
  assert.deepEqual(bodies.map((body) => body.autoReconcile ?? false), [true, false, false, false]);

  const { isAutoReconcileEligible, AUTO_RECONCILE_PERMISSION } = loadFeature("src/lib/accounting/daily-income/auto-reconcile.ts");
  assert.deepEqual(AUTO_RECONCILE_PERMISSION, { name: "canReconcileInventoryDispatch", resourceType: "inventory_dispatch" });
  assert.equal(isAutoReconcileEligible(dispatched), true);
  assert.equal(isAutoReconcileEligible({ ...dispatched, transactionType: "SALES" }), false);
});

test("validation requires a route supervisor and at least one inventory holder", () => {
  const { dailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts");
  const payment = { transactionType: "SALES", amount: 10, accountId: 1, paymentMethodId: 1, paymentMethodName: "CASH", refNumber: "", description: "", routeId: ROUTE_ID };
  const missingSupervisor = dailyIncomeJournalSchema.safeParse(payment);
  assert.equal(missingSupervisor.success, false);
  assert.ok(missingSupervisor.error.issues.some((issue) => issue.path[0] === "supervisorId"));
  assert.equal(dailyIncomeJournalSchema.safeParse({ ...payment, supervisorId: 1 }).success, true);
  assert.equal(dailyIncomeJournalSchema.safeParse({ ...payment, routeId: undefined }).success, true, "employee journals need no supervisor");

  const dispatch = { transactionType: "INVENTORY", inventoryDirection: "dispatched", inventoryItemId: "box", inventoryQuantity: 1, inventoryTotal: 5, refNumber: "", description: "", routeId: ROUTE_ID };
  const noHolders = dailyIncomeJournalSchema.safeParse(dispatch);
  assert.equal(noHolders.success, false);
  assert.ok(noHolders.error.issues.some((issue) => issue.path[0] === "inventoryHolderEmployees"));
  assert.equal(dailyIncomeJournalSchema.safeParse({ ...dispatch, inventoryHolderVehicleId: "veh-1" }).success, true, "a vehicle alone is a valid holder");
  assert.equal(dailyIncomeJournalSchema.safeParse({ ...dispatch, inventoryHolderEmployees: [{ id: 1, name: "Ana" }] }).success, true);
});

test("editing a route journal keeps the recorded supervisor and holders", async () => {
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {
    get: async () => ({
      data: {
        id: "journal-3", transactionType: "PAYMENT", transactionAmount: 15,
        vehicleRoute: { id: ROUTE_ID, name: "2026-10-28_Truck_Ana" },
        employee: { id: 1, name: "Ana" },
        dailyRoute: { id: ROUTE_ID, date: "2026-10-28T00:00:00Z", vehicle: { id: "veh-1", name: "Truck" }, supervisor: { id: 1, name: "Ana" }, driver: { id: 4, name: "Dee" }, helpers: [{ id: 2, name: "Ben" }] },
        inventoryHolders: { vehicle: { id: "veh-1", name: "Truck" }, employees: [{ id: 2, name: "Ben" }] },
      },
    }),
  });
  const { journalToFormValues } = loadFeature("src/lib/accounting/daily-income/journal-form.ts");
  const journal = await api.fetchDailyIncomeJournal("journal-3");
  assert.deepEqual(journal.employee, { id: 1, name: "Ana", code: undefined, displayName: undefined });
  assert.equal(journal.dailyRoute.date, "2026-10-28");
  assert.deepEqual(journal.dailyRoute.helpers, [{ id: 2, name: "Ben" }]);

  const values = journalToFormValues(journal);
  assert.equal(values.routeId, ROUTE_ID);
  assert.equal(values.employeeId, undefined);
  assert.equal(values.supervisorId, 1);
  assert.equal(values.supervisorName, "Ana");
  assert.equal(values.inventoryHolderVehicleId, "veh-1");
  assert.deepEqual(values.inventoryHolderEmployees, [{ id: 2, name: "Ben" }]);
});

test("route crew shortcut proposes the vehicle and crew as holders", () => {
  const { dailyRouteInventoryHolders } = loadFeature("src/lib/accounting/daily-income/inventory-change.ts");
  const holders = dailyRouteInventoryHolders(route([{ id: 1, name: "Ana", role: "supervisor" }, { id: 2, name: "Ben", role: "helper" }]));
  assert.deepEqual(holders, { vehicle: { id: "veh-1", name: "Truck" }, employees: [{ id: 1, name: "Ana" }, { id: 2, name: "Ben" }] });
});

for (const language of ["en", "es"]) {
  test(`${language}: accountability copy exists in the accounting catalog`, () => {
    const messages = JSON.parse(fs.readFileSync(path.join(root, `src/locales/${language}/accounting.json`), "utf8"));
    const form = messages.dailyIncome.form;
    for (const key of ["responsibleSupervisor", "inventoryHolders", "holderVehicle", "holderEmployees", "inventoryDailyRoute"]) assert.ok(form.fields[key], key);
    for (const key of ["supervisorRequired", "inventoryHoldersRequired"]) assert.ok(form.validation[key], key);
    for (const key of ["routeSupervisorAccountability", "inventoryHolders", "inventoryDailyRoute"]) assert.ok(form.hints[key], key);
    assert.ok(messages.financialActivity.dailyRoute);
  });
}
