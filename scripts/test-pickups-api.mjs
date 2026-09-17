#!/usr/bin/env node
/**
 * Smoke-test Pickup (Appointments) API endpoints used by the portal.
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Usage:
 *   node scripts/test-pickups-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-pickups-api.mjs
 *
 * Optional:
 *   --company <id>                 override X-Company-ID
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer                       prefix Authorization with "Bearer "
 *   --skip-crud                    read/search only (no create/update/delete)
 *   --skip-route                   skip route assign / unassign
 *   --skip-report                  skip POST /reports/pickups
 *   --run-legacy-preview           also hit GET /pickups/legacy-sync/preview
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_ROUTE=1, EMSYS_SKIP_REPORT=1
 *   EMSYS_RUN_LEGACY_PREVIEW=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

function printHelp() {
  console.log(`Usage:
  node scripts/test-pickups-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-pickups-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-route              Skip route assign / unassign
  --skip-report             Skip pickup manifest report
  --run-legacy-preview      Hit legacy sync preview (permission-gated)
  -h, --help                Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    token: (process.env.EMSYS_TOKEN ?? "").trim(),
    companyId: (process.env.EMSYS_COMPANY_ID ?? DEFAULT_COMPANY_ID).trim(),
    baseUrl: (process.env.EMSYS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    useBearer: process.env.EMSYS_AUTH_BEARER === "1",
    skipCrud: process.env.EMSYS_SKIP_CRUD === "1",
    skipRoute: process.env.EMSYS_SKIP_ROUTE === "1",
    skipReport: process.env.EMSYS_SKIP_REPORT === "1",
    runLegacyPreview: process.env.EMSYS_RUN_LEGACY_PREVIEW === "1",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--company") {
      opts.companyId = String(argv[++i] ?? "").trim();
    } else if (arg === "--base-url") {
      opts.baseUrl = String(argv[++i] ?? "").replace(/\/$/, "");
    } else if (arg === "--bearer") {
      opts.useBearer = true;
    } else if (arg === "--skip-crud") {
      opts.skipCrud = true;
    } else if (arg === "--skip-route") {
      opts.skipRoute = true;
    } else if (arg === "--skip-report") {
      opts.skipReport = true;
    } else if (arg === "--run-legacy-preview") {
      opts.runLegacyPreview = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!opts.token) {
      opts.token = arg.trim();
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return opts;
}

const opts = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error?.message ?? error));
    printHelp();
    process.exit(1);
  }
})();

if (opts.help) {
  printHelp();
  process.exit(0);
}

if (!opts.token) {
  console.error("Pass a temporary JWT as the first argument, or set EMSYS_TOKEN.");
  printHelp();
  process.exit(1);
}

if (!opts.companyId) {
  console.error("Company ID is empty. Pass --company <id> or set EMSYS_COMPANY_ID.");
  process.exit(1);
}

const authValue = opts.useBearer
  ? opts.token.toLowerCase().startsWith("bearer ")
    ? opts.token
    : `Bearer ${opts.token}`
  : opts.token.replace(/^Bearer\s+/i, "");

const headers = {
  accept: "application/json",
  Authorization: authValue,
  "X-Company-ID": opts.companyId,
  "Content-Type": "application/json",
};

const stamp = Date.now();
const today = new Date().toISOString().slice(0, 10);
const results = { passed: [], failed: [], notes: [] };

function pass(label, detail = "") {
  results.passed.push({ label, detail });
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, status, detail = "") {
  results.failed.push({ label, status, detail });
  console.log(`  [FAIL] ${label} — HTTP ${status}${detail ? ` ${detail}` : ""}`);
}

function note(message) {
  results.notes.push(message);
  console.log(`  [NOTE] ${message}`);
}

async function request(method, path, body) {
  const response = await fetch(`${opts.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, json };
}

function ok(res) {
  return res.status >= 200 && res.status < 300 && res.json?.success !== false;
}

function errDetail(res) {
  return String(res.json?.error ?? res.json?.message ?? res.json?.raw ?? "").slice(0, 160);
}

function summarizeList(res) {
  const items = Array.isArray(res.json?.data) ? res.json.data.length : 0;
  return `total=${res.json?.total ?? "?"} subtotal=${res.json?.subtotal ?? "?"} items=${items}`;
}

function extractId(json) {
  const data = json?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data.id ?? data._id ?? null;
  }
  if (typeof data === "number" || typeof data === "string") return data;
  return null;
}

async function search(filters, label) {
  const body = {
    operator: "and",
    filters,
    pagination: { page: 1, limit: 5, offset: 0 },
    sort: [{ field: "date", direction: "desc" }],
  };
  const res = await request("POST", "/pickups/search", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

console.log("Pickup (Appointments) API smoke test");
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Route:    ${opts.skipRoute ? "skipped" : "enabled"}`);
console.log(`Report:   ${opts.skipReport ? "skipped" : "enabled"}\n`);

// ---------------------------------------------------------------------------
// Auth + list / read
// ---------------------------------------------------------------------------
console.log("=== List / read ===");
const list = await request("GET", "/pickups?page=1&offset=0&limit=40");
if (!ok(list)) {
  fail("GET /pickups (auth check)", list.status, errDetail(list));
  console.log("\nAuth failed. Refresh the temporary token and try again.");
  process.exit(1);
}
pass("GET /pickups", summarizeList(list));

const samplePickup = Array.isArray(list.json?.data) ? list.json.data[0] : null;
const sampleId = samplePickup?.id ?? null;
if (sampleId != null) {
  const read = await request("GET", `/pickups/${sampleId}`);
  if (ok(read)) {
    pass(`GET /pickups/${sampleId}`, read.json?.data?.sender?.name ?? "");
  } else {
    fail(`GET /pickups/${sampleId}`, read.status, errDetail(read));
  }
} else {
  note("No existing pickups returned; read-by-id will run after create.");
}

const completedList = await request("GET", "/pickups?completed=true&page=1&limit=5");
if (ok(completedList)) pass("GET /pickups?completed=true", summarizeList(completedList));
else fail("GET /pickups?completed=true", completedList.status, errDetail(completedList));

// ---------------------------------------------------------------------------
// Search / filters (portal Appointments directory)
// ---------------------------------------------------------------------------
console.log("\n=== Search / filters ===");
await search(
  [
    {
      operator: "or",
      filters: [
        "sender.name",
        "receivers.name",
        "sender.phone",
        "receivers.phone",
        "sender.address",
        "receivers.address",
        "comments",
      ].map((field) => ({ field, operator: "contains", value: "a" })),
    },
  ],
  "POST /pickups/search bar OR",
);
await search([{ field: "completed", operator: "eq", value: false }], "search completed=false");
await search([{ field: "completed", operator: "eq", value: true }], "search completed=true");
await search([{ field: "purpose", operator: "contains", value: "PICKUP" }], "search purpose PICKUP");
await search(
  [
    {
      operator: "and",
      filters: [
        { field: "date", operator: "gte", value: today },
        { field: "date", operator: "lte", value: today },
      ],
    },
  ],
  "search date = today",
);

if (samplePickup?.sender?.id) {
  const history = await request(
    "GET",
    `/pickups?field=sender.id&operator=eq&value=${encodeURIComponent(samplePickup.sender.id)}&sort=date:desc&page=1&limit=5`,
  );
  if (ok(history)) pass("GET sender.id history", summarizeList(history));
  else fail("GET sender.id history", history.status, errDetail(history));
}

// ---------------------------------------------------------------------------
// Legacy preview (optional; permission-gated)
// ---------------------------------------------------------------------------
if (opts.runLegacyPreview) {
  console.log("\n=== Legacy sync preview ===");
  const preview = await request("GET", "/pickups/legacy-sync/preview");
  if (ok(preview)) {
    pass("GET /pickups/legacy-sync/preview", `total=${preview.json?.data?.total ?? "?"}`);
  } else if (preview.status === 403) {
    note("legacy-sync/preview returned 403 (missing canSyncLegacyPickups).");
  } else {
    fail("GET /pickups/legacy-sync/preview", preview.status, errDetail(preview));
  }
}

// ---------------------------------------------------------------------------
// CRUD lifecycle (throwaway ZZ_PROBE_* record, always cleaned up)
// ---------------------------------------------------------------------------
let createdId = null;

if (!opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const createBody = {
    date: today,
    branch: { id: 1, code: "NY" },
    sender: {
      name: `ZZ_PROBE_APPT_${stamp}`,
      customerType: 1,
      phone1: "555-0100",
      address: {
        address1: "1 Probe St",
        city: "Bronx",
        state: "NY",
        zipcode: "10451",
      },
    },
    purpose: "API smoke test",
    comments: [
      {
        purpose: "PICKUP",
        unit: "box",
        quantity: 1,
        description: "probe appointment",
      },
    ],
  };

  const create = await request("POST", "/pickups", createBody);
  createdId = extractId(create.json);
  if (ok(create) && createdId != null) {
    pass("POST /pickups", `id=${createdId}`);

    const createdRead = await request("GET", `/pickups/${createdId}`);
    if (ok(createdRead)) pass(`GET /pickups/${createdId} after create`);
    else fail(`GET /pickups/${createdId} after create`, createdRead.status, errDetail(createdRead));

    const updateBody = {
      ...createBody,
      sender: {
        ...createBody.sender,
        name: `ZZ_PROBE_APPT_${stamp}_UPD`,
      },
      purpose: "API smoke test updated",
      comments: [
        {
          purpose: "PICKUP",
          unit: "box",
          quantity: 2,
          description: "probe appointment updated",
        },
      ],
    };
    const update = await request("PUT", `/pickups/${createdId}`, updateBody);
    if (ok(update)) pass(`PUT /pickups/${createdId}`);
    else fail(`PUT /pickups/${createdId}`, update.status, errDetail(update));

    const complete = await request("PUT", `/pickups/${createdId}`, {
      ...updateBody,
      completed: true,
    });
    if (ok(complete)) pass(`PUT /pickups/${createdId} completed=true`);
    else fail(`PUT /pickups/${createdId} completed=true`, complete.status, errDetail(complete));

    // Re-open so route assign / report still work on an incomplete-ish record if needed
    const reopen = await request("PUT", `/pickups/${createdId}`, {
      ...updateBody,
      completed: false,
    });
    if (ok(reopen)) pass(`PUT /pickups/${createdId} completed=false`);
    else fail(`PUT /pickups/${createdId} completed=false`, reopen.status, errDetail(reopen));
  } else {
    fail("POST /pickups", create.status, errDetail(create));
  }
}

// ---------------------------------------------------------------------------
// Route assign / unassign (portal Daily routes → Appointments)
// ---------------------------------------------------------------------------
if (!opts.skipRoute && createdId != null) {
  console.log("\n=== Route assign / unassign ===");
  const routeSearch = await request("POST", "/vehicle-routes/search", {
    operator: "and",
    filters: [{ field: "routeType", operator: "eq", value: "pickup" }],
    pagination: { page: 1, limit: 1, offset: 0 },
    sort: [{ field: "date", direction: "desc" }],
  });

  const routeId = Array.isArray(routeSearch.json?.data)
    ? routeSearch.json.data[0]?.id
    : null;

  if (!ok(routeSearch)) {
    fail("POST /vehicle-routes/search (pickup)", routeSearch.status, errDetail(routeSearch));
  } else if (!routeId) {
    note("No pickup vehicle-route found; skipping assign/unassign.");
  } else {
    pass("POST /vehicle-routes/search (pickup)", `routeId=${routeId}`);

    const assign = await request("PUT", `/pickups/route/${routeId}`, {
      pickupIds: [Number(createdId)],
    });
    if (ok(assign)) pass(`PUT /pickups/route/${routeId}`, `pickupIds=[${createdId}]`);
    else fail(`PUT /pickups/route/${routeId}`, assign.status, errDetail(assign));

    const byRoute = await search(
      [{ field: "route.id", operator: "eq", value: String(routeId) }],
      `search route.id eq ${routeId}`,
    );
    const assigned = Array.isArray(byRoute.json?.data)
      ? byRoute.json.data.some((row) => String(row?.id) === String(createdId))
      : false;
    if (assigned) pass("created pickup appears on route search");
    else note("Created pickup not in first page of route search (may be pagination/sort).");

    const unassign = await request("DELETE", `/pickups/${createdId}/route`);
    if (ok(unassign)) pass(`DELETE /pickups/${createdId}/route`);
    else fail(`DELETE /pickups/${createdId}/route`, unassign.status, errDetail(unassign));
  }
}

// ---------------------------------------------------------------------------
// Pickup manifest report
// ---------------------------------------------------------------------------
const reportId = createdId ?? sampleId;
if (!opts.skipReport && reportId != null) {
  console.log("\n=== Report ===");
  const report = await request("POST", "/reports/pickups", {
    type: "pickup",
    collection: "pickups",
    values: [String(reportId)],
    lookup_field: "id",
    expiresInHours: 1,
  });
  if (ok(report)) {
    const url =
      report.json?.data?.url ??
      report.json?.data?.publicUrl ??
      report.json?.data?.downloadUrl ??
      "";
    pass("POST /reports/pickups", url ? "url returned" : "ok");
  } else {
    fail("POST /reports/pickups", report.status, errDetail(report));
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
if (createdId != null) {
  console.log("\n=== Cleanup ===");
  const del = await request("DELETE", `/pickups/${createdId}`);
  if (ok(del)) pass(`DELETE /pickups/${createdId}`);
  else fail(`DELETE /pickups/${createdId}`, del.status, errDetail(del));

  const gone = await request("GET", `/pickups/${createdId}`);
  if (gone.status === 404) pass(`GET /pickups/${createdId} after delete`, "404 as expected");
  else fail(`GET /pickups/${createdId} after delete`, gone.status, "expected 404");
}

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
if (results.notes.length) {
  console.log("Notes:");
  for (const entry of results.notes) console.log(`  - ${entry}`);
}
if (results.failed.length) {
  console.log("Failures:");
  for (const entry of results.failed) {
    console.log(`  - ${entry.label}: ${entry.status} ${entry.detail}`);
  }
  process.exit(1);
}

console.log("All pickup (appointment) checks passed.");
