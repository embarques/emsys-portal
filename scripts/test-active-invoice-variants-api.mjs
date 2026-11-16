#!/usr/bin/env node
/** Extends only tagged fixtures from active-branch evidence; no existing business data or deletes. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";
import { createPortalLoader, createHttpApiClient } from "./lib/portal-modules.mjs";
const suite = createApiSuite({ title: "Active NY invoice variants", options: {
  writeFixtures: { flag: "--write-fixtures" }, output: { flag: "--output", takesValue: true },
} });
const fixture = JSON.parse(fs.readFileSync("docs/backend-gap-active-ny-invoice-current-2026-11-14.json", "utf8"));
const spare = JSON.parse(fs.readFileSync("docs/backend-gap-active-ny-invoice-2026-11-14.json", "utf8"));
const marker = `CODEX-NY-VARIANTS-${randomUUID()}`, evidence = [], owned = [];
const invoiceId = String(fixture.owned.find(x => x.path === "/invoices").id);
const allowedInvoices = new Set([invoiceId]);
async function request(method, path, body, headers) {
  if (["DELETE", "PATCH"].includes(method)) throw Error("No delete/arbitrary patch allowed");
  if (method === "PUT" && ![...allowedInvoices].some(id => path === `/invoices/${id}`)) throw Error("Only owned mock invoices may be updated");
  const r = await suite.request(method, path, body, headers);
  evidence.push({ method, path, ...(body ? { body } : {}), http: r.status, response: r.json });
  return r;
}
async function read(path) { const r = await request("GET", path); if (!suite.ok(r)) throw Error(`${path}: HTTP ${r.status}`); return r.json.data; }
function check(label, condition) {
  evidence.push({ label, passed: Boolean(condition) });
  if (condition) suite.pass(label); else suite.fail(label, 0, "Persisted invariant failed");
}
async function step(label, run) {
  try { await run(); } catch (error) { evidence.push({ label, error: error.message, http: error.response?.status }); suite.fail(label, error.response?.status ?? 0, error.message); }
}
const load = createPortalLoader({ apiClient: createHttpApiClient(request) });
const api = load("src/lib/invoices/api/invoices-api.ts"), types = load("src/lib/invoices/types.ts");
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud || fixture.companyId !== suite.opts.companyId || !fixture.marker.startsWith("CODEX-NY-INVOICE-")) throw Error("Owned fixture opt-in/company control failed");
  const initial = await read(`/invoices/${invoiceId}`);
  if (initial.number !== fixture.marker) throw Error("Owned invoice marker mismatch");
  const branch = await read("/branches/1");
  const context = await read("/income-statements/context?branchId=1");
  if (!context.current?.id) throw Error("Current NY period required; no rollover in this runner");
  const container = { id: Number(initial.container.id), name: initial.container.name };
  await step("V10 daily-route receivedBy variant", async () => {
    const employeeId = spare.owned.find(x => x.path === "/employees").id;
    const vehicleId = spare.owned.find(x => x.path === "/vehicles").id;
    const employee = await read(`/employees/${employeeId}`), vehicle = await read(`/vehicles/${vehicleId}`);
    if (employee.name !== spare.marker || vehicle.name !== spare.marker) throw Error("Spare owned assets do not match their marker");
    const r = await request("POST", "/vehicle-routes", { date: context.today + "T00:00:00Z", routeType: "pickup",
      branch: { id: branch.id, name: branch.name, code: branch.code }, vehicle: { id: vehicle.id, name: vehicle.name },
      driver: { id: employee.id, name: employee.name }, supervisor: { id: employee.id, name: employee.name }, helpers: [],
      employees: [{ id: employee.id, name: employee.name, roles: ["driver", "supervisor"] }], active: true });
    if (!suite.ok(r) || !r.json.data?.id) throw Error(`Own pickup route create HTTP ${r.status}`);
    const route = r.json.data; owned.push({ path: "/vehicle-routes", id: route.id, retained: true });
    const invoice = await api.fetchInvoiceById(invoiceId);
    const beforeNumbers = invoice.lineItems.flatMap(i => i.barcodes ?? []).map(b => b.number).sort();
    await api.updateInvoice(invoiceId, types.invoiceToFormValues(invoice), { branch, container,
      pickupAssignment: { source: "route", dailyRoute: { id: String(route.id), name: route.name } } });
    const after = await read(`/invoices/${invoiceId}`);
    check("V10 explicit non-DR pickup-route receivedBy survives NY readback", String(after.receivedBy?.id) === String(route.id));
    check("V10 route receivedBy has no nested reusable crew", !after.receivedBy?.route?.id && !after.routeCrew?.id);
    const saved = await api.fetchInvoiceById(invoiceId);
    check("V10 receivedBy update preserves existing piece identities", JSON.stringify(saved.lineItems.flatMap(i => i.barcodes ?? []).map(b => b.number).sort()) === JSON.stringify(beforeNumbers));
  });
  await step("V10 unpaid registration completion", async () => {
    const journals = load("src/lib/accounting/daily-income/api.ts");
    const registrationKey = randomUUID();
    const record = { transactionType: "INITIAL-PAYMENT", invoiceNumber: marker, invoiceCost: 0.02,
      invoiceDiscount: 0, amount: 0, paymentMethodName: "CASH", description: marker };
    const registration = await journals.createDailyIncomeJournalSync(registrationKey,
      { ...context.current, branch, currency: "USD", rate: 1 }, record);
    const pendingId = String(registration.invoice?.id ?? "");
    if (!pendingId) throw Error("Unpaid registration did not return invoice ID");
    allowedInvoices.add(pendingId);
    owned.push({ path: "/journals", id: registration.id, retained: true }, { path: "/invoices", id: pendingId, retained: true });
    const pending = await read(`/invoices/${pendingId}`);
    check("V10 zero-payment registration is pending with no applied payment", pending.registration === "PENDING" && Number(pending.payment ?? 0) === 0);
    const base = types.invoiceToFormValues(await api.fetchInvoiceById(invoiceId));
    const values = { ...base, invoiceId: pendingId, version: pending.version, invoiceNumber: marker,
      date: context.today, amountPaid: "0", discount: "0",
      lineItems: [{ ...types.createEmptyInvoiceLineItem(), itemName: marker, quantity: "2", labelCount: "2", unitPrice: "0.01", lineTotal: "0.02" }] };
    const completed = await api.updateInvoice(pendingId, values, { branch, container,
      registeredInvoiceTotals: { cost: 0.02, payment: 0, balance: 0.02 } });
    const saved = await read(`/invoices/${pendingId}`);
    check("V10 unpaid completion preserves original invoice identity and number", completed.invoiceId === pendingId && saved.number === marker && saved.registration === "COMPLETED");
    check("V10 unpaid completion preserves authoritative zero payment and balance", saved.cost === 0.02 && Number(saved.payment ?? 0) === 0 && saved.balance === 0.02);
    check("V10 unpaid completion saves two pieces with configured NY default", saved.invoiceDetails?.flatMap(d => d.barcodes ?? []).length === 2 && saved.invoiceDetails.every(d => d.barcodes?.every(b => b.status?.id === branch.settings.defaultLabelStatus)));
    const replay = await journals.createDailyIncomeJournalSync(registrationKey,
      { ...context.current, branch, currency: "USD", rate: 1 }, record);
    check("V10 original unpaid registration replay keeps committed journal/invoice identities", replay.id === registration.id && String(replay.invoice?.id) === pendingId);
    const journal = await read(`/journals/${registration.id}`);
    check("V10 zero registration journal stays in current NY period", journal.branch?.id === 1 && journal.incomeStatement?.id === context.current.id);
  });
} catch (error) { evidence.push({ label: "Run stopped", error: error.message }); suite.fail("Active invoice variant prerequisites", 0, error.message); }
finally {
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({ checkedAt: new Date().toISOString(), companyId: suite.opts.companyId,
    marker, inputFixtureMarker: fixture.marker, owned, evidence,
    limitations: ["Only new/tagged mock invoices and routes changed; no deletions or rollover.", "Zero registration journal retained; no cash or bank payment collected.", "Assigned-only negatives, other-branch actors, branch 11 and bank initial-payment completion remain separate."] }, null, 2) + "\n");
}
suite.finish("Only completed variants can be removed from pending scope.");
