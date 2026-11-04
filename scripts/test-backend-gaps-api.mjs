#!/usr/bin/env node
/**
 * Reports which backend/API gaps tracked in `docs/backend-api-gaps.md` are live.
 *
 * Read-only by default. Besides GET/search requests it only sends requests the
 * API must reject before writing anything: unknown (all-zero) IDs, empty
 * payloads, or a missing If-Match. Behavior that can only be proven with a real
 * write is reported UNVERIFIED.
 *
 * --writes posts $1-scale journals tagged `ZZ_GAP_PROBE` in today's open
 * closeout and reverses each one. Only use it in a company whose data may be
 * changed (mock or non-production data).
 *
 * Usage:
 *   node scripts/test-backend-gaps-api.mjs '<jwt>' [--bearer] [--writes] [--company <id>] [--base-url <url>]
 *   EMSYS_TOKEN='<jwt>' npm run test:api:backend-gaps
 *
 * Statuses: DONE, PARTIAL, MISSING, UNVERIFIED. Exit code is 1 only when the
 * token is rejected; missing backend work is reported, not treated as a failure.
 */
import { randomUUID } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";

const suite = createApiSuite({
  title: "Backend/API gap verification",
  usage: "  --writes           Post and reverse tagged $1 journals (mock/non-production data only)\n",
  options: { writes: { env: "EMSYS_GAP_WRITES", flag: "--writes" } },
});
const { request, opts } = suite;
opts.skipCrud = true;

const ZERO_OBJECT_ID = "000000000000000000000000";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const CRUD_FLAGS = ["list", "view", "create", "update", "delete", "print", "open"];

suite.banner([`Mode:     ${opts.writes ? "writes enabled (tagged journals, reversed)" : "read-only (rejected-request probes only)"}`]);

const results = [];
function record(doc, item, status, evidence) {
  results.push({ doc, item, status, evidence });
}

const message = (res) => `${res.json?.message ?? ""} ${res.json?.error ?? ""}`.trim();
const isRouteMissing = (res) => res.status === 404 && /route not found/i.test(message(res));
const rows = (res) => (Array.isArray(res.json?.data) ? res.json.data : []);

async function routeExists(method, path, body) {
  const res = await request(method, path, body);
  if (res.status === 401) {
    console.log("Token rejected (401). Refresh the temporary token and try again.");
    process.exit(1);
  }
  return { exists: !isRouteMissing(res), res };
}

async function search(path, filters, query = "page=1&limit=1&sort=createdAt:desc") {
  return request("POST", `${path}/search?${query}`, { filters });
}

async function listAll(path) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await request("GET", `${path}?page=${page}&limit=100`);
    const pageRows = rows(res);
    all.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return all;
}

const auth = await request("GET", "/users/current");
if (auth.status === 401 || auth.status === 403) {
  console.log(`GET /users/current — HTTP ${auth.status} ${message(auth)}`);
  console.log("Token rejected. Refresh the temporary token and try again.");
  process.exit(1);
}
const currentUser = auth.json?.data ?? {};
const catalog = await listAll("/permissions");
const catalogByName = new Map(catalog.map((permission) => [permission.name, permission]));
const roles = await listAll("/roles");
const roleNames = (role) => new Set((role.permissions ?? []).map((permission) => permission.name));
const adminRoles = roles.filter((role) => /^admin/i.test(role.name ?? ""));

function seeded(names) {
  const missing = names.filter((name) => !catalogByName.has(name));
  return { missing, present: names.filter((name) => catalogByName.has(name)) };
}

function seedRecord(doc, item, names) {
  const { missing } = seeded(names);
  record(doc, item, missing.length === 0 ? "DONE" : missing.length === names.length ? "MISSING" : "PARTIAL",
    missing.length ? `not in GET /permissions catalog: ${missing.join(", ")}` : `catalog has ${names.join(", ")}`);
}

