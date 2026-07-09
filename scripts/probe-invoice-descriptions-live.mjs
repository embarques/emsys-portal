#!/usr/bin/env node
/**
 * Full invoice-descriptions (items) API probe aligned with src/lib/items/api/items-api.ts:
 * list, read, bar search, advanced filters, CRUD, and audit-field presence.
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819 node scripts/probe-invoice-descriptions-live.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_AUTH_BEARER=1          # prefix Authorization with "Bearer " (default)
 *   EMSYS_SKIP_CRUD=1            # skip create/update/delete
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const rawToken = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "").trim();
const useBearer = process.env.EMSYS_AUTH_BEARER !== "0";
const skipCrud = process.env.EMSYS_SKIP_CRUD === "1";
const RESOURCE = "/invoice-descriptions";

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

const BAR_FIELDS = ["name", "id", "price"];
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

function dataOf(json) {
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

async function search(body, label) {
  const res = await request("POST", `${RESOURCE}/search?page=1&limit=3&offset=0`, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, res.json?.error ?? res.json?.message ?? "");
  return res;
}

console.log("Invoice descriptions (items) live probe");
console.log(`Base: ${baseUrl}`);
console.log(`Company: ${companyId}`);
console.log(`Auth: ${useBearer ? "Bearer" : "raw JWT"}\n`);

const list = await request("GET", `${RESOURCE}?page=1&limit=5&sort=name:asc`);
if (!ok(list)) {
  fail("GET /invoice-descriptions (auth check)", list.status, list.json?.error ?? list.json?.message ?? "");
  console.log("\nAuth failed. Refresh EMSYS_TOKEN and retry.");
  process.exit(1);
}
pass("GET /invoice-descriptions", summarizeList(list));

const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
const sampleId = sample?.id ?? null;
const sampleKeys = sample ? Object.keys(sample) : [];
console.log(`\nSample keys: ${sampleKeys.join(", ") || "(none)"}`);
if (sample) {
  const hasCreatedBy = "createdBy" in sample;
  const hasUpdatedBy = "updatedBy" in sample;
  if (hasCreatedBy && hasUpdatedBy) pass("audit fields on list", "createdBy + updatedBy present");
  else {
    results.notes.push(
      `List response missing audit users (createdBy=${hasCreatedBy}, updatedBy=${hasUpdatedBy})`,
    );
    console.log(`  [NOTE] createdBy=${hasCreatedBy}, updatedBy=${hasUpdatedBy} on list sample`);
  }
}

if (sampleId) {
  const read = await request("GET", `${RESOURCE}/${sampleId}`);
  if (ok(read)) pass(`GET /invoice-descriptions/${sampleId}`, read.json?.data?.name ?? dataOf(read.json)?.name ?? "");
  else fail(`GET /invoice-descriptions/${sampleId}`, read.status, read.json?.message ?? "");
}

console.log("\n=== Bar search (OR contains) ===");
const barTerm =
  typeof sample?.name === "string" && sample.name.length >= 2
    ? sample.name.slice(0, 4)
    : "5";
await search(
  {
    operator: "or",
    filters: BAR_FIELDS.map((field) => ({ field, operator: "contains", value: barTerm })),
    sort: [{ field: "name", direction: "asc" }],
  },
  `OR contains "${barTerm}" across ${BAR_FIELDS.join(", ")}`,
);

console.log("\n=== Advanced filters ===");
if (sample?.name) {
  await search(
    {
      operator: "and",
      filters: [{ field: "name", operator: "startsWith", value: String(sample.name).slice(0, 3) }],
      sort: [{ field: "name", direction: "asc" }],
    },
    `name startsWith "${String(sample.name).slice(0, 3)}"`,
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
      { field: "createdAt", operator: "gte", value: "2024-01-01" },
      { field: "createdAt", operator: "lte", value: "2026-12-31" },
    ],
    sort: [{ field: "createdAt", direction: "desc" }],
  },
  "createdAt range (2024–2026)",
);

if (sample?.price != null) {
  await search(
    {
      operator: "and",
      filters: [{ field: "price", operator: "gte", value: 0 }],
      sort: [{ field: "price", direction: "asc" }],
    },
    "price gte 0",
  );
}

console.log("\n=== Validation edge cases ===");
const stringId = await request("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
  operator: "and",
  filters: [{ field: "id", operator: "eq", value: String(sampleId ?? 1) }],
  sort: [{ field: "id", direction: "desc" }],
});
if (stringId.status === 400) pass("id string eq rejected", "400 as expected");
else results.notes.push(`id string eq returned ${stringId.status} (portal coerces to number)`);

const auditFilter = await request("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
  operator: "and",
  filters: [{ field: "createdBy.name", operator: "contains", value: "elk" }],
  sort: [{ field: "name", direction: "asc" }],
});
if (auditFilter.status === 400) pass("createdBy.name filter rejected", "400 — not in allowlist yet");
else pass("createdBy.name filter", `status=${auditFilter.status}`);

if (!skipCrud) {
  console.log("\n=== CRUD ===");
  const createBody = { name: `ZZ_PROBE_ITEM_${stamp}`, price: 1.23 };

  const create = await request("POST", RESOURCE, createBody);
  const newId =
    create.json?.data?.id ??
    (typeof create.json?.data === "number" ? create.json.data : null);

  if (ok(create) && newId) {
    pass("POST /invoice-descriptions", `id=${newId}`);
    const createKeys = create.json?.data ? Object.keys(create.json.data) : [];
    console.log(`  create response keys: ${createKeys.join(", ")}`);

    const readNew = await request("GET", `${RESOURCE}/${newId}`);
    if (ok(readNew)) pass(`GET /invoice-descriptions/${newId}`, dataOf(readNew.json)?.name ?? "");
    else fail(`GET /invoice-descriptions/${newId}`, readNew.status, readNew.json?.message ?? "");

    const update = await request("PUT", `${RESOURCE}/${newId}`, {
      id: newId,
      name: `${createBody.name}_EDIT`,
      price: 9.99,
    });
    if (ok(update)) {
      const updatedName = dataOf(update.json)?.name ?? "";
      pass(`PUT /invoice-descriptions/${newId}`, updatedName);
      if (dataOf(update.json)?.createdAt == null) {
        results.notes.push("PUT response returns createdAt: null");
      }
    } else fail(`PUT /invoice-descriptions/${newId}`, update.status, update.json?.message ?? "");

    const found = await search(
      {
        operator: "and",
        filters: [{ field: "name", operator: "eq", value: `${createBody.name}_EDIT` }],
        sort: [{ field: "name", direction: "asc" }],
      },
      "search name eq after update",
    );
    const foundId = Array.isArray(found.json?.data) ? found.json.data[0]?.id : null;
    if (foundId === newId) pass("search finds updated record");
    else results.notes.push(`search after update returned id=${foundId}`);

    const del = await request("DELETE", `${RESOURCE}/${newId}`);
    if (ok(del)) pass(`DELETE /invoice-descriptions/${newId}`);
    else fail(`DELETE /invoice-descriptions/${newId}`, del.status, del.json?.message ?? "");

    const verify = await request("GET", `${RESOURCE}/${newId}`);
    if (verify.status === 404) pass(`GET /invoice-descriptions/${newId} after delete`, "404 as expected");
    else fail(`GET /invoice-descriptions/${newId} after delete`, verify.status, "expected 404");
  } else {
    fail("POST /invoice-descriptions", create.status, create.json?.message ?? create.json?.error ?? "");
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
if (results.notes.length) {
  console.log("Notes:");
  for (const note of results.notes) console.log(`  - ${note}`);
}
if (results.failed.length) {
  for (const entry of results.failed) {
    console.log(`  - ${entry.label}: ${entry.status} ${entry.detail}`);
  }
  process.exit(1);
}
