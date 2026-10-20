#!/usr/bin/env node
/**
 * Table search + advanced-filter contract test for every portal directory.
 *
 * For each server-filtered table it loads the real feature API module and the
 * real `*_TABLE_FILTER_FIELDS` definitions from `src/` (transpiled on the fly
 * with only the central `apiClient` swapped for a recorder), builds the exact
 * POST /<resource>/search body the portal would send for:
 *   - the toolbar bar search,
 *   - every advanced filter field × operator (values from a live sample record),
 *   - an AND/OR combination of two filter rows,
 * and replays each body against the live API. A field whose value is dropped by
 * the payload builder, or that the API rejects (400), fails the run — so adding
 * a filter field the API does not accept is caught automatically.
 *
 * The Reports catalog has no search contract, so it only gets a list smoke check.
 *
 * Usage:
 *   node scripts/test-table-filters-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' npm run test:api:filters
 *   npm run test:api -- '<jwt>' --only table-filters
 *
 * Options:
 *   --company <id>      X-Company-ID (default: Embarqueros company)
 *   --base-url <url>    API base (default: https://api.embarqueros.com/v1)
 *   --bearer            Send "Bearer <jwt>"
 *   --only a,b          Only these table ids (see --list)
 *   --delay-ms <n>      Pause between API calls (default: 25)
 *   --strict-matches    Treat "sample value matched 0 rows" warnings as failures
 *   --skip-crud         Accepted for orchestrator compatibility (read-only suite)
 *   --list              Print table ids and exit
 *
 * Env equivalents: EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 */

import { createPortalLoader, createRecordingApiClient } from "./lib/portal-modules.mjs";

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";
const WIDE_RANGE = "2000-01-01 to 2100-12-31";
const ZERO_OBJECT_ID = "000000000000000000000000";

/**
 * Every table in the portal. `server` tables send filters to POST /search;
 * `client` tables filter an in-memory list and only get a list smoke check.
 */