// --- Reconciliation permissions -------------------------------------------
{
  const doc = "reconciliation-permissions-api-todo.md";
  const grants = [
    ["canReconcileJournal", "journal"],
    ["canReconcileInventoryDispatch", "inventory_dispatch"],
  ];
  for (const [name, resourceType] of grants) {
    const entry = catalogByName.get(name);
    if (!entry) record(doc, `${name} seeded in catalog`, "MISSING", "not in GET /permissions");
    else {
      const flags = CRUD_FLAGS.filter((flag) => flag in entry);
      const typeOk = entry.resourceType === resourceType;
      record(doc, `${name} seeded in catalog`, flags.length === 0 && typeOk ? "DONE" : "PARTIAL",
        `resourceType=${entry.resourceType}${flags.length ? `; carries CRUD flags: ${flags.join(", ")}` : "; no CRUD flags"}`);
    }
    const holders = roles.filter((role) => roleNames(role).has(name)).map((role) => role.name);
    const adminHas = adminRoles.length > 0 && adminRoles.every((role) => roleNames(role).has(name));
    const others = holders.filter((roleName) => !/^admin/i.test(roleName));
    record(doc, `${name} granted to admin role only`, adminHas && others.length === 0 ? "DONE" : adminHas ? "PARTIAL" : "MISSING",
      `admin roles: ${adminRoles.map((role) => role.name).join(", ") || "none found"}; holders: ${holders.join(", ") || "none"}`);
  }

  const reconcile = await routeExists("POST", "/journals/reconcile", { ids: [] });
  record(doc, "POST /journals/reconcile enforces canReconcileJournal", !reconcile.exists ? "MISSING"
    : reconcile.res.status === 403 && /canReconcileJournal/.test(message(reconcile.res)) ? "DONE" : "UNVERIFIED",
  `HTTP ${reconcile.res.status} ${message(reconcile.res).slice(0, 120)}${reconcile.res.status !== 403 ? " (caller holds the grant; retest with a user without it)" : ""}`);

  const dispatch = await routeExists("POST", `/inventory/dispatches/${ZERO_UUID}/reconciliations`, {});
  record(doc, "POST /inventory/dispatches/{id}/reconciliations enforces canReconcileInventoryDispatch", !dispatch.exists ? "MISSING"
    : dispatch.res.status === 403 && /canReconcileInventoryDispatch/.test(message(dispatch.res)) ? "DONE" : "UNVERIFIED",
  `HTTP ${dispatch.res.status} ${message(dispatch.res).slice(0, 120)}`);

  if (!opts.writes) {
    record(doc, "Journal create autoClear / inventory autoReconcile require the grants", "UNVERIFIED", "requires a journal create; rerun with --writes");
  }
}

// --- Pending Transactions / journal reconciliation ---------------------------
{
  const doc = "pending-transactions-update.md";
  const outstanding = { field: "reconciliationStatus", operator: "eq", value: "OUTSTANDING" };
  const sample = await search("/journals", [outstanding]);
  const row = rows(sample)[0];
  const fields = ["reconciliationStatus", "reconciledAt", "reconciledBy", "autoReconciled"];
  const missingFields = row ? fields.filter((field) => !(field in row)) : fields;
  record(doc, "Journal reconciliation fields on search rows", sample.status !== 200 ? "MISSING" : !row ? "UNVERIFIED" : missingFields.length ? "PARTIAL" : "DONE",
    sample.status !== 200 ? `HTTP ${sample.status} ${message(sample)}` : row ? (missingFields.length ? `missing: ${missingFields.join(", ")}` : fields.join(", ")) : "no Outstanding journals to inspect");

  const filterProbes = [
    ["invoice.number", "eq", "0"], ["transactionType", "neq", "X"], ["incomeStatement.id", "eq", 1],
    ["date", "gte", "2026-01-01"], ["createdBy.name", "contains", "a"], ["accounts.name", "contains", "a"],
    ["invoice.cost", "gte", 0], ["invoice.payment", "gte", 0], ["invoice.balance", "gte", 0],
    ["transactionAmount", "gte", 0], ["employee.name", "contains", "a"], ["employee.id", "eq", 1],
    ["paymentMethod.name", "eq", "CASH"], ["paymentReference", "startsWith", "0"],
    ["external_reference_number", "contains", "1"], ["refNumber", "startsWith", "T"], ["branch.id", "eq", 1],
    ["reconciliationStatus", "neq", "RECONCILED"],
  ];
  const rejected = [];
  for (const [field, operator, value] of filterProbes) {
    const res = await search("/journals", [outstanding, { field, operator, value }]);
    if (res.status !== 200) rejected.push(`${field} (${res.status})`);
  }
  record(doc, "Journal search advanced-filter allowlist", rejected.length ? "PARTIAL" : "DONE",
    rejected.length ? `rejected: ${rejected.join(", ")}` : `${filterProbes.length} portal filters accepted`);

  const summary = await request("POST", "/journals/summary", { filters: [outstanding] });
  const currencies = Array.isArray(summary.json?.data) ? summary.json.data : null;
  record(doc, "POST /journals/summary per-currency totals", isRouteMissing(summary) ? "MISSING" : summary.status === 200 && currencies ? "DONE" : "PARTIAL",
    `HTTP ${summary.status}${currencies ? ` currencies=${currencies.map((entry) => entry.currency || "(blank)").join(",")}` : ` ${message(summary)}`}`);

  const reverse = await routeExists("GET", `/journals/${ZERO_OBJECT_ID}/reverse`);
  record(doc, "POST /journals/{id}/reverse route", reverse.exists ? "DONE" : "MISSING", `GET probe HTTP ${reverse.res.status}`);

  const payments = await search("/journals", [{ field: "transactionType", operator: "eq", value: "PAYMENT" }]);
  const stored = await Promise.all(["OUTSTANDING", "RECONCILED"].map((value) =>
    search("/journals", [{ field: "transactionType", operator: "eq", value: "PAYMENT" }, { field: "reconciliationStatus", operator: "eq", value }])));
  const totalPayments = Number(payments.json?.total ?? 0);
  const classified = stored.reduce((sum, res) => sum + Number(res.json?.total ?? 0), 0);
  record(doc, "Reconciliation status backfilled on existing journals", totalPayments && classified >= totalPayments ? "DONE" : "MISSING",
    `PAYMENT journals=${totalPayments}; with stored OUTSTANDING/RECONCILED=${classified}`);

  seedRecord(doc, "canListJournal seeded (portal list gate)", ["canListJournal"]);

  if (!opts.writes) record(doc, "Non-cash payments apply to the invoice on create", "UNVERIFIED", "requires a payment create; rerun with --writes");
}

