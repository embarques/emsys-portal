#!/usr/bin/env node
/**
 * Full containers API probe aligned with src/lib/containers/api/containers-api.ts:
 * list, read, bar search, advanced filters, CRUD (create/update/delete + verify).
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819 node scripts/probe-containers-live.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_AUTH_BEARER=1          # prefix Authorization with "Bearer "
 *   EMSYS_SKIP_CRUD=1            # skip create/update/delete
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const rawToken = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "").trim();
const useBearer = process.env.EMSYS_AUTH_BEARER !== "0";
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

const BAR_FIELDS = [
  "name",
  "containerNumber",
  "booking",
  "sealNumber",
  "seal",
  "broker",
  "company",
  "id",
  "cost",
  "departureDate",
  "arrivalDate",
];

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

/** Stripe-style search: pagination in query string (matches containers-api.ts). */
async function search(body, label) {
  const res = await request("POST", "/containers/search?page=1&limit=3&offset=0", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, res.json?.error ?? res.json?.message ?? "");
  return res;
}

console.log("Containers live probe");
console.log(`Base: ${baseUrl}`);
console.log(`Company: ${companyId}`);
console.log(`Auth: ${useBearer ? "Bearer" : "raw JWT"}\n`);

const list = await request("GET", "/containers?page=1&limit=5&sort=id:desc");
if (!ok(list)) {
  fail("GET /containers (auth check)", list.status, list.json?.error ?? list.json?.message ?? "");
  console.log("\nAuth failed. Refresh EMSYS_TOKEN and retry.");
  process.exit(1);
}
pass("GET /containers", summarizeList(list));

const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
const sampleId = sample?.id ?? null;
if (sampleId) {
  const read = await request("GET", `/containers/${sampleId}`);
  if (ok(read)) pass(`GET /containers/${sampleId}`, read.json?.data?.name ?? "");
  else fail(`GET /containers/${sampleId}`, read.status, read.json?.message ?? "");
}

console.log("\n=== Bar search (OR contains) ===");
const barTerm =
  typeof sample?.company === "string" && sample.company.length >= 2
    ? sample.company.slice(0, 4)
    : "26";
await search(
  {
    operator: "or",
    filters: BAR_FIELDS.map((field) => ({ field, operator: "contains", value: barTerm })),
    sort: [{ field: "id", direction: "desc" }],
  },
  `OR contains "${barTerm}" across ${BAR_FIELDS.length} fields`,
);

console.log("\n=== Advanced filters ===");
if (sample?.company) {
  await search(
    {
      operator: "and",
      filters: [{ field: "company", operator: "eq", value: sample.company }],
      sort: [{ field: "id", direction: "desc" }],
    },
    `company eq "${sample.company}"`,
  );
}

if (sample?.name) {
  await search(
    {
      operator: "and",
      filters: [{ field: "name", operator: "startsWith", value: String(sample.name).slice(0, 1) }],
      sort: [{ field: "name", direction: "asc" }],
    },
    `name startsWith "${String(sample.name).slice(0, 1)}"`,
  );
}

if (sampleId) {
  await search(
    {
      operator: "and",
      filters: [{ field: "id", operator: "eq", value: sampleId }],
      sort: [{ field: "id", direction: "desc" }],
    },
    `id eq ${sampleId} (numeric)`,
  );
}

await search(
  {
    operator: "and",
    filters: [
      { field: "departureDate", operator: "gte", value: "2026-06-01" },
      { field: "departureDate", operator: "lte", value: "2026-06-30" },
    ],
    sort: [{ field: "departureDate", direction: "desc" }],
  },
  "departureDate range (Jun 2026)",
);

if (sample?.booking) {
  await search(
    {
      operator: "and",
      filters: [
        { field: "booking", operator: "contains", value: String(sample.booking).slice(0, 4) },
        { field: "company", operator: "eq", value: sample.company || "PORT-EX" },
      ],
      sort: [{ field: "id", direction: "desc" }],
    },
    "combined AND booking + company",
  );
}

console.log("\n=== Validation edge cases ===");
const stringId = await request("POST", "/containers/search?page=1&limit=1&offset=0", {
  operator: "and",
  filters: [{ field: "id", operator: "eq", value: String(sampleId ?? 1) }],
  sort: [{ field: "id", direction: "desc" }],
});
if (stringId.status === 400) pass("id string rejected", "400 as expected");
else fail("id string rejected", stringId.status, "expected 400");

if (!skipCrud) {
  console.log("\n=== CRUD ===");
  const createBody = {
    name: `ZZ_PROBE_${stamp}`,
    booking: `BK-${stamp}`,
    containerNumber: "PROBE1234567",
    sealNumber: "SEAL-PROBE",
    broker: "Probe Broker",
    company: "Probe Co",
    cost: 1234.56,
    departureDate: "2026-07-01T00:00:00Z",
    arrivalDate: "2026-07-15T00:00:00Z",
  };

  const create = await request("POST", "/containers", createBody);
  const newId =
    create.json?.data?.id ??
    (typeof create.json?.data === "number" ? create.json.data : null);

  if (ok(create) && newId) {
    pass("POST /containers", `id=${newId}`);

    const readNew = await request("GET", `/containers/${newId}`);
    if (ok(readNew)) pass(`GET /containers/${newId}`, readNew.json?.data?.booking ?? "");
    else fail(`GET /containers/${newId}`, readNew.status, readNew.json?.message ?? "");

    const update = await request("PUT", `/containers/${newId}`, {
      id: newId,
      name: createBody.name,
      booking: `${createBody.booking}-UPD`,
      containerNumber: createBody.containerNumber,
      sealNumber: "SEAL-PROBE-2",
      broker: "Probe Broker Updated",
      company: "Probe Co Updated",
      cost: 1500,
      departureDate: "2026-07-02T00:00:00Z",
      arrivalDate: "2026-07-16T00:00:00Z",
    });
    if (ok(update)) pass(`PUT /containers/${newId}`, update.json?.data?.booking ?? "");
    else fail(`PUT /containers/${newId}`, update.status, update.json?.message ?? "");

    const found = await search(
      {
        operator: "and",
        filters: [{ field: "name", operator: "eq", value: createBody.name }],
        sort: [{ field: "id", direction: "desc" }],
      },
      `search name eq after update`,
    );
    const foundId = Array.isArray(found.json?.data) ? found.json.data[0]?.id : null;
    if (foundId === newId) pass("search finds updated record");
    else results.notes.push(`search after update returned id=${foundId}`);

    const del = await request("DELETE", `/containers/${newId}`);
    if (ok(del)) pass(`DELETE /containers/${newId}`);
    else fail(`DELETE /containers/${newId}`, del.status, del.json?.message ?? "");

    const verify = await request("GET", `/containers/${newId}`);
    if (verify.status === 404) pass(`GET /containers/${newId} after delete`, "404 as expected");
    else fail(`GET /containers/${newId} after delete`, verify.status, "expected 404");
  } else {
    fail("POST /containers", create.status, create.json?.message ?? create.json?.error ?? "");
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