const TABLES = [
  { id: "appointments", label: "Appointments", mode: "server", endpoint: "/pickups", api: "src/lib/orders/api/orders-api.ts", fetch: "fetchOrders", fields: ["src/lib/orders/filter-fields.ts", "ORDER_TABLE_FILTER_FIELDS"] },
  { id: "invoices", label: "Invoices", mode: "server", endpoint: "/invoices", api: "src/lib/invoices/api/invoices-api.ts", fetch: "fetchInvoices", fields: ["src/lib/invoices/filter-fields.ts", "INVOICE_TABLE_FILTER_FIELDS"] },
  { id: "loans", label: "Loans", mode: "server", endpoint: "/loans", api: "src/lib/accounting/loans/api.ts", fetch: "fetchLoans", fields: ["src/lib/accounting/loans/filter-fields.ts", "LOAN_TABLE_FILTER_FIELDS"] },
  { id: "checks", label: "Checks", mode: "server", endpoint: "/checks", api: "src/lib/accounting/checks/api/checks-api.ts", fetch: "fetchChecks", fields: ["src/lib/accounting/checks/filter-fields.ts", "CHECK_TABLE_FILTER_FIELDS"] },
  { id: "zelle", label: "Zelle", mode: "server", endpoint: "/zelle-payments", api: "src/lib/accounting/clearable-payments/api.ts", fetch: "fetchClearablePayments", fetchArgs: ["/zelle-payments"], fields: ["src/lib/accounting/clearable-payments/filter-fields.ts", "CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS"] },
  { id: "deposits", label: "Deposits", mode: "server", endpoint: "/deposits", api: "src/lib/accounting/clearable-payments/api.ts", fetch: "fetchClearablePayments", fetchArgs: ["/deposits"], fields: ["src/lib/accounting/clearable-payments/filter-fields.ts", "CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS"] },
  { id: "credit-cards", label: "Credit cards", mode: "server", endpoint: "/credit-card-payments", api: "src/lib/accounting/clearable-payments/api.ts", fetch: "fetchClearablePayments", fetchArgs: ["/credit-card-payments"], fields: ["src/lib/accounting/clearable-payments/filter-fields.ts", "CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS"] },
  { id: "chart-of-accounts", label: "Chart of accounts", mode: "server", endpoint: "/chart-accounts", api: "src/lib/accounting/chart-accounts/api/chart-accounts-api.ts", fetch: "fetchChartAccounts", fields: ["src/lib/accounting/chart-accounts/filter-fields.ts", "CHART_ACCOUNT_TABLE_FILTER_FIELDS"] },
  { id: "customers", label: "Customers", mode: "server", endpoint: "/customers", api: "src/lib/customers/api/customers-api.ts", fetch: "fetchCustomers", fields: ["src/lib/customers/filter-fields.ts", "CUSTOMER_TABLE_FILTER_FIELDS"] },
  { id: "reports", label: "Reports", mode: "client", endpoint: "/reports" },
  { id: "barcodes", label: "Barcodes", mode: "server", endpoint: "/barcodes", api: "src/lib/barcodes/api/barcodes-catalog-api.ts", fetch: "fetchBarcodes", fields: ["src/lib/barcodes/filter-fields.ts", "BARCODE_TABLE_FILTER_FIELDS"] },
  { id: "barcode-statuses", label: "Barcode statuses", mode: "server", endpoint: "/barcode-statuses", api: "src/lib/barcodes/api/barcode-statuses-api.ts", fetch: "fetchBarcodeStatusesPage", catalogSort: "name:asc", fields: ["src/lib/barcodes/barcode-status-filter-fields.ts", "BARCODE_STATUS_TABLE_FILTER_FIELDS"] },
  { id: "stock", label: "Stock", mode: "server", endpoint: "/inventory/items", api: "src/lib/inventory/api/inventory-api.ts", fetch: "fetchInventoryItems", fields: ["src/lib/inventory/filter-fields.ts", "INVENTORY_ITEM_TABLE_FILTER_FIELDS"] },
  { id: "receipts", label: "Receipts", mode: "server", endpoint: "/inventory/receipts", api: "src/lib/inventory/api/inventory-api.ts", fetch: "fetchInventoryReceipts", fields: ["src/lib/inventory/filter-fields.ts", "INVENTORY_RECEIPT_TABLE_FILTER_FIELDS"] },
  { id: "dispatches", label: "Dispatches", mode: "server", endpoint: "/inventory/dispatches", api: "src/lib/inventory/api/inventory-api.ts", fetch: "fetchInventoryDispatches", fields: ["src/lib/inventory/filter-fields.ts", "INVENTORY_DISPATCH_TABLE_FILTER_FIELDS"] },
  { id: "suppliers", label: "Suppliers", mode: "server", endpoint: "/inventory/suppliers", api: "src/lib/inventory/api/inventory-api.ts", fetch: "fetchInventorySuppliers", fields: ["src/lib/inventory/filter-fields.ts", "INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS"] },
  { id: "containers", label: "Containers", mode: "server", endpoint: "/containers", api: "src/lib/containers/api/containers-api.ts", fetch: "fetchContainers", fields: ["src/lib/containers/filter-fields.ts", "CONTAINER_TABLE_FILTER_FIELDS"] },
  { id: "route-crews", label: "Route crews", mode: "server", endpoint: "/routes", api: "src/lib/route-manager/api/route-manager-api.ts", fetch: "fetchRoutes", fields: ["src/lib/route-manager/filter-fields.ts", "ROUTE_TABLE_FILTER_FIELDS"] },
  { id: "daily-routes", label: "Daily routes", mode: "server", endpoint: "/vehicle-routes", api: "src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts", fetch: "fetchActiveRoutes", fields: ["src/lib/pickup-delivery-routes/filter-fields.ts", "ACTIVE_ROUTE_TABLE_FILTER_FIELDS"] },
  { id: "items", label: "Items", mode: "server", endpoint: "/invoice-descriptions", api: "src/lib/items/api/items-api.ts", fetch: "fetchItems", fields: ["src/lib/items/filter-fields.ts", "ITEM_TABLE_FILTER_FIELDS"] },
  { id: "vehicles", label: "Vehicles", mode: "server", endpoint: "/vehicles", api: "src/lib/vehicles/api/vehicles-api.ts", fetch: "fetchVehicles", fields: ["src/lib/vehicles/filter-fields.ts", "VEHICLE_TABLE_FILTER_FIELDS"] },
  { id: "roles", label: "Roles", mode: "server", endpoint: "/roles", api: "src/lib/roles/api/roles-api.ts", fetch: "fetchRoles", fields: ["src/lib/roles/filter-fields.ts", "ROLE_TABLE_FILTER_FIELDS"] },
  { id: "branches", label: "Branches", mode: "server", endpoint: "/branches", api: "src/lib/branches/api/branches-api.ts", fetch: "fetchBranches", fields: ["src/lib/branches/filter-fields.ts", "BRANCH_TABLE_FILTER_FIELDS"] },
  { id: "invoice-policies", label: "Invoice policies", mode: "server", endpoint: "/invoice-policies", api: "src/lib/invoice-policies/api/invoice-policies-api.ts", fetch: "fetchInvoicePoliciesPage", catalogSort: "sortOrder:asc,title:asc", fields: ["src/lib/invoice-policies/filter-fields.ts", "INVOICE_POLICY_TABLE_FILTER_FIELDS"] },
  { id: "users", label: "Users", mode: "server", endpoint: "/users", api: "src/lib/users/api/users-api.ts", fetch: "fetchUsers", fields: ["src/lib/users/filter-fields.ts", "USER_TABLE_FILTER_FIELDS"] },
  { id: "user-activity", label: "User activity", mode: "server", endpoint: "/user-activities", api: "src/lib/user-activities/api/user-activities-api.ts", fetch: "fetchUserActivities", fields: ["src/lib/user-activities/filter-fields.ts", "USER_ACTIVITY_TABLE_FILTER_FIELDS"] },
  { id: "employees", label: "Employees", mode: "server", endpoint: "/employees", api: "src/lib/employees/api/employees-api.ts", fetch: "fetchEmployees", fields: ["src/lib/employees/filter-fields.ts", "EMPLOYEE_TABLE_FILTER_FIELDS"] },
  { id: "employee-titles", label: "Employee titles", mode: "server", endpoint: "/employee-titles", api: "src/lib/employee-titles/api/employee-titles-api.ts", fetch: "fetchEmployeeTitlesPage", catalogSort: "name:asc", fields: ["src/lib/table/named-catalog-filter-fields.ts", "NAMED_CATALOG_TABLE_FILTER_FIELDS"] },
  { id: "employee-departments", label: "Employee departments", mode: "server", endpoint: "/employee-departments", api: "src/lib/employee-departments/api/employee-departments-api.ts", fetch: "fetchEmployeeDepartmentsPage", catalogSort: "name:asc", fields: ["src/lib/table/named-catalog-filter-fields.ts", "NAMED_CATALOG_TABLE_FILTER_FIELDS"] },
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    token: (process.env.EMSYS_TOKEN ?? "").trim(),
    companyId: (process.env.EMSYS_COMPANY_ID ?? DEFAULT_COMPANY_ID).trim(),
    baseUrl: (process.env.EMSYS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    useBearer: process.env.EMSYS_AUTH_BEARER === "1",
    only: [],
    delayMs: 25,
    strictMatches: false,
    list: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--company") opts.companyId = String(argv[++i] ?? "").trim();
    else if (arg === "--base-url") opts.baseUrl = String(argv[++i] ?? "").replace(/\/$/, "");
    else if (arg === "--bearer") opts.useBearer = true;
    else if (arg === "--only") opts.only = String(argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--delay-ms") opts.delayMs = Math.max(0, Number(argv[++i]) || 0);
    else if (arg === "--strict-matches") opts.strictMatches = true;
    else if (arg === "--skip-crud") continue;
    else if (arg === "--list") opts.list = true;
    else if (arg === "-h" || arg === "--help") {
      console.log("Usage: node scripts/test-table-filters-api.mjs '<jwt>' [--only ids] [--list] [--strict-matches]");
      process.exit(0);
    } else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (!opts.token) opts.token = arg.trim();
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return opts;
}

const opts = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error?.message ?? error));
    process.exit(1);
  }
})();