// --- Payment accounts --------------------------------------------------------
{
  const doc = "payment-accounts-api-contract.md";
  const banks = rows(await request("POST", "/chart-accounts/search?page=1&limit=100", { filters: [{ field: "type", operator: "eq", value: "BANK" }] }));
  const umbrella = banks.find((account) => account.systemAccount === true && !account.parentAccount);
  record(doc, "1. Default BANK system account seeded", umbrella ? "DONE" : "MISSING",
    umbrella ? `id=${umbrella.id} name=${umbrella.name}` : `BANK accounts: ${banks.map((account) => account.name).join(", ") || "none"}; none is a top-level systemAccount`);

  const methods = rows(await request("GET", "/accounting/paymentmethods")).map((method) => method.name);
  const missingMethods = ["DEBIT-CARD", "WIRE"].filter((name) => !methods.includes(name));
  record(doc, "3. DEBIT-CARD and WIRE payment methods", missingMethods.length ? "MISSING" : "DONE", `catalog: ${methods.join(", ")}`);

  const initial = rows(await search("/journals", [
    { field: "transactionType", operator: "eq", value: "INITIAL-PAYMENT" },
    { field: "createdAt", operator: "gte", value: new Date(Date.now() - 14 * 86_400_000).toISOString() },
  ], "page=1&limit=20&sort=createdAt:desc"));
  const generated = initial.filter((journal) => /^TXN-/.test(journal.refNumber ?? "") && journal.invoice?.number);
  const defaulted = initial.filter((journal) => journal.invoice?.number && journal.refNumber === journal.invoice.number);
  record(doc, "5. INITIAL-PAYMENT refNumber defaults to invoice number",
    !initial.length ? "UNVERIFIED" : defaulted.length && !generated.length ? "DONE" : generated.length ? "MISSING" : "UNVERIFIED",
    `last 14 days: ${initial.length} INITIAL-PAYMENT, ${generated.length} with generated TXN-… refs, ${defaulted.length} equal to invoice number`);

  if (!opts.writes) {
    record(doc, "2/4/6. Cash account on income, expenses by any method, duplicate-payment code", "UNVERIFIED", "requires journal creates; rerun with --writes");
  }
}

// --- Invoice policies --------------------------------------------------------
{
  const doc = "invoice-policies-api-todo.md";
  seedRecord(doc, "Permissions seeded", ["canListInvoicePolicy", "canViewInvoicePolicy", "canCreateInvoicePolicy", "canUpdateInvoicePolicy", "canDeleteInvoicePolicy"]);
  const list = await request("GET", "/invoice-policies?page=1&limit=1");
  const active = await request("GET", "/invoice-policies/active");
  record(doc, "List and active endpoints", list.status === 200 && active.status === 200 ? "DONE" : "MISSING", `list HTTP ${list.status}; active HTTP ${active.status}`);
}

