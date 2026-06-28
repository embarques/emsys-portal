#!/usr/bin/env node
/**
 * Probe ROUTE ASSIGNMENTS against the live EMSYS API:
 *   1. CRUD round-trip (LIST → READ → CREATE → READ → UPDATE → DELETE → verify gone)
 *      using a throwaway ZZPROBE-* assignment that is cleaned up afterwards.
 *   2. Advanced-filter matrix run against a SEEDED record so we verify real
 *      matching (not just acceptance): every field × operator via
 *      POST /route-assignments/search, plus the OR bar-search across
 *      ROUTE_ASSIGNMENT_BAR_OR_SEARCH_FIELDS. The seeded record is deleted after.
 *
 * Mirrors src/lib/route-assignments/* + src/lib/api/search-query.ts: pagination
 * rides in the query string, body is { operator, filters, sort }, and the write
 * payload is { routeAssignmentId, name, date, vehicle?, employeeGroup, id? }.
 * Route-assignment ids (id, vehicle.id, employeeGroup.id) are Mongo ObjectId
 * strings, so there is NO numeric/boolean coercion (unlike users).
 *
 * Match expectations (sample value == the seeded record's own value):
 *   INCLUDE ops → expect to match the seeded record: eq, contains, startsWith, gte, lte
 *   EXCLUDE ops → expect NOT to match it:            neq, gt, lt
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-route-assignments.mjs
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
const RESOURCE = "/routes";

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
const refId = (ref) => (ref && typeof ref === "object" ? ref.id ?? ref._id ?? "" : ref ?? "");
const refName = (ref) => (ref && typeof ref === "object" ? ref.name ?? "" : "");

async function pickRefs() {
  const groupRes = await req("GET", "/employee-groups?limit=1&page=1&offset=0");
  const group = Array.isArray(groupRes.json?.data) ? groupRes.json.data[0] : null;
  const vehicleRes = await req("GET", "/vehicles?limit=1&page=1&offset=0");
  const vehicle = Array.isArray(vehicleRes.json?.data) ? vehicleRes.json.data[0] : null;
  return { group, vehicle };
}

function buildWriteBody({ group, vehicle, suffix = "" }) {
  const body = {
    routeAssignmentId: `ZZPROBE-${STAMP}${suffix}`,
    name: `ZZ Probe Route ${STAMP}${suffix}`,
    date: "2026-06-28T00:00:00Z",
    employeeGroup: {
      id: group.id ?? group._id,
      name: group.name ?? group.employeeGroupId ?? "Probe Group",
    },
  };
  if (vehicle) {
    body.vehicle = { id: vehicle.id ?? vehicle._id, name: vehicle.name ?? "Probe Vehicle" };
  }
  return body;
}

// ---------------------------------------------------------------------------
// 1. CRUD
// ---------------------------------------------------------------------------
async function runRouteAssignmentsCrud() {
  console.log(`\n=== ROUTE ASSIGNMENTS CRUD (${RESOURCE}) ===`);
  let createdId = null;
  try {
    const list = await req("GET", `${RESOURCE}?limit=1&page=1&offset=0&sort=date:desc`);
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${list.json?.total} sampleId=${sample?.id ?? sample?._id ?? "-"}`);
    if (!ok(list)) return;
    if (sample) {
      console.log("    sample keys:", Object.keys(sample).join(", "));
      const sid = sample.id ?? sample._id;
      if (sid != null) line("READ(sample)", await req("GET", `${RESOURCE}/${sid}`), `id=${sid}`);
    }

    const { group, vehicle } = await pickRefs();
    console.log(
      `    refs: group=${group ? (group.id ?? group._id) : "NONE"} vehicle=${vehicle ? (vehicle.id ?? vehicle._id) : "NONE"}`,
    );
    if (!group) {
      console.log("  [SKIP] No employee group available to satisfy the required field; skipping CREATE.");
      return;
    }

    const body = buildWriteBody({ group, vehicle, suffix: "-CRUD" });
    const create = await req("POST", RESOURCE, body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`)) return;

    if (createdId == null) {
      const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        operator: "and",
        filters: [{ field: "routeAssignmentId", operator: "eq", value: body.routeAssignmentId }],
        sort: [{ field: "date", direction: "desc" }],
      });
      createdId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
      console.log(`    resolved created id via search: ${createdId ?? "?"}`);
      if (createdId == null) return;
    }

    line("READ(new)", await req("GET", `${RESOURCE}/${createdId}`), `id=${createdId}`);

    const upd = { ...body, id: createdId, name: `${body.name} EDIT` };
    line("UPDATE", await req("PUT", `${RESOURCE}/${createdId}`, upd));

    const readBack = await req("GET", `${RESOURCE}/${createdId}`);
    line("VERIFY(edit)", readBack, `name=${dataOf(readBack.json)?.name ?? "-"}`);

    const del = await req("DELETE", `${RESOURCE}/${createdId}`);
    if (line("DELETE", del, `id=${createdId}`)) {
      const gone = await req("GET", `${RESOURCE}/${createdId}`);
      console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE     ${gone.status}`);
      createdId = null;
    }
  } finally {
    if (createdId != null) {
      console.log(`  [cleanup] delete ${createdId}: ${(await req("DELETE", `${RESOURCE}/${createdId}`)).status}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Advanced filters against a SEEDED record (verifies real matching)
// ---------------------------------------------------------------------------
const TEXT = ["startsWith", "contains", "eq", "neq"];
const ID_OPS = ["eq", "neq"];
const DATE = ["eq", "neq", "gte", "lte", "gt", "lt"];
/** Operators expected to MATCH the seeded record when sample == its own value. */
const INCLUDE_OPS = new Set(["eq", "contains", "startsWith", "gte", "lte"]);

