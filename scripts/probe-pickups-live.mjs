#!/usr/bin/env node
/**
 * Full pickups API probe: list, read, search/filters, CRUD.
 * Uses the same Authorization style as curl snippets (raw JWT by default).
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819 node scripts/probe-pickups-live.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_AUTH_BEARER=1          # prefix Authorization with "Bearer "
 *   EMSYS_SKIP_CRUD=1            # skip create/update/delete
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const rawToken = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "").trim();
const useBearer = process.env.EMSYS_AUTH_BEARER === "1";
const skipCrud = process.env.EMSYS_SKIP_CRUD === "1";

if (!rawToken || !companyId) {
  console.error("Set EMSYS_TOKEN and EMSYS_COMPANY_ID.");
  process.exit(1);
}

const authValue = useBearer
  ? rawToken.toLowerCase().startsWith("bearer ")
    ? rawToken
    : `Bearer ${rawToken}`
  : rawToken.replace(/^Bearer\s+/i, "");

const headers = {
  accept: "application/json",
  Authorization: authValue,
  "X-Company-ID": companyId,
  "Content-Type": "application/json",
};

const stamp = Date.now();
const results = { passed: [], failed: [], notes: [] };

function pass(label, detail = "") {
  results.passed.push({ label, detail });
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, status, detail = "") {
  results.failed.push({ label, status, detail });
  console.log(`  [FAIL] ${label} — HTTP ${status} ${detail}`.trim());
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json };
}

function ok(res) {
  return res.status >= 200 && res.status < 300 && res.json?.success !== false;
}

function summarizeList(res) {
  return `total=${res.json?.total} subtotal=${res.json?.subtotal} items=${Array.isArray(res.json?.data) ? res.json.data.length : 0}`;
}

async function search(filters, label) {
  const body = {
    operator: "and",
    filters,
    pagination: { page: 1, limit: 3, offset: 0 },
    sort: [{ field: "date", direction: "desc" }],
  };
  const res = await request("POST", "/pickups/search", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, res.json?.error ?? res.json?.message ?? "");
  return res;
}

console.log(`Pickups live probe`);
console.log(`Base: ${baseUrl}`);
console.log(`Company: ${companyId}`);
console.log(`Auth: ${useBearer ? "Bearer" : "raw JWT"}\n`);

// Auth + list
const list = await request("GET", "/pickups?page=1&offset=0&limit=40");
if (!ok(list)) {
  fail("GET /pickups (auth check)", list.status, list.json?.error ?? list.json?.message ?? "");
  console.log("\nAuth failed from this environment. Run this script from your local terminal.");
  process.exit(1);
}
pass("GET /pickups", summarizeList(list));

const sampleId = Array.isArray(list.json?.data) ? list.json.data[0]?.id : null;
if (sampleId) {
  const read = await request("GET", `/pickups/${sampleId}`);
  if (ok(read)) pass(`GET /pickups/${sampleId}`, read.json?.data?.sender?.name ?? "");
  else fail(`GET /pickups/${sampleId}`, read.status, read.json?.message ?? "");
}

// Search / filters
console.log("\n=== Search / filters ===");
await search(
  [{
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
  }],
  "bar OR contains",
);
await search([{ field: "branch.id", operator: "eq", value: 1 }], "branch.id eq 1");
await search([{ field: "completed", operator: "eq", value: false }], "completed eq false");
await search([{ field: "completed", operator: "eq", value: true }], "completed eq true");
await search([{ field: "purpose", operator: "contains", value: "PAYMENT" }], "purpose contains PAYMENT");
await search([{ field: "createdBy.name", operator: "eq", value: "elk@elk.com" }], "createdBy.name eq");
await search([{ field: "sender.phone", operator: "contains", value: "646" }], "sender.phone contains");
await search(
  [{
    operator: "and",
    filters: [
      { field: "sender.address.zipcode", operator: "gte", value: "10451" },
      { field: "sender.address.zipcode", operator: "lte", value: "10499" },
    ],
  }],
  "zip range (expanded)",
);
await search(
  [{
    operator: "and",
    filters: [
      { field: "date", operator: "gte", value: "2026-07-01" },
      { field: "date", operator: "lte", value: "2026-07-09" },
    ],
  }],
  "date range (expanded)",
);
await search(
  [
    { field: "branch.id", operator: "eq", value: 1 },
    { field: "purpose", operator: "contains", value: "PAYMENT" },
  ],
  "combined AND branch + purpose",
);

const history = await request(
  "GET",
  "/pickups?field=sender.id&operator=eq&value=6a4def686e56b19a9a4bb4cd&sort=date:desc&page=1&limit=5",
);
if (ok(history)) pass("GET sender.id history", summarizeList(history));
else fail("GET sender.id history", history.status, history.json?.message ?? "");

const routeSearch = await request("POST", "/vehicle-routes/search", {
  operator: "and",
  filters: [{ field: "routeType", operator: "eq", value: "pickup" }],
  pagination: { page: 1, limit: 1, offset: 0 },
  sort: [{ field: "date", direction: "desc" }],
});
const routeId = Array.isArray(routeSearch.json?.data) ? routeSearch.json.data[0]?.id : null;
if (routeId) {
  await search([{ field: "route.id", operator: "eq", value: routeId }], `route.id eq ${routeId}`);
} else {
  results.notes.push("No pickup vehicle-route found for route.id probe.");
}

// Error shapes
console.log("\n=== Error cases ===");
const emptySearch = await request("POST", "/pickups/search", {
  operator: "and",
  filters: [],
  pagination: { page: 1, limit: 1, offset: 0 },
  sort: [{ field: "date", direction: "desc" }],
});
console.log(`  empty filters => HTTP ${emptySearch.status} ${emptySearch.json?.message ?? ""}`);

const badField = await request("POST", "/pickups/search", {
  operator: "and",
  filters: [{ field: "notARealField", operator: "eq", value: "x" }],
  pagination: { page: 1, limit: 1, offset: 0 },
  sort: [{ field: "date", direction: "desc" }],
});
console.log(`  invalid field => HTTP ${badField.status} ${badField.json?.message ?? ""}`);

// CRUD
if (!skipCrud) {
  console.log("\n=== CRUD ===");
  const createBody = {
    date: "2026-07-09",
    branch: { id: 1, code: "NY" },
    sender: {
      name: `ZZ_PROBE_SENDER_${stamp}`,
      customerType: 1,
      phone1: "555-0199",
      address: { address1: "1 Test St", city: "Bronx", state: "NY", zipcode: "10451" },
    },
    purpose: "API probe test",
    comments: [{ purpose: "comment", unit: "", quantity: 0, description: "probe" }],
  };
  const create = await request("POST", "/pickups", createBody);
  const newId =
    create.json?.data?.id ??
    (typeof create.json?.data === "number" ? create.json.data : null);
  if (ok(create) && newId) {
    pass("POST /pickups", `id=${newId}`);
    const update = await request("PUT", `/pickups/${newId}`, {
      ...createBody,
      sender: { ...createBody.sender, name: `ZZ_PROBE_SENDER_${stamp}_UPD` },
      purpose: "API probe updated",
    });
    if (ok(update)) pass(`PUT /pickups/${newId}`);
    else fail(`PUT /pickups/${newId}`, update.status, update.json?.message ?? "");

    const complete = await request("PUT", `/pickups/${newId}`, {
      ...createBody,
      sender: { ...createBody.sender, name: `ZZ_PROBE_SENDER_${stamp}_UPD` },
      purpose: "API probe updated",
      completed: true,
    });
    if (ok(complete)) pass(`PUT /pickups/${newId} completed`);
    else fail(`PUT /pickups/${newId} completed`, complete.status, complete.json?.message ?? "");

    const del = await request("DELETE", `/pickups/${newId}`);
    if (ok(del)) pass(`DELETE /pickups/${newId}`);
    else fail(`DELETE /pickups/${newId}`, del.status, del.json?.message ?? "");

    const verify = await request("GET", `/pickups/${newId}`);
    if (verify.status === 404) pass(`GET /pickups/${newId} after delete`, "404 as expected");
    else fail(`GET /pickups/${newId} after delete`, verify.status, "expected 404");
  } else {
    fail("POST /pickups", create.status, create.json?.message ?? create.json?.error ?? "");
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
if (results.notes.length) console.log(`Notes: ${results.notes.join(" ")}`);
if (results.failed.length) {
  for (const entry of results.failed) {
    console.log(`  - ${entry.label}: ${entry.status} ${entry.detail}`);
  }
  process.exit(1);
}