// --- Assigned invoices -------------------------------------------------------
{
  const doc = "assigned-invoice-api-contract.md";
  seedRecord(doc, "canCreateAssignedInvoice seeded", ["canCreateAssignedInvoice"]);
  const userId = Number(currentUser.id ?? 0);
  const employees = await search("/employees", [{ field: "user.id", operator: "eq", value: userId }], "page=1&limit=1");
  record(doc, "Employee search accepts user.id", employees.status === 200 ? "DONE" : "MISSING", `HTTP ${employees.status} ${employees.status !== 200 ? message(employees) : ""}`);
  record(doc, "Server validates assigned-invoice payload against the appointment", "UNVERIFIED", "requires an invoice create");
}

// --- Delivery completion -----------------------------------------------------
{
  const doc = "delivery-completion-api-contract.md";
  const assigned = await request("GET", "/deliveries/assigned-barcodes?page=1&limit=1");
  const deliveryRow = rows(assigned)[0];
  if (!deliveryRow) record(doc, "Assigned barcode row enrichment", assigned.status === 200 ? "UNVERIFIED" : "MISSING", `HTTP ${assigned.status}; no rows`);
  else {
    const gaps = [];
    if (typeof deliveryRow.invoice?.balance !== "number") gaps.push("invoice.balance");
    if (!deliveryRow.sender || !("phones" in deliveryRow.sender)) gaps.push("sender{name,phones}");
    if (typeof deliveryRow.route?.rate !== "number") gaps.push("route.rate");
    record(doc, "Assigned barcode row enrichment (balance, sender, route rate)", gaps.length ? "PARTIAL" : "DONE", gaps.length ? `missing: ${gaps.join(", ")}` : "invoice.balance, sender, route.rate present");
  }
  const complete = await routeExists("GET", `/deliveries/1/invoices/${ZERO_OBJECT_ID}/complete`);
  record(doc, "Completion route", complete.exists ? "DONE" : "MISSING", `GET probe HTTP ${complete.res.status}`);
  record(doc, "Server enforces zero balance on completion", "UNVERIFIED", "requires a completion attempt on a non-production invoice with a balance");
}

// --- Daily route accountability ----------------------------------------------
{
  const doc = "daily-route-accountability.md";
  const routed = rows(await search("/journals", [
    { field: "vehicleRoute.id", operator: "neq", value: ZERO_OBJECT_ID },
    { field: "createdAt", operator: "gte", value: new Date(Date.now() - 30 * 86_400_000).toISOString() },
  ], "page=1&limit=20&sort=createdAt:desc")).filter((journal) => journal.vehicleRoute?.id);
  const snapshot = routed.find((journal) => journal.dailyRoute?.supervisor);
  record(doc, "Route journals return employee (supervisor) and dailyRoute snapshot", !routed.length ? "UNVERIFIED" : snapshot && snapshot.employee ? "DONE" : "PARTIAL",
    routed.length ? `${routed.length} recent route journals; snapshot keys: ${snapshot ? Object.keys(snapshot.dailyRoute).join(", ") : "none"}` : "no route journals in the last 30 days");
  const inventory = rows(await search("/journals", [{ field: "transactionType", operator: "eq", value: "INVENTORY" }], "page=1&limit=20&sort=createdAt:desc"))
    .filter((journal) => journal.inventoryDirection === "dispatched");
  record(doc, "Dispatched INVENTORY journals return inventoryHolders", !inventory.length ? "UNVERIFIED" : inventory.some((journal) => journal.inventoryHolders) ? "DONE" : "MISSING",
    inventory.length ? `${inventory.length} dispatched sampled` : "no dispatched INVENTORY journals to inspect");
}

// --- Predefined routes -------------------------------------------------------
{
  const doc = "predefined-routes.md";
  seedRecord(doc, "Permissions seeded", ["canViewPredefinedRoute", "canCreatePredefinedRoute", "canUpdatePredefinedRoute", "canDeletePredefinedRoute"]);
  const catalogRes = await request("GET", "/predefined-routes?page=1&limit=1");
  record(doc, "Catalog endpoint", catalogRes.status === 200 ? "DONE" : "MISSING", `HTTP ${catalogRes.status}`);
  const pickups = await request("POST", "/pickups/search?page=1&limit=1", { operator: "and", filters: [{ field: "predefinedRoute.id", operator: "eq", value: 1 }] });
  record(doc, "Pickup search accepts predefinedRoute.id", pickups.status === 200 ? "DONE" : "MISSING", `HTTP ${pickups.status}`);
  const legacy = await routeExists("GET", "/legacy-routes");
  record(doc, "Legacy routes API removed", legacy.exists ? "PARTIAL" : "DONE", `HTTP ${legacy.res.status}`);
}

