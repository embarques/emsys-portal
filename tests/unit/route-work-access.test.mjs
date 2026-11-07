import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");

function load(relative, replacements = {}) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require", "module", "exports", source)((id) => {
    if (id in replacements) return replacements[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const permissions = load("src/lib/auth/permissions.ts");
const { PERMISSIONS, permissionIsGranted, permissionKey } = permissions;

function authFor(grants, extra = {}) {
  const keys = new Set(grants.map(([name, resourceType]) => permissionKey({ name, resourceType })));
  return {
    isAuthenticated: true,
    companyId: 1,
    user: { uid: "worker-1" },
    email: "worker@example.test",
    hasPermission: (name, resourceType) => permissionIsGranted({ name, resourceType }, keys),
    ...extra,
  };
}

function appointmentAccess(grants) {
  const { canView, canUpdate } = load("src/lib/orders/hooks/use-route-appointments-access.ts", {
    "@/lib/auth/permissions": permissions,
    "@/lib/auth/hooks/use-auth": { useAuth: () => authFor(grants) },
  }).useRouteAppointmentsAccess();
  return { canView, canUpdate };
}

function deliveryAccess(grants, { signedIn = true, companyId = 1 } = {}) {
  return load("src/lib/deliveries/hooks/use-deliver-invoice.ts", {
    "@/lib/auth/permissions": permissions,
    "@/lib/auth/hooks/use-auth": { useAuth: () => authFor(grants, { isAuthenticated: signedIn }) },
    "@/lib/store/hooks": { useAppSelector: (select) => select({ auth: { companyId } }) },
  }).useDeliveryAccess();
}

test("route appointments accept broad or assigned view, without promoting assigned access to broad access", () => {
  assert.deepEqual(appointmentAccess([["canViewPickup", "pickup"]]), { canView: true, canUpdate: false });
  assert.deepEqual(appointmentAccess([["canViewAssignedAppointments", "pickup"]]), { canView: true, canUpdate: false });
  assert.deepEqual(appointmentAccess([]), { canView: false, canUpdate: false });
  const assigned = authFor([["canViewAssignedAppointments", "pickup"]]);
  assert.equal(assigned.hasPermission(PERMISSIONS.pickupsView.name, PERMISSIONS.pickupsView.resourceType), false);
});

test("route appointment update grants are independent of read access", () => {
  for (const name of ["canUpdatePickup", "canUpdateAssignedAppointments"]) {
    assert.deepEqual(appointmentAccess([[name, "pickup"]]), { canView: false, canUpdate: true });
  }
});

test("route workspaces preserve the documented legacy view fallbacks", () => {
  for (const name of ["canViewRoute", "canViewVehicle", "canViewDispatch"]) {
    assert.equal(appointmentAccess([[name, "legacy"]]).canView, true);
  }
  assert.equal(deliveryAccess([["canViewInventory", "inventory"]]).canList, true);
});

test("route deliveries accept assigned view while keeping printing and completion separately gated", () => {
  for (const name of ["canViewDelivery", "canViewAssignedDeliveries"]) {
    const access = deliveryAccess([[name, "delivery"]]);
    assert.equal(access.canList, true);
    assert.equal(access.canPrint, false);
    assert.equal(access.canDeliver, false);
  }
  const assigned = authFor([["canViewAssignedDeliveries", "delivery"]]);
  assert.equal(assigned.hasPermission(PERMISSIONS.deliveriesView.name, PERMISSIONS.deliveriesView.resourceType), false);
});

test("assigned delivery completion still requires invoice read and update; printing requires its own grant", () => {
  const grants = [["canViewAssignedDeliveries", "delivery"], ["canUpdateAssignedDeliveries", "delivery"]];
  assert.equal(deliveryAccess(grants).canDeliver, false);
  assert.equal(deliveryAccess([...grants, ["canViewInvoice", "invoice"]]).canDeliver, false);
  const complete = [...grants, ["canViewInvoice", "invoice"], ["canUpdateInvoice", "invoice"]];
  assert.equal(deliveryAccess(complete).canDeliver, true);
  assert.equal(deliveryAccess(complete).canPrint, false);
  assert.equal(deliveryAccess([...complete, ["canPrintInvoice", "invoice"]]).canPrint, true);
  assert.equal(deliveryAccess(complete, { signedIn: false }).canDeliver, false);
  assert.equal(deliveryAccess(complete, { companyId: null }).canDeliver, false);
});

test("barcode delivery requires a pending piece, linked invoice, and positive numeric delivery", () => {
  const { canStartBarcodeDelivery } = load("src/lib/deliveries/utils/can-start-barcode-delivery.ts");
  const barcode = { invoiceId: "invoice-1", delivery: { id: 10 }, status: { id: 6, name: "CONDUCE" } };
  assert.equal(canStartBarcodeDelivery(barcode), true);
  assert.equal(canStartBarcodeDelivery({ ...barcode, status: { name: " conduce " } }), true);
  for (const patch of [
    { invoiceId: "" }, { invoiceId: " " }, { delivery: null }, { delivery: { id: 0 } },
    { delivery: { id: -1 } }, { delivery: { id: 1.5 } }, { delivery: { id: Infinity } },
    { status: null }, { status: { id: 7, name: "ENTREGADO" } },
    { status: { id: 1, name: "CONDUCE" } },
  ]) assert.equal(canStartBarcodeDelivery({ ...barcode, ...patch }), false);
  assert.equal(canStartBarcodeDelivery(null), false);
});

test("appointment lists separate company, actor, permission scope and workspace caches", async () => {
  const params = { page: 2, limit: 40, sort: "date:desc" };
  let auth = authFor([["canViewPickup", "pickup"]]);
  const calls = [];
  const { useOrders } = load("src/lib/orders/hooks/use-orders.ts", {
    "@tanstack/react-query": {},
    "@/lib/query/use-workspace-query": { useWorkspaceQuery: (options) => options },
    "@/lib/auth/hooks/use-auth": { useAuth: () => auth },
    "@/lib/orders/api/orders-api": { fetchOrders: async (input) => { calls.push(input); return { items: [], total: 0 }; } },
    "@/lib/orders/order-stats": {},
    "@/lib/insights/hooks/use-insights-kpis": {},
    "@/lib/orders/types": {},
    "@/lib/query/query-keys": { queryKeys: { orders: { list: (input) => ["orders", "list", input] } } },
    "@/lib/store/hooks": { useAppSelector: (select) => select({ auth: { idToken: "test-token", companyId: auth.companyId } }) },
  });
  const ordinary = useOrders(params);
  const broad = useOrders(params, { routeMode: true });
  assert.notDeepEqual(ordinary.queryKey, broad.queryKey);
  assert.equal(broad.enabled, true);
  await broad.queryFn();
  assert.deepEqual(calls, [params], "The API owns assignment scope; no inferred employee or client filter changes the request");

  auth = authFor([["canViewAssignedAppointments", "pickup"]]);
  const assigned = useOrders(params, { routeMode: true });
  assert.notDeepEqual(assigned.queryKey, broad.queryKey);
  auth = { ...auth, companyId: 2 };
  const otherCompany = useOrders(params, { routeMode: true });
  assert.notDeepEqual(otherCompany.queryKey, assigned.queryKey);
  auth = { ...auth, user: { uid: "worker-2" } };
  assert.notDeepEqual(useOrders(params, { routeMode: true }).queryKey, otherCompany.queryKey);
  assert.equal(useOrders(params, { routeMode: true, enabled: false }).enabled, false);
});
