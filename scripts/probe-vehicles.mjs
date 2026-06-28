#!/usr/bin/env node
/**
 * Probe VEHICLES against the live EMSYS API:
 *   1. CRUD round-trip (LIST → READ → CREATE → READ → UPDATE → DELETE → verify gone)
 *      using a throwaway ZZ_PROBE_* vehicle that is cleaned up afterwards.
 *   2. Advanced-filter matrix: every VEHICLE_TABLE_FILTER_FIELDS field × operator via
 *      POST /vehicles/search, plus the OR bar-search across VEHICLE_BAR_OR_SEARCH_FIELDS.
 *
 * Mirrors src/lib/vehicles/* + src/lib/api/search-query.ts: pagination rides in the
 * query string, body is { operator, filters, sort }, and the only numeric field
 * (year) is coerced to a JSON number.
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-vehicles.mjs
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim().replace(/^Bearer\s+/i, "");
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) {
  console.error("Set EMSYS_TOKEN (firebase JWT).");
  process.exit(1);
}

const headers = {
  accept: "application/json",
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};
const STAMP = Date.now();

const NUMERIC_FIELDS = new Set(["year", "createdBy.id", "updatedBy.id"]);
const BOOLEAN_FIELDS = new Set();

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let json;
  try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, json };
}
const ok = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const dataOf = (j) => (j && typeof j === "object" && "data" in j ? j.data : j);
const errOf = (res) => (res.json?.error ?? res.json?.message ?? res.json ?? "").toString().slice(0, 110);
function extractId(json) {
  const d = dataOf(json);
  if (d && typeof d === "object" && !Array.isArray(d)) return d.id ?? d._id ?? null;
  if (typeof d === "number") return d;
  if (typeof d === "string" && d.trim()) return d.trim();
  return null;
}
function line(label, res, extra = "") {
  console.log(`  [${ok(res) ? "PASS" : "FAIL"}] ${label.padEnd(16)} ${String(res.status).padEnd(4)} ${ok(res) ? extra : errOf(res)}`);
  return ok(res);
}

// ---------------------------------------------------------------------------
// 1. CRUD
// ---------------------------------------------------------------------------
async function runVehiclesCrud() {
  console.log(`\n=== VEHICLES CRUD (/vehicles) ===`);
  let createdId = null;
  try {
    const list = await req("GET", "/vehicles?limit=1&page=1&offset=0");
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${list.json?.total} sampleId=${sample?.id ?? sample?._id ?? "-"}`);
    if (!ok(list)) return;
    if (sample?.id != null || sample?._id != null) {
      const sid = sample.id ?? sample._id;
      line("READ(sample)", await req("GET", `/vehicles/${sid}`), `id=${sid}`);
    }

    // POST /vehicles — required: name, vin, year, fuelType (vehicleId + branch
    // are assigned by the backend on create, so we omit them here).
    const body = {
      name: `ZZ Probe Vehicle ${STAMP}`,
      vin: `ZZPROBEVIN${STAMP}`.slice(0, 17).toUpperCase(),
      year: new Date().getFullYear(),
      fuelType: "diesel",
    };

    const create = await req("POST", "/vehicles", body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`) || createdId == null) return;

    line("READ(new)", await req("GET", `/vehicles/${createdId}`), `id=${createdId}`);

    const upd = {
      ...body,
      id: createdId,
      name: `${body.name} EDIT`,
      fuelType: "gas",
      updatedAt: new Date().toISOString(),
    };
    line("UPDATE", await req("PUT", `/vehicles/${createdId}`, upd));

    const del = await req("DELETE", `/vehicles/${createdId}`);
    if (line("DELETE", del, `id=${createdId}`)) {
      const gone = await req("GET", `/vehicles/${createdId}`);
      console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE     ${gone.status}`);
      createdId = null;
    }
  } finally {
    if (createdId != null) {
      console.log(`  [cleanup] delete ${createdId}: ${(await req("DELETE", `/vehicles/${createdId}`)).status}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Advanced filters
// ---------------------------------------------------------------------------
const TEXT = ["startsWith", "contains", "eq", "neq"];
const DATE = ["eq", "neq", "gte", "lte", "gt", "lt"];

/**
 * Allowed vehicle search fields per the live API contract:
 *   branch, createdAt, createdBy.id, createdBy.name, fuelType, id, name,
 *   updatedAt, updatedBy.id, updatedBy.name, vehicleId, vin, year
 * NOTE: the API does NOT accept a flat `createdBy` — it expects createdBy.{id,name}.
 * `id` requires a 24-char hex ObjectId, injected at runtime from a real record.
 */