// --- Transaction-triggered closeouts -----------------------------------------
{
  const doc = "transaction-triggered-closeouts.md";
  const branchId = Number(currentUser.branch?.id ?? currentUser.branchId ?? 1);
  const current = await request("GET", `/income-statements/current?branchId=${branchId}`);
  const closeout = current.json?.data;
  record(doc, "Current closeout lookup returns server date and timezone", current.status === 200 && closeout?.timezone ? "DONE" : "PARTIAL",
    `HTTP ${current.status}${closeout ? ` status=${closeout.status} timezone=${closeout.timezone}` : ` ${message(current)}`}`);
  record(doc, "409 CLOSEOUT_REQUIRED on journal create", "UNVERIFIED", "requires a journal create against a stale/closed closeout");
}

// --- Closeout transaction edits ----------------------------------------------
{
  const doc = "closeout-transaction-edits.md";
  const grant = catalog.find((permission) => permission.name === "canUpdateJournal")
    ?? catalog.find((permission) => permission.resourceType === "journal" && permission.update === true);
  record(doc, "canUpdateJournal in the permission catalog", grant ? "DONE" : "MISSING",
    grant ? `${grant.name ?? "journal update flag"} (${grant.resourceType})` : "not in GET /permissions");
  const put = await routeExists("PUT", `/journals/${ZERO_OBJECT_ID}`, {});
  record(doc, "PUT /journals/{id} route", put.exists ? "DONE" : "MISSING",
    `unknown id with empty body HTTP ${put.res.status} ${message(put.res).slice(0, 100)}`);
  if (!opts.writes) record(doc, "Edit an Outstanding journal in the current open closeout", "UNVERIFIED", "requires a journal create + update; rerun with --writes");
  record(doc, "Edits rejected for closed closeouts, reconciled and reversed journals", "UNVERIFIED",
    "needs a disposable journal in each state; do not probe real historical journals");
}

// --- Inventory dispatch workflows --------------------------------------------
{
  const doc = "inventory-dispatch-workflows.md";
  seedRecord(doc, "Confirmation and reconcile permissions seeded", ["canConfirmInventoryWarehouse", "canConfirmInventoryCustodian", "canReconcileInventoryDispatch"]);
  const expected = ["confirmations", "allowedActions", "rejection"];
  for (const [label, path] of [["Dispatch", "/inventory/dispatches"], ["Receipt", "/inventory/receipts"]]) {
    const documents = rows(await request("GET", `${path}?page=1&limit=20`));
    const document = documents[0];
    const missing = document ? expected.filter((field) => !(field in document)) : expected;
    const submitted = documents.find((entry) => entry.status === "PENDING_CONFIRMATION");
    const submittedNote = submitted
      ? `; PENDING_CONFIRMATION record has submittedAt=${Boolean(submitted.submittedAt)} submittedBy=${Boolean(submitted.submittedBy)}`
      : "; no PENDING_CONFIRMATION record sampled";
    record(doc, `${label} confirmation fields`, !document ? "UNVERIFIED" : missing.length === 0 ? "DONE" : missing.length < expected.length ? "PARTIAL" : "MISSING",
      document ? `${missing.length ? `missing: ${missing.join(", ")}` : expected.join(", ")}${submittedNote}` : "no records");
  }
  const commandRoutes = [
    ["Receipt confirm/reject", [`/inventory/receipts/${ZERO_UUID}/confirm`, `/inventory/receipts/${ZERO_UUID}/reject`]],
    ["Dispatch confirm/reject", [`/inventory/dispatches/${ZERO_UUID}/confirm`, `/inventory/dispatches/${ZERO_UUID}/reject`]],
    ["Pending dispatches search", ["/inventory/pending-dispatches/search"]],
    ["Reconciliation history", [`/inventory/dispatches/${ZERO_UUID}/reconciliations`]],
    ["Reconciliation confirm/reject", [`/inventory/dispatches/${ZERO_UUID}/reconciliations/${ZERO_UUID}/confirm`, `/inventory/dispatches/${ZERO_UUID}/reconciliations/${ZERO_UUID}/reject`]],
  ];
  for (const [label, paths] of commandRoutes) {
    const probes = await Promise.all(paths.map((path) => routeExists("GET", path)));
    const missing = paths.filter((_, index) => !probes[index].exists);
    record(doc, `${label} routes`, missing.length === 0 ? "DONE" : missing.length === paths.length ? "MISSING" : "PARTIAL",
      missing.length ? `not routed: ${missing.join(", ")}` : probes.map((probe) => probe.res.status).join("/"));
  }
  record(doc, "Two-party confirmation, income journals, credit sales, autoReconcile", "UNVERIFIED", "requires posting inventory documents in a non-production company");
}

