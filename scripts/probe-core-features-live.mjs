#!/usr/bin/env node
/**
 * Smoke-test the seven core portal features against the live EMSYS API.
 * Mirrors the endpoints used by src/lib feature api modules and dashboard workspaces.
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819 node scripts/probe-core-features-live.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_AUTH_BEARER=1   # prefix Authorization with "Bearer " (default: raw JWT)
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const rawToken = (process.env.EMSYS_TOKEN ?? process.env.NEXT_PUBLIC_DEV_ID_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? process.env.NEXT_PUBLIC_DEV_COMPANY_ID ?? "").trim();
const useBearer = process.env.EMSYS_AUTH_BEARER === "1";

if (!rawToken || !companyId) {
  console.error("Set EMSYS_TOKEN (or NEXT_PUBLIC_DEV_ID_TOKEN) and EMSYS_COMPANY_ID.");
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

const results = { passed: [], failed: [] };

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
  const count = Array.isArray(res.json?.data) ? res.json.data.length : 0;
  return `total=${res.json?.total ?? "?"} items=${count}`;
}

async function probeGet(label, path) {
  const res = await request("GET", path);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, res.json?.error ?? res.json?.message ?? "");
  return res;
}

async function probeSearch(label, path, body) {
  const res = await request("POST", path, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, res.json?.error ?? res.json?.message ?? "");
  return res;
}

const FEATURES = [
  { feature: "Customers", portal: "customers-workspace", hook: "useCustomers" },
  { feature: "Pickups", portal: "orders-workspace", hook: "useOrders" },
  { feature: "Invoices", portal: "invoices-workspace", hook: "useInvoices" },
  { feature: "Containers", portal: "containers-workspace", hook: "useContainers" },
  { feature: "Pickup routes", portal: "pickup-routes-workspace", hook: "useActiveRoutes(pickup)" },
  { feature: "Delivery routes", portal: "delivery-routes-workspace", hook: "useActiveRoutes(delivery)" },
  { feature: "Routes", portal: "route-manager-workspace", hook: "useRoutes" },
];

console.log("Core features live API smoke test");
console.log(`Base    : ${baseUrl}`);
console.log(`Company : ${companyId}`);
console.log(`Auth    : ${useBearer ? "Bearer" : "raw JWT"}`);
console.log("");

// Auth gate — customers is the lightest list call.
const authCheck = await probeGet("Customers — GET /customers", "/customers?page=1&limit=1&offset=0");
if (!ok(authCheck)) {
  console.log("\nAuth failed. Refresh EMSYS_TOKEN and retry.");
  process.exit(1);
}

await probeGet("Pickups — GET /pickups", "/pickups?page=1&limit=1&offset=0");
await probeGet("Invoices — GET /invoices", "/invoices?page=1&limit=1&offset=0&sort=number:desc");
await probeGet("Containers — GET /containers", "/containers?page=1&limit=1&offset=0");

function vehicleRouteSearchBody(routeType) {
  return {
    operator: "and",
    filters: [{ field: "routeType", operator: "eq", value: routeType }],
    sort: [{ field: "date", direction: "desc" }],
  };
}

await probeSearch(
  "Pickup routes — POST /vehicle-routes/search (routeType=pickup)",
  "/vehicle-routes/search?page=1&limit=1&offset=0",
  vehicleRouteSearchBody("pickup"),
);

await probeSearch(
  "Delivery routes — POST /vehicle-routes/search (routeType=delivery)",
  "/vehicle-routes/search?page=1&limit=1&offset=0",
  vehicleRouteSearchBody("delivery"),
);

await probeGet("Routes — GET /routes", "/routes?page=1&limit=1&offset=0");

console.log(`\n--- Summary: ${results.passed.length} passed, ${results.failed.length} failed ---`);
if (results.failed.length > 0) {
  process.exit(1);
}

console.log("\nPortal wiring (all use TanStack Query → feature api → apiClient):");
for (const entry of FEATURES) {
  console.log(`  • ${entry.feature}: ${entry.hook} → ${entry.portal}`);
}
