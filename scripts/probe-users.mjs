#!/usr/bin/env node
/**
 * Probe USERS against the live EMSYS API:
 *   1. CRUD round-trip (LIST → READ → CREATE → READ → UPDATE → DELETE → verify gone)
 *      using a throwaway ZZ_PROBE_* user that is cleaned up afterwards.
 *   2. Advanced-filter matrix: every USER_TABLE_FILTER_FIELDS field × operator via
 *      POST /users/search, plus the OR bar-search across USER_BAR_OR_SEARCH_FIELDS.
 *
 * Mirrors src/lib/users/* + src/lib/api/search-query.ts: pagination rides in the
 * query string, body is { operator, filters, sort }, and numeric/boolean fields
 * (id, branch.id, role.id, accessCode, active) are coerced to JSON numbers/booleans.
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-users.mjs
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

const NUMERIC_FIELDS = new Set(["id", "branch.id", "role.id", "accessCode"]);
const BOOLEAN_FIELDS = new Set(["active"]);

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
async function runUsersCrud() {
  console.log(`\n=== USERS CRUD (/users) ===`);
  let createdId = null;
  try {
    const list = await req("GET", "/users?limit=1&page=1&offset=0");
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${list.json?.total} sampleId=${sample?.id ?? sample?._id ?? "-"}`);
    if (!ok(list)) return;
    if (sample?.id != null || sample?._id != null) {
      const sid = sample.id ?? sample._id;
      line("READ(sample)", await req("GET", `/users/${sid}`), `id=${sid}`);
    }

    const roleRes = await req("GET", "/roles?limit=1");
    const role = Array.isArray(roleRes.json?.data) ? roleRes.json.data[0] : null;
    const branchRes = await req("GET", "/branches?limit=1");
    const branch = Array.isArray(branchRes.json?.data) ? branchRes.json.data[0] : null;

    const body = {
      uid: `ZZPROBEUID${STAMP}`,
      email: `probe${STAMP}@example.com`,
      userName: `zzprobe${STAMP}`,
      fullName: `ZZ Probe ${STAMP}`,
      active: true,
      password: `Probe!${STAMP}`,
      branch: branch
        ? { id: branch.id ?? branch._id, name: branch.name, code: branch.code }
        : { id: 1, name: "Main", code: "NY" },
      role: role
        ? { id: role.id ?? role._id, name: role.name, active: true }
        : { id: 1, name: "Administrador", active: true },
    };

    const create = await req("POST", "/users", body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`) || createdId == null) return;

    line("READ(new)", await req("GET", `/users/${createdId}`), `id=${createdId}`);

    const upd = { ...body, id: Number(createdId) || createdId, fullName: `${body.fullName} EDIT`, active: false };
    delete upd.password;
    line("UPDATE", await req("PUT", `/users/${createdId}`, upd));

    const del = await req("DELETE", `/users/${createdId}`);
    if (line("DELETE", del, `id=${createdId}`)) {
      const gone = await req("GET", `/users/${createdId}`);
      console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE     ${gone.status}`);
      createdId = null;
    }
  } finally {
    if (createdId != null) {
      console.log(`  [cleanup] delete ${createdId}: ${(await req("DELETE", `/users/${createdId}`)).status}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Advanced filters
// ---------------------------------------------------------------------------
const TEXT = ["startsWith", "contains", "eq", "neq"];
const NUM = ["eq", "neq", "gte", "lte", "gt", "lt"];
const DATE = ["eq", "neq", "gte", "lte"];

/** Mirrors USER_TABLE_FILTER_FIELDS with a representative sample value. */
const FIELDS = [
  { field: "id", ops: ["eq", "neq", "gte", "lte"], sample: "1" },
  { field: "userName", ops: TEXT, sample: "a" },
  { field: "fullName", ops: TEXT, sample: "a" },
  { field: "email", ops: TEXT, sample: "a" },
  { field: "uid", ops: TEXT, sample: "a" },
  { field: "type", ops: TEXT, sample: "a" },
  { field: "role.name", ops: TEXT, sample: "a" },
  { field: "branch.name", ops: TEXT, sample: "a" },
  { field: "branch.code", ops: TEXT, sample: "a" },
  { field: "accessCode", ops: NUM, sample: "1" },
  { field: "active", ops: ["eq", "neq"], sample: "true" },
  { field: "branch.id", ops: ["eq", "neq"], sample: "1" },
  { field: "role.id", ops: ["eq", "neq"], sample: "1" },
  { field: "createdAt", ops: DATE, sample: "2024-01-01" },
];

/** Coerce leaf value the same way coerceTypedLeafFilter does. */
function coerce(field, value) {
  if (NUMERIC_FIELDS.has(field)) return Number(value);
  if (BOOLEAN_FIELDS.has(field)) return String(value).trim() === "true";
  return value;
}

/** POST /users/search body — StripeStyleSearchBody (pagination rides query). */
function buildBody(field, op, sample) {
  return {
    operator: "and",
    filters: [{ field, operator: op, value: coerce(field, sample) }],
    sort: [{ field: "id", direction: "asc" }],
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

async function runUsersFilters() {
  console.log(`\n=== USERS ADVANCED FILTERS (POST /users/search?page=1&limit=1&offset=0) ===`);
  const results = [];

  for (const entry of FIELDS) {
    for (const op of entry.ops) {
      const body = buildBody(entry.field, op, entry.sample);
      let row;
      try {
        const { status, json } = await req("POST", "/users/search?page=1&limit=1&offset=0", body);
        const good = status >= 200 && status < 300 && json?.success !== false;
        row = { field: entry.field, op, status, ok: good, detail: summarize(json) };
      } catch (e) {
        row = { field: entry.field, op, status: 0, ok: false, detail: `network: ${e.message}` };
      }
      results.push(row);
      console.log(`  [${row.ok ? "PASS" : "FAIL"}] ${entry.field.padEnd(14)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} ${row.detail}`);
    }
  }

  // OR bar search across searchable string fields (contains).
  const barFields = ["userName", "fullName", "email", "uid", "type", "role.name", "branch.name", "branch.code"];
  const barBody = {
    operator: "or",
    filters: barFields.map((field) => ({ field, operator: "contains", value: "a" })),
    sort: [{ field: "id", direction: "asc" }],
  };
  const bar = await req("POST", "/users/search?page=1&limit=1&offset=0", barBody);
  const barOk = bar.status >= 200 && bar.status < 300 && bar.json?.success !== false;
  results.push({ field: "OR bar search", op: "contains", status: bar.status, ok: barOk, detail: summarize(bar.json) });
  console.log(`  [${barOk ? "PASS" : "FAIL"}] ${"OR bar search".padEnd(14)} ${"contains".padEnd(11)} ${String(bar.status).padEnd(4)} ${summarize(bar.json)}`);

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

await runUsersCrud();
await runUsersFilters();
console.log("\nDone.");