// --- Stale update protection -------------------------------------------------
{
  const doc = "stale-update-protection.md";
  for (const [label, path] of [["Invoice", "/invoices"], ["Customer", "/customers"]]) {
    const version = rows(await request("GET", `${path}?page=1&limit=1`))[0]?.version;
    const put = await request("PUT", `${path}/${ZERO_OBJECT_ID}`, {});
    const versionOk = /^v1:[0-9a-f]{64}$/.test(String(version ?? ""));
    record(doc, `${label} versions and If-Match enforcement`, versionOk && put.status === 428 ? "DONE" : versionOk || put.status === 428 ? "PARTIAL" : "MISSING",
      `version ${versionOk ? "v1:<64 hex>" : JSON.stringify(version)}; PUT without If-Match HTTP ${put.status} ${put.json?.message ?? ""}`);
  }
}

// --- OpenAPI parity ----------------------------------------------------------
{
  const doc = "backend-api-gaps.md";
  const swaggerUrl = `${new URL(opts.baseUrl).origin}/swagger/doc.json`;
  try {
    const response = await fetch(swaggerUrl);
    const spec = await response.json();
    const paths = Object.keys(spec.paths ?? {});
    const live = [
      "/journals/reconcile", "/journals/summary", "/journals/{id}/reverse", "/financial-activity",
      "/predefined-routes", "/deliveries/assigned-barcodes", "/inventory/pending-dispatches/search",
      "/inventory/dispatches/{id}/reconciliations",
    ];
    const undocumented = live.filter((path) => !paths.includes(path));
    record(doc, "Published Swagger documents live routes", undocumented.length ? "MISSING" : "DONE",
      `${paths.length} paths at ${swaggerUrl}${undocumented.length ? `; undocumented: ${undocumented.join(", ")}` : ""}`);
  } catch (error) {
    record(doc, "Published Swagger documents live routes", "UNVERIFIED", `could not load ${swaggerUrl}: ${error.message}`);
  }
}