if (opts.list) {
  for (const table of TABLES) console.log(`${table.id.padEnd(22)} ${table.mode.padEnd(7)} ${table.endpoint}`);
  process.exit(0);
}
if (!opts.token) {
  console.error("Pass a temporary JWT as the first argument, or set EMSYS_TOKEN.");
  process.exit(1);
}
const unknown = opts.only.filter((id) => !TABLES.some((table) => table.id === id));
if (unknown.length) {
  console.error(`Unknown table id(s): ${unknown.join(", ")}. Use --list.`);
  process.exit(1);
}

const headers = {
  accept: "application/json",
  "Content-Type": "application/json",
  "X-Company-ID": opts.companyId,
  Authorization: opts.useBearer
    ? `Bearer ${opts.token.replace(/^Bearer\s+/i, "")}`
    : opts.token.replace(/^Bearer\s+/i, ""),
};

// ---------------------------------------------------------------------------
// Feature module loader (real src/ code, recorded HTTP boundary)
// ---------------------------------------------------------------------------
const { apiClient: recordingClient, calls: recorded } = createRecordingApiClient();
const loadFromSrc = createPortalLoader({ apiClient: recordingClient });

// ---------------------------------------------------------------------------
// HTTP + reporting
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = { passed: 0, failed: [], warnings: [] };