function buildFields(sampleObjectId) {
  return [
    { field: "vehicleId", ops: TEXT, sample: "V" },
    { field: "name", ops: TEXT, sample: "a" },
    { field: "vin", ops: TEXT, sample: "1" },
    { field: "createdBy.name", ops: TEXT, sample: "a" },
    { field: "createdBy.id", ops: ["eq", "neq"], sample: "1" },
    { field: "updatedBy.name", ops: TEXT, sample: "a" },
    { field: "updatedBy.id", ops: ["eq", "neq"], sample: "1" },
    { field: "id", ops: ["eq", "neq"], sample: sampleObjectId ?? "000000000000000000000000" },
    { field: "fuelType", ops: ["eq", "neq"], sample: "diesel" },
    { field: "branch", ops: ["eq", "neq", "contains", "startsWith"], sample: "usa" },
    { field: "year", ops: ["eq", "neq"], sample: "2024" },
    { field: "createdAt", ops: DATE, sample: "2024-01-01" },
    { field: "updatedAt", ops: DATE, sample: "2024-01-01" },
  ];
}

/** Coerce leaf value the same way coerceTypedLeafFilter does. */
function coerce(field, value) {
  if (NUMERIC_FIELDS.has(field)) return Number(value);
  if (BOOLEAN_FIELDS.has(field)) return String(value).trim() === "true";
  return value;
}

/** POST /vehicles/search body — StripeStyleSearchBody (pagination rides query). */
function buildBody(field, op, sample) {
  return {
    operator: "and",
    filters: [{ field, operator: op, value: coerce(field, sample) }],
    sort: [{ field: "name", direction: "asc" }],
  };
}

function summarize(json) {
  if (json && typeof json === "object") {
    if (json.success === false) return String(json.error ?? json.message ?? "").slice(0, 120);
    if (json.error) return String(json.error).slice(0, 120);
    const count = Array.isArray(json.data) ? json.data.length : 0;
    return `rows=${count} subtotal=${json.subtotal ?? "-"} total=${json.total ?? "-"}`;
  }
  return String(json).slice(0, 120);
}

async function runVehiclesFilters() {
  console.log(`\n=== VEHICLES ADVANCED FILTERS (POST /vehicles/search?page=1&limit=1&offset=0) ===`);
  const results = [];

  // Grab a real 24-char ObjectId so the id / *.id filters reflect reality.
  const list = await req("GET", "/vehicles?limit=1&page=1&offset=0");
  const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
  const sampleObjectId = sample?.id ?? sample?._id ?? null;
  const FIELDS = buildFields(sampleObjectId);

  for (const entry of FIELDS) {
    for (const op of entry.ops) {
      const body = buildBody(entry.field, op, entry.sample);
      let row;
      try {
        const { status, json } = await req("POST", "/vehicles/search?page=1&limit=1&offset=0", body);
        const good = status >= 200 && status < 300 && json?.success !== false;
        row = { field: entry.field, op, status, ok: good, detail: summarize(json) };
      } catch (e) {
        row = { field: entry.field, op, status: 0, ok: false, detail: `network: ${e.message}` };
      }
      results.push(row);
      console.log(`  [${row.ok ? "PASS" : "FAIL"}] ${entry.field.padEnd(11)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} ${row.detail}`);
    }
  }

  // OR bar search across searchable string fields (contains).
  // NOTE: the frontend currently sends flat `createdBy`, which the API rejects;
  // the valid field is `createdBy.name`.
  const barFields = ["vehicleId", "name", "vin", "fuelType", "branch", "createdBy.name"];
  const barBody = {
    operator: "or",
    filters: barFields.map((field) => ({ field, operator: "contains", value: "a" })),
    sort: [{ field: "name", direction: "asc" }],
  };
  const bar = await req("POST", "/vehicles/search?page=1&limit=1&offset=0", barBody);
  const barOk = bar.status >= 200 && bar.status < 300 && bar.json?.success !== false;
  results.push({ field: "OR bar search", op: "contains", status: bar.status, ok: barOk, detail: summarize(bar.json) });
  console.log(`  [${barOk ? "PASS" : "FAIL"}] ${"OR bar search".padEnd(11)} ${"contains".padEnd(11)} ${String(bar.status).padEnd(4)} ${summarize(bar.json)}`);

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== FILTER SUMMARY ===`);
  console.log(`Total combos : ${results.length}`);
  console.log(`Passed       : ${passed.length}`);
  console.log(`Failed       : ${failed.length}`);
  if (failed.length) {
    console.log(`\nFailing combos:`);
    for (const r of failed) console.log(`  - ${r.field} ${r.op} -> ${r.status} ${r.detail}`);
  }
  if (results.every((r) => r.status === 401)) {
    console.log(`\nAll 401 — token expired/invalid. Re-run with a fresh EMSYS_TOKEN.`);
  }
}

console.log(`Base    : ${baseUrl}`);
console.log(`Company : ${companyId}`);
console.log(`Stamp   : ${STAMP}`);

await runVehiclesCrud();
await runVehiclesFilters();
console.log("\nDone.");
