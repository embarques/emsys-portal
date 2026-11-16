#!/usr/bin/env node
/** Own unpaid invoice/pieces/routes in the existing NY branch; never rolls over a closeout. */
import fs from "node:fs";
import { randomUUID, randomInt } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";
import { createPortalLoader, createHttpApiClient } from "./lib/portal-modules.mjs";
const suite = createApiSuite({ title: "Active NY invoice controls", options: {
  writeFixtures: { flag: "--write-fixtures" }, output: { flag: "--output", takesValue: true },
} });
const marker = `CODEX-NY-INVOICE-${randomUUID()}`;
const evidence = [], owned = [];
let invoiceId;
async function request(method, path, body, headers) {
  if (["DELETE", "PATCH"].includes(method)) throw Error("No delete or arbitrary patch in this runner");
  if (method === "PUT" && path !== `/invoices/${invoiceId}`) throw Error("Refusing an update outside the owned invoice");
  const r = await suite.request(method, path, body, headers);
  evidence.push({ method, path, ...(body ? { body } : {}), http: r.status, response: r.json });
  if (method === "POST" && path === "/invoices" && suite.ok(r) && suite.extractId(r) != null) {
    invoiceId = String(suite.extractId(r));
    owned.push({ path: "/invoices", id: invoiceId, marker, retained: true });
  }
  if (r.status === 401) throw Error("Token rejected; stopped");
  return r;
}
async function read(path) {
  const r = await request("GET", path);
  if (!suite.ok(r)) throw Error(`${path}: HTTP ${r.status}`);
  return r.json.data;
}
function check(label, condition, detail) {
  evidence.push({ label, passed: Boolean(condition), ...(detail ? { detail } : {}) });
  if (condition) suite.pass(label); else suite.fail(label, 0, detail || "Persisted invariant failed");
}
async function create(path, body) {
  const r = await request("POST", path, body);
  const id = suite.extractId(r);
  if (suite.ok(r) && id != null) owned.push({ path, id, marker, retained: true });
  if (!suite.ok(r) || id == null) throw Error(`${path}: HTTP ${r.status}; ${suite.errDetail(r)}`);
  return r.json.data;
}
const load = createPortalLoader({ apiClient: createHttpApiClient(request) });
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) throw Error("Explicit --write-fixtures required");
  const actor = await read("/users/current");
  const branch = await read(`/branches/${actor.branch.id}`);
  if (branch.code !== "NY") throw Error("Expected existing active NY actor");
  const context = await read(`/income-statements/context?branchId=${branch.id}`);
  const invoicePeriod = context.current;
  if (!invoicePeriod?.id || !["open", "active"].includes(String(invoicePeriod.status).toLowerCase())) throw Error("No current NY invoice period; a stale open period was rejected by the live control. No rollover attempted");
  const date = String(invoicePeriod.businessDate ?? invoicePeriod.date).slice(0, 10);
  evidence.push({ label: "Existing open invoice-date period", id: invoicePeriod.id, date,
    explanation: "Ordinary unpaid digitization uses the existing current period; no period is opened/closed and no payment is posted." });
  const containerName = `${randomInt(800000, 999999)}-${new Date().getUTCFullYear().toString().slice(-2)}`;
  const container = await create("/containers", { name: containerName, booking: marker,
    containerNumber: marker, cost: 0, departureDate: new Date().toISOString(), arrivalDate: new Date().toISOString() });
  const employee = await create("/employees", { name: marker, active: true,
    branch: { id: branch.id, code: branch.code, name: branch.name } });
  const vehicle = await create("/vehicles", { name: marker, vehicleId: marker, licensePlate: marker.slice(-8),
    year: 2026, fuelType: "DIESEL", active: true, branch: { id: branch.id, code: branch.code } });
  const customerTypes = load("src/lib/customers/types.ts");
  const baseCustomer = customerTypes.createEmptyCustomerForm();
  const sender = { ...baseCustomer, name: marker, customerType: 1, branch,
    phones: [{ type: "mobile", number: `+1202${randomInt(1000000, 9999999)}`, isPrimary: true }],
    addresses: [{ ...baseCustomer.addresses[0], address1: "1 Mock Verification St", city: "Bronx", state: "NY", zipcode: "10451", country: "US", isPrimary: true }] };
  const types = load("src/lib/invoices/types.ts");
  const api = load("src/lib/invoices/api/invoices-api.ts");
  const values = { ...types.createEmptyInvoiceForm(), autoGenerateNumber: false, invoiceNumber: marker,
    date, sender, receiver: null, amountPaid: "0", discount: "0",
    lineItems: [{ ...types.createEmptyInvoiceLineItem(), itemName: marker, quantity: "2", labelCount: "2", unitPrice: "0.01", lineTotal: "0.02" }] };
  const invoice = await api.createInvoice(values, { branch, container: { id: container.id, name: container.name },
    pickupAssignment: { source: "warehouse", pickupEmployee: { id: employee.id, name: employee.name } } });
  invoiceId = invoice.invoiceId;
  if (!owned.some(r => r.path === "/invoices" && String(r.id) === invoiceId)) owned.push({ path: "/invoices", id: invoiceId, marker, retained: true });
  let live = await read(`/invoices/${invoiceId}`);
  if (live.sender?.id && live.sender?.name === marker) owned.push({ path: "/customers", id: live.sender.id, marker, retained: true });
  const pieces = live.invoiceDetails?.flatMap(d => d.barcodes ?? (d.barcode ? [d.barcode] : [])) ?? [];
  check("V10 ordinary unpaid NY invoice creation succeeds", !!invoiceId && Number(live.payment ?? 0) === 0);
  check("B16 configured NY default applies to every generated piece", pieces.length === 2 && pieces.every(p => p.status?.id === branch.settings?.defaultLabelStatus));
  evidence.push({ label: "Configured default readback", defaultLabelStatus: branch.settings?.defaultLabelStatus, pieces });
  check("V10 explicit employee receivedBy survives NY readback", String(live.receivedBy?.id ?? live.receivedBy?.employee?.id) === String(employee.id));
  const route = await create("/vehicle-routes", { date: context.today + "T00:00:00Z", routeType: "delivery",
    branch: { id: branch.id, name: branch.name, code: branch.code }, vehicle: { id: vehicle.id, name: vehicle.name },
    driver: { id: employee.id, name: employee.name }, supervisor: { id: employee.id, name: employee.name }, helpers: [],
    employees: [{ id: employee.id, name: employee.name, roles: ["driver", "supervisor"] }],
    container: { id: container.id, number: container.name }, rate: 1, active: true });
  if (!pieces[0]) throw Error("No owned piece for embedded lifecycle");
  const piece = pieces[0];
  const patch = { barcodeId: String(piece.barcodeId ?? piece.id), number: piece.number,
    status: { id: 6, name: "CONDUCE" }, route: { id: String(route.id), name: route.name },
    container: { id: container.id, name: container.name } };
  await api.patchInvoiceEmbeddedBarcodes(invoiceId, [patch]);
  live = await read(`/invoices/${invoiceId}`);
  const findPiece = r => r.invoiceDetails?.flatMap(d => d.barcodes ?? (d.barcode ? [d.barcode] : [])).find(p => p.number === piece.number);
  const assigned = findPiece(live);
  check("V07 own embedded assignment persists active NY route", String(assigned?.route?.id) === String(route.id));
  check("B16 embedded CONDUCE request survives configured NY readback", assigned?.status?.id === 6);
  evidence.push({ label: "Own NY assignment readback", piece: assigned });
  await api.patchInvoiceEmbeddedBarcodes(invoiceId, [{ ...patch, status: assigned?.status ?? piece.status, route: null }]);
  const removed = findPiece(await read(`/invoices/${invoiceId}`));
  check("V07 own NY embedded route null clears assignment", !removed?.route?.id);
  const catalog = await request("POST", "/barcodes/search", {
    filters: [{ field: "number", operator: "eq", value: piece.number }], pagination: { page: 1, limit: 2 } });
  check("V07 own NY embed/catalog route mirror agrees", suite.ok(catalog) && suite.rowsOf(catalog).length === 1 && !suite.rowsOf(catalog)[0]?.route?.id);
  evidence.push({ label: "V06 numeric assignment not sent", reason: "Reference bulk resolver matches invoice-local numeric IDs globally before owner checks. Cannot certify own-record resolution; no ambiguous ID mutation of existing merchandise was attempted." });
  const after = await read(`/income-statements/${invoicePeriod.id}`);
  check("Existing NY period lifecycle unchanged", after.status === invoicePeriod.status && after.id === invoicePeriod.id);
} catch (error) {
  evidence.push({ label: "Run stopped", error: error.message, http: error.response?.status });
  suite.fail("Active NY invoice controls", error.response?.status ?? 0, error.message);
} finally {
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({ checkedAt: new Date().toISOString(),
    companyId: suite.opts.companyId, marker, owned, evidence,
    limitations: ["All new mock records retained and tagged; no delete calls.", "No existing period opened, closed or reopened; no payment journal posted.", "Ordinary digitization is not unpaid financial-registration completion or linked financial deletion acceptance."] }, null, 2) + "\n");
}
suite.finish("Only successful own-record controls narrow the pending backlog.");