async function fetchWithRetry(url, init, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 || attempt >= attempts) return response;
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
    await sleep(500 * attempt);
  }
}

async function apiRequest(method, url, body) {
  if (opts.delayMs) await sleep(opts.delayMs);
  const response = await fetchWithRetry(`${opts.baseUrl}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, json };
}

const isOk = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const errorOf = (res) => String(res.json?.error ?? res.json?.message ?? res.json?.raw ?? "").slice(0, 140);
const totalOf = (res) => {
  const total = Number(res.json?.total);
  if (Number.isFinite(total)) return total;
  const data = res.json?.data;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.items)) return data.items.length;
  return null;
};

function pass() {
  results.passed += 1;
}
function fail(table, label, detail) {
  results.failed.push({ table, label, detail });
  console.log(`  [FAIL] ${label} — ${detail}`);
}
function warn(table, label, detail) {
  if (opts.strictMatches) return fail(table, label, detail);
  results.warnings.push({ table, label, detail });
  console.log(`  [WARN] ${label} — ${detail}`);
}

// ---------------------------------------------------------------------------
// Sample-driven filter values
// ---------------------------------------------------------------------------
function recordsOf(json) {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function readPath(record, fieldPath) {
  let values = [record];
  for (const segment of fieldPath.split(".")) {
    values = values.flatMap((value) => {
      if (value == null || typeof value !== "object") return [];
      const next = value[segment];
      return Array.isArray(next) ? next : [next];
    });
  }
  return values.find((value) => value != null && value !== "" && typeof value !== "object");
}

const isDateLike = (field, definition) =>
  definition.placeholder === "YYYY-MM-DD" || /(At|Date)$/.test(field) || field === "date";

function sampleValueFor(records, field) {
  for (const record of records) {
    const value = readPath(record, field);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Returns { value, fromSample } — the string the user would type/select. */
function filterValueFor(definition, operator, records) {
  if (definition.valueType === "range") return { value: WIDE_RANGE, fromSample: false };
  const sample = sampleValueFor(records, definition.queryFields?.[0] ?? definition.field);

  if (definition.valueType === "select" && definition.options?.length) {
    const match = definition.options.find((option) => String(option.value).toLowerCase() === String(sample ?? "").toLowerCase());
    return { value: String((match ?? definition.options[0]).value), fromSample: Boolean(match) };
  }

  if (sample === undefined) {
    if (isDateLike(definition.field, definition)) return { value: "2024-01-01", fromSample: false };
    // A zero ObjectID is valid for ObjectID fields and still coerces to 0 for numeric ids.
    if (/(^|\.)id$|Id$/.test(definition.field)) return { value: ZERO_OBJECT_ID, fromSample: false };
    return { value: "1", fromSample: false };
  }

  let text = typeof sample === "boolean" ? String(sample) : String(sample).trim();
  if (isDateLike(definition.field, definition) && /^\d{4}-\d{2}-\d{2}/.test(text)) text = text.slice(0, 10);
  if ((operator === "contains" || operator === "startsWith") && text.length > 3) text = text.slice(0, 3);
  return { value: text, fromSample: true };
}

function collectLeaves(node, out = []) {
  if (Array.isArray(node)) node.forEach((entry) => collectLeaves(entry, out));
  else if (node && typeof node === "object") {
    if (typeof node.field === "string" && "operator" in node && !Array.isArray(node.filters)) out.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key !== "sort" && key !== "pagination") collectLeaves(value, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------
/** Catalog page fetchers take `{ query, sort }` instead of `{ search }`. */
function fetchParamsFor(table, params) {
  if (!table.catalogSort) return { page: 1, limit: 1, ...params };
  const { search, ...rest } = params;
  return { page: 1, limit: 1, sort: table.catalogSort, ...(search?.value ? { query: search.value } : {}), ...rest };
}

async function captureSearch(table, api, params) {
  recorded.length = 0;
  await api[table.fetch](...(table.fetchArgs ?? []), fetchParamsFor(table, params));
  return recorded.filter((call) => call.method === "post" && String(call.url).includes("/search")).at(-1) ?? null;
}

async function replay(call) {
  const url = call.url.includes("?") ? call.url : `${call.url}?page=1&limit=1&offset=0`;
  return apiRequest("POST", url, call.body);
}

async function runServerTable(table) {
  let api;
  let fields;
  try {
    api = loadFromSrc(table.api);
    fields = loadFromSrc(table.fields[0])[table.fields[1]];
    if (typeof api[table.fetch] !== "function") throw new Error(`${table.fetch} is not exported by ${table.api}`);
    if (!Array.isArray(fields)) throw new Error(`${table.fields[1]} is not exported by ${table.fields[0]}`);
  } catch (error) {
    fail(table.id, "load portal modules", String(error?.message ?? error));
    return;
  }

  const list = await apiRequest("GET", `${table.endpoint}?page=1&limit=10&offset=0`);
  if (!isOk(list)) {
    fail(table.id, `GET ${table.endpoint}`, `HTTP ${list.status} ${errorOf(list)}`);
    return;
  }
  pass();
  const records = recordsOf(list.json);
  console.log(`  [PASS] GET ${table.endpoint} — total=${totalOf(list) ?? "?"} (sampled ${records.length})`);

  // Toolbar bar search.
  const barCall = await captureSearch(table, api, { search: { value: "a" } });
  if (!barCall) {
    fail(table.id, "bar search", "portal did not POST /search for a bar query");
  } else {
    const res = await replay(barCall);
    if (isOk(res)) {
      pass();
      console.log(`  [PASS] bar search "a" — total=${totalOf(res) ?? "?"} (${collectLeaves(barCall.body).length} fields)`);
    } else {
      fail(table.id, "bar search", `HTTP ${res.status} ${errorOf(res)}`);
      for (const leaf of collectLeaves(barCall.body)) {
        const single = await apiRequest("POST", `${table.endpoint}/search?page=1&limit=1&offset=0`, { operator: "or", filters: [leaf] });
        if (!isOk(single)) console.log(`         offender: ${leaf.field} (${leaf.operator}) → ${errorOf(single)}`);
      }
    }
  }

  // Every advanced filter field × operator.
  for (const definition of fields) {
    if (definition.optionsSource && !definition.options?.length && sampleValueFor(records, definition.field) === undefined) {
      console.log(`  [SKIP] ${definition.field} — dynamic options and no sample value`);
      continue;
    }
    const parts = [];
    for (const operator of definition.operators) {
      const label = `${definition.field} ${operator}`;
      const { value, fromSample } = filterValueFor(definition, operator, records);
      const row = { id: "r1", join: "and", field: definition.field, operator, value };
      let call;
      try {
        call = await captureSearch(table, api, { filterRows: [row] });
      } catch (error) {
        fail(table.id, label, `payload builder threw: ${String(error?.message ?? error)}`);
        parts.push(`${operator}:ERR`);
        continue;
      }
      if (!call || collectLeaves(call.body).length === 0) {
        fail(table.id, label, `value "${value}" was dropped by the payload builder (no filter sent)`);
        parts.push(`${operator}:DROPPED`);
        continue;
      }
      const res = await replay(call);
      if (!isOk(res)) {
        fail(table.id, label, `HTTP ${res.status} ${errorOf(res)} | body=${JSON.stringify(collectLeaves(call.body))}`);
        parts.push(`${operator}:F${res.status}`);
        continue;
      }
      pass();
      const total = totalOf(res);
      parts.push(`${operator}:${total ?? "ok"}`);
      const numericSample = /^-?\d+(\.\d+)?$/.test(value);
      const expectsMatch =
        fromSample &&
        (operator === "eq" || operator === "gte" || operator === "lte" || (operator === "contains" && !numericSample)) &&
        !isDateLike(definition.field, definition) && definition.valueType !== "range";
      if (expectsMatch && total === 0) {
        warn(table.id, label, `sample value "${value}" matched 0 rows (API may compare case/format differently)`);
      }
    }
    console.log(`  [${parts.some((part) => /F\d|DROPPED|ERR/.test(part)) ? "FAIL" : "PASS"}] ${definition.field.padEnd(28)} ${parts.join(" ")}`);
  }

  // AND/OR combination of two rows.
  const comboFields = fields.filter((definition) => definition.valueType !== "range").slice(0, 2);
  if (comboFields.length === 2) {
    const rows = comboFields.map((definition, index) => ({
      id: `c${index}`,
      join: "or",
      field: definition.field,
      operator: definition.operators[0],
      value: filterValueFor(definition, definition.operators[0], records).value,
    }));
    const call = await captureSearch(table, api, { filterRows: rows, search: { value: "a" } });
    const res = call ? await replay(call) : null;
    if (res && isOk(res)) {
      pass();
      console.log(`  [PASS] bar search + (${rows[0].field} OR ${rows[1].field}) — total=${totalOf(res) ?? "?"}`);
    } else {
      fail(table.id, "combined search + OR filters", res ? `HTTP ${res.status} ${errorOf(res)}` : "no search request");
    }
  }
}

async function runClientTable(table) {
  const list = await apiRequest("GET", `${table.endpoint}?page=1&limit=10&offset=0`);
  if (!isOk(list)) {
    fail(table.id, `GET ${table.endpoint}`, `HTTP ${list.status} ${errorOf(list)}`);
    return;
  }
  pass();
  console.log(`  [PASS] GET ${table.endpoint} — total=${totalOf(list) ?? "?"} (search + filters run in memory)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const selected = opts.only.length ? TABLES.filter((table) => opts.only.includes(table.id)) : TABLES;

console.log("EMSYS table search + filter contract test");
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Tables:   ${selected.length}\n`);

const auth = await apiRequest("GET", "/roles?page=1&limit=1&offset=0");
if (auth.status === 401 || auth.status === 403) {
  console.error(`Auth failed (HTTP ${auth.status}). Refresh the temporary token and try again.`);
  process.exit(1);
}

for (const table of selected) {
  console.log(`=== ${table.label} (${table.mode}, ${table.endpoint}) ===`);
  try {
    if (table.mode === "server") await runServerTable(table);
    else await runClientTable(table);
  } catch (error) {
    fail(table.id, "unexpected error", String(error?.stack ?? error).slice(0, 300));
  }
  console.log("");
}

console.log("=== SUMMARY ===");
console.log(`Passed:   ${results.passed}`);
console.log(`Warnings: ${results.warnings.length}`);
console.log(`Failed:   ${results.failed.length}`);
if (results.failed.length) {
  console.log("Failures:");
  for (const entry of results.failed) console.log(`  - [${entry.table}] ${entry.label}: ${entry.detail}`);
  process.exit(1);
}
console.log("All table search and filter checks passed.");