// --- Write probes (--writes) -------------------------------------------------
if (opts.writes) {
  const tag = `ZZ_GAP_PROBE ${new Date().toISOString()}`;
  const branchId = Number(currentUser.branch?.id ?? 0);
  const closeout = (await request("GET", `/income-statements/current?branchId=${branchId}`)).json?.data;
  const userPermissions = new Set(((await request("GET", "/users/permissions")).json?.data?.permissions ?? []).map((permission) => permission.name));
  const methods = rows(await request("GET", "/accounting/paymentmethods"));
  const method = (name) => methods.find((entry) => entry.name === name);
  const accounts = rows(await request("POST", "/chart-accounts/search?page=1&limit=100", { filters: [] }));
  const lookup = (account) => account && { id: account.id, name: account.name, type: account.type };
  const bank = accounts.find((account) => account.type === "BANK");
  const expense = accounts.find((account) => account.type === "EXPENSE");
  const altCash = accounts.find((account) => account.type === "ASSET" && !/cash on hand/i.test(account.name ?? ""));
  const invoice = rows(await request("POST", "/invoices/search?page=1&limit=20&sort=createdAt:desc", {
    filters: [{ field: "balance", operator: "gte", value: 5 }],
  })).find((entry) => Number(entry.branch?.id ?? branchId) === branchId);

  const reverse = (id) => request("POST", `/journals/${id}/reverse`, { requestId: randomUUID(), reason: `${tag} cleanup` });
  async function post(label, body) {
    const res = await request("POST", "/journals", {
      branch: { id: branchId }, currency: closeout.currency ?? "USD", rate: closeout.rate ?? 1, description: `${tag} ${label}`, ...body,
    });
    const journal = res.json?.data && !Array.isArray(res.json.data) ? res.json.data : null;
    return { res, journal };
  }
  async function cleanup(journal) {
    if (!journal?.id) return;
    const res = await reverse(journal.id);
    if (res.status >= 300) console.log(`  [CLEANUP] reverse ${journal.id} failed: HTTP ${res.status} ${message(res)}`);
  }
  async function invoiceTotals() {
    const data = (await request("GET", `/invoices/${invoice.id}`)).json?.data ?? {};
    return { payment: Number(data.payment ?? 0), balance: Number(data.balance ?? 0) };
  }
  const debitName = (journal) => journal?.accounts?.find((line) => Number(line.debit) > 0)?.name;
  const creditName = (journal) => journal?.accounts?.find((line) => Number(line.credit) > 0)?.name;

  if (!closeout?.id || closeout.status !== "open" || !invoice || !bank || !method("CASH") || !method("ZELLE")) {
    record("backend-api-gaps.md", "Write probes", "UNVERIFIED",
      `missing fixture: open closeout=${Boolean(closeout?.id)}, invoice with balance=${Boolean(invoice)}, bank=${Boolean(bank)}, CASH/ZELLE methods=${Boolean(method("CASH") && method("ZELLE"))}`);
  } else {
    const cash = { paymentMethod: method("CASH"), invoiceId: invoice.id, transactionType: "PAYMENT" };

    {
      const doc = "reconciliation-permissions-api-todo.md";
      const holds = userPermissions.has("canReconcileJournal");
      const { res, journal } = await post("autoClear", { ...cash, amount: 1.07, allowDuplicatePayment: true, autoClear: true });
      record(doc, "Journal create with autoClear requires canReconcileJournal",
        holds ? (journal?.reconciliationStatus === "RECONCILED" ? "DONE" : "PARTIAL") : res.status === 403 && !journal ? "DONE" : "MISSING",
        `caller ${holds ? "holds" : "lacks"} the grant; HTTP ${res.status} ${journal ? `created ${journal.reconciliationStatus}` : message(res).slice(0, 100)}`);
      await cleanup(journal);

      const inventoryHolds = userPermissions.has("canReconcileInventoryDispatch");
      const inventory = await post("autoReconcile", {
        transactionType: "INVENTORY", amount: 1, paymentMethod: method("CASH"), employee: null, autoReconcile: true,
        inventoryDirection: "dispatched", inventoryItemId: ZERO_UUID, inventoryQuantity: 1, inventoryUnitPrice: 1, inventoryTotal: 1,
        inventoryHolders: { employees: [{ id: 1, name: "probe" }] },
      });
      record(doc, "Inventory journal autoReconcile requires canReconcileInventoryDispatch",
        inventoryHolds ? "UNVERIFIED" : inventory.res.status === 403 ? "DONE" : inventory.journal ? "MISSING" : "UNVERIFIED",
        `caller ${inventoryHolds ? "holds" : "lacks"} the grant; HTTP ${inventory.res.status} ${message(inventory.res).slice(0, 100)}`);
      await cleanup(inventory.journal);
    }

    {
      const doc = "pending-transactions-update.md";
      const before = await invoiceTotals();
      const { res, journal } = await post("zelle-payment", {
        transactionType: "PAYMENT", invoiceId: invoice.id, amount: 1, paymentMethod: method("ZELLE"),
        paymentAccount: lookup(bank), external_reference_number: `ZZGAP${Date.now()}`,
      });
      const after = await invoiceTotals();
      const applied = journal && Math.abs(after.balance - (before.balance - 1)) < 0.001;
      record(doc, "Non-cash payments apply to the invoice on create", !journal ? "UNVERIFIED" : applied ? "DONE" : "MISSING",
        journal ? `ZELLE $1 ${journal.reconciliationStatus}: balance ${before.balance} → ${after.balance}` : `HTTP ${res.status} ${message(res).slice(0, 100)}`);
      if (journal) {
        await cleanup(journal);
        const restored = await invoiceTotals();
        record(doc, "Reversing an Outstanding payment restores the invoice", Math.abs(restored.balance - before.balance) < 0.001 ? "DONE" : "MISSING",
          `balance after reversal ${restored.balance} (before ${before.balance})`);
      }
    }

    {
      const doc = "payment-accounts-api-contract.md";
      if (altCash) {
        const { res, journal } = await post("cash-account", { ...cash, amount: 1.01, allowDuplicatePayment: true, paymentAccount: lookup(altCash) });
        const debit = debitName(journal);
        record(doc, "2. Cash income posts to the chosen cash account",
          !journal ? (res.status === 422 ? "PARTIAL" : "UNVERIFIED") : debit === altCash.name ? "DONE" : "MISSING",
          journal ? `paymentAccount ${altCash.name} sent; debited ${debit}; paymentAccount returned=${Boolean(journal.paymentAccount)}` : `HTTP ${res.status} ${message(res).slice(0, 100)}`);
        await cleanup(journal);
      } else {
        record(doc, "2. Cash income posts to the chosen cash account", "UNVERIFIED", "no ASSET account other than CASH ON HAND to select");
      }

      if (expense) {
        const { res, journal } = await post("expense-zelle", {
          transactionType: "EXPENSE", amount: 1, paymentMethod: method("ZELLE"), account: lookup(expense), sourceAccount: lookup(bank),
          external_reference_number: `ZZGAP${Date.now()}`,
        });
        record(doc, "4. Expenses paid by a non-cash method", journal && creditName(journal) === bank.name ? "DONE" : journal ? "PARTIAL" : "MISSING",
          journal ? `ZELLE expense: debit ${debitName(journal)}, credit ${creditName(journal)}` : `HTTP ${res.status} ${message(res).slice(0, 100)}`);
        await cleanup(journal);
      }

      const first = await post("duplicate-original", { ...cash, amount: 1.03, allowDuplicatePayment: true });
      const second = await post("duplicate-repeat", { ...cash, amount: 1.03 });
      const code = second.res.json?.code ?? second.res.json?.errorCode ?? second.res.json?.data?.code;
      record(doc, "6. Stable duplicate-payment code", second.res.status !== 409 ? "UNVERIFIED" : code ? "DONE" : "MISSING",
        `repeat HTTP ${second.res.status}; code=${code ?? "none"}; message="${second.res.json?.message ?? ""}"`);
      await cleanup(first.journal);
      await cleanup(second.journal);
    }

    {
      const doc = "closeout-transaction-edits.md";
      const before = await invoiceTotals();
      const { res, journal } = await post("edit-original", { ...cash, amount: 1.04, allowDuplicatePayment: true });
      if (!journal) {
        record(doc, "Edit an Outstanding journal in the current open closeout", "UNVERIFIED", `probe create HTTP ${res.status} ${message(res).slice(0, 100)}`);
      } else {
        const edit = await request("PUT", `/journals/${journal.id}`, {
          id: journal.id, branch: { id: branchId }, currency: closeout.currency ?? "USD", rate: closeout.rate ?? 1,
          incomeStatement: { id: closeout.id }, incomeStatementId: closeout.id,
          description: `${tag} edited`, ...cash, amount: 1.06, allowDuplicatePayment: true,
        });
        const saved = (await request("GET", `/journals/${journal.id}`)).json?.data ?? {};
        const after = await invoiceTotals();
        const amountSaved = Math.abs(Number(saved.amount) - 1.06) < 0.001 && String(saved.description ?? "").includes("edited");
        const invoiceAdjusted = Math.abs(after.balance - (before.balance - 1.06)) < 0.001;
        record(doc, "Edit an Outstanding journal in the current open closeout",
          edit.status >= 300 ? "MISSING" : amountSaved && invoiceAdjusted ? "DONE" : "PARTIAL",
          `PUT HTTP ${edit.status} ${edit.status >= 300 ? message(edit).slice(0, 100) : ""}; amount ${saved.amount}; same closeout=${Number(saved.incomeStatementId ?? saved.incomeStatement?.id) === Number(closeout.id)}; invoice balance ${before.balance} → ${after.balance} (expected ${(before.balance - 1.06).toFixed(2)})`);
        await cleanup(journal);
        const restored = await invoiceTotals();
        if (Math.abs(restored.balance - before.balance) >= 0.001) console.log(`  [CLEANUP] invoice ${invoice.id} balance ${restored.balance}, expected ${before.balance}`);
      }
    }
  }
}

// --- Report ------------------------------------------------------------------
const order = ["MISSING", "PARTIAL", "UNVERIFIED", "DONE"];
for (const doc of new Set(results.map((entry) => entry.doc))) {
  console.log(`\n=== docs/${doc} ===`);
  for (const entry of results.filter((candidate) => candidate.doc === doc)) {
    console.log(`  [${entry.status.padEnd(10)}] ${entry.item}\n               ${entry.evidence}`);
  }
}
console.log("\n=== SUMMARY ===");
for (const status of order) console.log(`${status.padEnd(10)} ${results.filter((entry) => entry.status === status).length}`);
console.log(`Checked at ${new Date().toISOString()} against ${opts.baseUrl} (company ${opts.companyId}).`);