function countOf(json) {
  if (json && typeof json === "object") {
    if (typeof json.total === "number") return json.total;
    if (Array.isArray(json.data)) return json.data.length;
  }
  return 0;
}
function summarize(json) {
  if (json && typeof json === "object") {
    if (json.success === false) return String(json.error ?? json.message ?? "").slice(0, 120);
    if (json.error) return String(json.error).slice(0, 120);
    return `rows=${Array.isArray(json.data) ? json.data.length : 0} subtotal=${json.subtotal ?? "-"} total=${json.total ?? "-"}`;
  }
  return String(json).slice(0, 120);
}

/** Field matrix built from the seeded record's own (server-normalized) values. */
function buildFields(rec) {
  const fields = [
    { field: "id", ops: ID_OPS, sample: rec.id ?? rec._id },
    { field: "routeAssignmentId", ops: TEXT, sample: rec.routeAssignmentId },
    { field: "name", ops: TEXT, sample: rec.name },
    { field: "date", ops: DATE, sample: rec.date },
    { field: "createdAt", ops: DATE, sample: rec.createdAt },
    { field: "updatedAt", ops: DATE, sample: rec.updatedAt },
  ];
  if (refId(rec.vehicle)) fields.push({ field: "vehicle.id", ops: ID_OPS, sample: refId(rec.vehicle) });
  if (refName(rec.vehicle)) fields.push({ field: "vehicle.name", ops: TEXT, sample: refName(rec.vehicle) });
  if (refId(rec.employeeGroup)) fields.push({ field: "employeeGroup.id", ops: ID_OPS, sample: refId(rec.employeeGroup) });
  if (refName(rec.employeeGroup)) fields.push({ field: "employeeGroup.name", ops: TEXT, sample: refName(rec.employeeGroup) });
  return fields.filter((entry) => entry.sample != null && String(entry.sample) !== "");
}

