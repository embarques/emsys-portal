#!/usr/bin/env node
/**
 * Full barcodes API probe aligned with src/lib/barcodes/api/barcodes-catalog-api.ts:
 * list, read, bar search (OR contains), advanced filters, CRUD (create/update/delete + verify).
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819 node scripts/probe-barcodes-live.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const rawToken = (process.env.EMSYS_TOKEN ?? process.env.NEXT_PUBLIC_DEV_ID_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "64d5c0b0d1eab2aaf30b1819").trim();
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

/** Matches BARCODE_BAR_OR_SEARCH_FIELDS in src/lib/barcodes/search-fields.ts */
const BAR_FIELDS = [
  "number",
  "id",
  "scanDate",
  "createdAt",
  "updatedAt",
  "createdBy.name",
  "updatedBy.name",
  "createdBy.id",
  "updatedBy.id",
];

/** Matches BARCODE_TABLE_FILTER_FIELDS in src/lib/barcodes/filter-fields.ts */
const ADVANCED_FIELDS = [
  { field: "id", operator: "eq", valueType: "number" },
  { field: "number", operator: "contains", valueType: "string" },
  { field: "number", operator: "startsWith", valueType: "string" },
  { field: "number", operator: "eq", valueType: "string" },
  { field: "status.name", operator: "contains", valueType: "string" },
  { field: "status.name", operator: "eq", valueType: "string" },
  { field: "container.name", operator: "contains", valueType: "string" },
  { field: "route.name", operator: "contains", valueType: "string" },
  { field: "delivery.name", operator: "contains", valueType: "string" },
  { field: "tripNumber", operator: "eq", valueType: "number" },
  { field: "scanDate", operator: "gte", valueType: "string" },
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

async function search(body, label) {
  const res = await request("POST", "/barcodes/search?page=1&limit=5&offset=0", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, res.json?.error ?? res.json?.message ?? JSON.stringify(res.json).slice(0, 120));
  return res;
}

function pickSampleValue(sample, field) {
  if (!sample) return null;
  const parts = field.split(".");
  let current = sample;
  for (const part of parts) {
    current = current?.[part];
  }
  if (current == null) return null;
  if (typeof current === "number") return current;
  const text = String(current).trim();
  return text || null;
}

console.log("Barcodes live probe");
console.log(`Base: ${baseUrl}`);
console.log(`Company: ${companyId}`);
console.log(`Auth: ${useBearer ? "Bearer" : "raw JWT"}\n`);

const list = await request("GET", "/barcodes?page=1&limit=5&sort=id:desc");
if (!ok(list)) {
  fail("GET /barcodes (auth check)", list.status, list.json?.error ?? list.json?.message ?? "");
  console.log("\nAuth failed. Refresh EMSYS_TOKEN and retry.");
  process.exit(1);
}
pass("GET /barcodes", summarizeList(list));

const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
const sampleId = sample?.id ?? null;

if (sample) {
  console.log("\nSample barcode fields:");
  console.log(
    JSON.stringify(
      {
        id: sample.id,
        number: sample.number,
        status: sample.status,
        container: sample.container,
        route: sample.route,
        delivery: sample.delivery,
        tripNumber: sample.tripNumber,
        scanDate: sample.scanDate,
      },
      null,
      2,
    ),
  );
}

if (sampleId) {
  const read = await request("GET", `/barcodes/${sampleId}`);
  if (ok(read)) pass(`GET /barcodes/${sampleId}`, read.json?.data?.number ?? read.json?.number ?? "");
  else fail(`GET /barcodes/${sampleId}`, read.status, read.json?.message ?? "");
}

console.log("\n=== Bar search (OR contains) ===");
const barTerm =
  typeof sample?.number === "string" && sample.number.length >= 3
    ? sample.number.slice(0, 4)
    : "LBL";

const barSearch = await search(
  {
    operator: "or",
    filters: BAR_FIELDS.map((field) => ({ field, operator: "contains", value: barTerm })),
    sort: [{ field: "id", direction: "desc" }],
  },
  `OR contains "${barTerm}" across ${BAR_FIELDS.length} fields`,
);

console.log("\n=== Per-field bar search probes ===");
for (const field of BAR_FIELDS) {
  const value = pickSampleValue(sample, field);
  if (value == null) {
    results.notes.push(`skip bar field ${field}: no sample value`);
    continue;
  }
  const probeValue =
    field === "id" || field.endsWith(".id")
      ? String(value)
      : typeof value === "number"
        ? value
        : String(value).length >= 3
          ? String(value).slice(0, Math.min(4, String(value).length))
          : String(value);
  await search(
    {
      operator: "or",
      filters: [{ field, operator: "contains", value: probeValue }],
      sort: [{ field: "id", direction: "desc" }],
    },
    `${field} contains "${probeValue}"`,
  );
}

console.log("\n=== Advanced filters (per field) ===");
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

if (sample?.number) {
  await search(
    {
      operator: "and",
      filters: [{ field: "number", operator: "eq", value: sample.number }],
      sort: [{ field: "id", direction: "desc" }],
    },
    `number eq "${sample.number}"`,
  );

  await search(
    {
      operator: "and",
      filters: [{ field: "number", operator: "startsWith", value: String(sample.number).slice(0, 3) }],
      sort: [{ field: "number", direction: "asc" }],
    },
    `number startsWith "${String(sample.number).slice(0, 3)}"`,
  );
}

if (sample?.createdBy?.name) {
  await search(
    {
      operator: "and",
      filters: [{ field: "createdBy.name", operator: "eq", value: sample.createdBy.name }],
      sort: [{ field: "id", direction: "desc" }],
    },
    `createdBy.name eq "${sample.createdBy.name}"`,
  );
}

if (sample?.createdBy?.id != null) {
  await search(
    {
      operator: "and",
      filters: [{ field: "createdBy.id", operator: "eq", value: Number(sample.createdBy.id) }],
      sort: [{ field: "id", direction: "desc" }],
    },
    `createdBy.id eq ${sample.createdBy.id}`,
  );
}

if (sample?.createdAt) {
  const datePart = String(sample.createdAt).slice(0, 10);
  await search(
    {
      operator: "and",
      filters: [{ field: "createdAt", operator: "gte", value: datePart }],
      sort: [{ field: "createdAt", direction: "desc" }],
    },
    `createdAt gte "${datePart}"`,
  );
}

if (sample?.scanDate) {
  const datePart = String(sample.scanDate).slice(0, 10);
  await search(
    {
      operator: "and",
      filters: [{ field: "scanDate", operator: "gte", value: datePart }],
      sort: [{ field: "scanDate", direction: "desc" }],
    },
    `scanDate gte "${datePart}"`,
  );
}

console.log("\n=== Combined AND filter ===");
if (sample?.createdBy?.name && sample?.number) {
  await search(
    {
      operator: "and",
      filters: [
        { field: "createdBy.name", operator: "eq", value: sample.createdBy.name },
        { field: "number", operator: "contains", value: String(sample.number).slice(0, 3) },
      ],
      sort: [{ field: "id", direction: "desc" }],
    },
    "combined createdBy.name + number",
  );
}

console.log("\n=== Validation edge cases ===");
const stringId = await request("POST", "/barcodes/search?page=1&limit=1&offset=0", {
  operator: "and",
  filters: [{ field: "id", operator: "eq", value: String(sampleId ?? 1) }],
  sort: [{ field: "id", direction: "desc" }],
});
if (stringId.status === 400) pass("id string rejected", "400 as expected");
else fail("id string rejected", stringId.status, "expected 400");

if (!skipCrud) {
  console.log("\n=== CRUD ===");

  const containers = await request("GET", "/containers?page=1&limit=1&sort=id:desc");
  const container = Array.isArray(containers.json?.data) ? containers.json.data[0] : null;

  const createBody = {
    number: `ZZ_PROBE_${stamp}`,
    status: { id: 1, name: "CREATED" },
    ...(container
      ? { container: { id: container.id, name: container.name ?? String(container.id) } }
      : {}),
  };

  const create = await request("POST", "/barcodes", createBody);
  const newId =
    create.json?.data?.id ??
    (typeof create.json?.data === "number" ? create.json.data : null) ??
    (typeof create.json?.id === "number" ? create.json.id : null);

  if (ok(create) && newId) {
    pass("POST /barcodes", `id=${newId} number=${createBody.number}`);

    const readNew = await request("GET", `/barcodes/${newId}`);
    if (ok(readNew)) pass(`GET /barcodes/${newId}`, readNew.json?.data?.number ?? "");
    else fail(`GET /barcodes/${newId}`, readNew.status, readNew.json?.message ?? "");

    const update = await request("PUT", `/barcodes/${newId}`, {
      number: `${createBody.number}-UPD`,
      status: { id: 2, name: "PRINTED" },
      ...(createBody.container ? { container: createBody.container } : {}),
    });
    if (ok(update)) pass(`PUT /barcodes/${newId}`, update.json?.data?.number ?? update.json?.data?.status?.name ?? "");
    else fail(`PUT /barcodes/${newId}`, update.status, update.json?.message ?? update.json?.error ?? "");

    const found = await search(
      {
        operator: "and",
        filters: [{ field: "number", operator: "eq", value: `${createBody.number}-UPD` }],
        sort: [{ field: "id", direction: "desc" }],
      },
      "search finds updated number",
    );
    const foundId = Array.isArray(found.json?.data) ? found.json.data[0]?.id : null;
    if (foundId === newId) pass("search finds updated record");
    else results.notes.push(`search after update returned id=${foundId}`);

    const del = await request("DELETE", `/barcodes/${newId}`);
    if (ok(del)) pass(`DELETE /barcodes/${newId}`);
    else fail(`DELETE /barcodes/${newId}`, del.status, del.json?.message ?? del.json?.error ?? "");

    const verify = await request("GET", `/barcodes/${newId}`);
    if (verify.status === 404) pass(`GET /barcodes/${newId} after delete`, "404 as expected");
    else fail(`GET /barcodes/${newId} after delete`, verify.status, "expected 404");
  } else {
    fail("POST /barcodes", create.status, create.json?.message ?? create.json?.error ?? JSON.stringify(create.json).slice(0, 200));
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
if (results.notes.length) console.log(`Notes: ${results.notes.join("; ")}`);
if (results.failed.length) {
  for (const entry of results.failed) {
    console.log(`  - ${entry.label}: ${entry.status} ${entry.detail}`);
  }
  process.exit(1);
}