async function runSeededFilters() {
  console.log(`\n=== ROUTE ASSIGNMENTS ADVANCED FILTERS — match-verified against a seeded record ===`);
  const { group, vehicle } = await pickRefs();
  if (!group) {
    console.log("  [SKIP] No employee group available; cannot seed a record for match verification.");
    return;
  }

  let seedId = null;
  try {
    const body = buildWriteBody({ group, vehicle, suffix: "-SEED" });
    const create = await req("POST", RESOURCE, body);
    seedId = extractId(create.json);
    if (!ok(create)) {
      console.log(`  [FAIL] could not seed record: ${create.status} ${errOf(create)}`);
      return;
    }
    if (seedId == null) {
      const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        operator: "and",
        filters: [{ field: "routeAssignmentId", operator: "eq", value: body.routeAssignmentId }],
        sort: [{ field: "date", direction: "desc" }],
      });
      seedId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
    }
    if (seedId == null) {
      console.log("  [FAIL] seeded record created but id could not be resolved.");
      return;
    }

    const rec = dataOf((await req("GET", `${RESOURCE}/${seedId}`)).json);
    console.log(`  Seeded id=${seedId}`);
    console.log(`  Stored values: name="${rec.name}" date="${rec.date}" vehicle.id=${refId(rec.vehicle) || "-"} group.id=${refId(rec.employeeGroup) || "-"}`);
    console.log(`  (INCLUDE ops eq/contains/startsWith/gte/lte expect a match; EXCLUDE ops neq/gt/lt expect no match)\n`);

    const results = [];
    for (const entry of buildFields(rec)) {
      for (const op of entry.ops) {
        const expectMatch = INCLUDE_OPS.has(op);
        const filterBody = {
          operator: "and",
          filters: [{ field: entry.field, operator: op, value: entry.sample }],
          sort: [{ field: "date", direction: "desc" }],
        };
        let row;
        try {
          const { status, json } = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, filterBody);
          const accepted = status >= 200 && status < 300 && json?.success !== false;
          const count = countOf(json);
          const matched = count > 0;
          const correct = accepted && (expectMatch ? matched : !matched);
          row = { field: entry.field, op, status, accepted, expectMatch, matched, correct, detail: summarize(json) };
        } catch (e) {
          row = { field: entry.field, op, status: 0, accepted: false, expectMatch, matched: false, correct: false, detail: `network: ${e.message}` };
        }
        results.push(row);
        const verdict = row.correct ? "PASS" : row.accepted ? "MISS" : "FAIL";
        const want = row.expectMatch ? "match" : "none ";
        console.log(`  [${verdict}] ${entry.field.padEnd(18)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} want=${want} got=${row.matched ? "match" : "none "} ${row.detail}`);
      }
    }

    // OR bar search across ROUTE_ASSIGNMENT_BAR_OR_SEARCH_FIELDS using a token from the seeded name.
    const token = String(rec.name).split(" ").find((w) => w.length >= 3) ?? "ZZ";
    const barFields = ["name", "routeAssignmentId", "vehicle.name", "employeeGroup.name"];
    const bar = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
      operator: "or",
      filters: barFields.map((field) => ({ field, operator: "contains", value: token })),
      sort: [{ field: "date", direction: "desc" }],
    });
    const barAccepted = bar.status >= 200 && bar.status < 300 && bar.json?.success !== false;
    const barMatched = countOf(bar.json) > 0;
    const barCorrect = barAccepted && barMatched;
    results.push({ field: "OR bar search", op: "contains", correct: barCorrect, accepted: barAccepted });
    console.log(`  [${barCorrect ? "PASS" : barAccepted ? "MISS" : "FAIL"}] ${"OR bar search".padEnd(18)} ${"contains".padEnd(11)} ${String(bar.status).padEnd(4)} token="${token}" got=${barMatched ? "match" : "none "} ${summarize(bar.json)}`);

    const correct = results.filter((r) => r.correct);
    const misses = results.filter((r) => r.accepted && !r.correct);
    const rejected = results.filter((r) => !r.accepted);
    console.log(`\n=== FILTER SUMMARY ===`);
    console.log(`Total combos      : ${results.length}`);
    console.log(`Correct           : ${correct.length}`);
    console.log(`Accepted but wrong: ${misses.length}`);
    console.log(`Rejected (4xx/5xx): ${rejected.length}`);
    if (misses.length) {
      console.log(`\nAccepted-but-unexpected-result combos:`);
      for (const r of misses) console.log(`  - ${r.field} ${r.op}: want=${r.expectMatch ? "match" : "none"} got=${r.matched ? "match" : "none"} (${r.detail})`);
    }
    if (rejected.length) {
      console.log(`\nRejected combos:`);
      for (const r of rejected) console.log(`  - ${r.field} ${r.op} -> ${r.status} ${r.detail}`);
    }
  } finally {
    if (seedId != null) {
      console.log(`\n  [cleanup] delete seeded ${seedId}: ${(await req("DELETE", `${RESOURCE}/${seedId}`)).status}`);
    }
  }
}

console.log(`Base    : ${baseUrl}`);
console.log(`Company : ${companyId}`);
console.log(`Stamp   : ${STAMP}`);

await runRouteAssignmentsCrud();
await runSeededFilters();
console.log("\nDone.");
