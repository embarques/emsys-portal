#!/usr/bin/env node
/**
 * Probe VEHICLES against the live EMSYS API:
 *   1. CRUD round-trip (LIST → READ → CREATE → READ → UPDATE → DELETE → verify gone)
 *      using a throwaway ZZ Probe Vehicle that is cleaned up afterwards.
 *   2. Advanced-filter matrix run against a SEEDED record so we verify real
 *      matching (not just acceptance): every field × operator via
 *      POST /vehicles/search, plus the OR bar-search across
 *      VEHICLE_BAR_OR_SEARCH_FIELDS. The seeded record is deleted after.
 *
 * Mirrors src/lib/vehicles/*: write payload is
 * { name, vin, year(number), fuelType, vehicleId?, branch?, id? }, `year` is the
 * only numeric field (coerced to a JSON number), default sort name:asc, and the
 * documented search capabilities live in VEHICLE_GET_SEARCH_CAPABILITIES.
 *
 * Match expectations (sample value == the seeded record's own value):
 *   INCLUDE ops → expect to match: eq, contains, startsWith, gte, lte
 *   EXCLUDE ops → expect NOT to match: neq, gt, lt
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-vehicles.mjs
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
const RESOURCE = "/vehicles";
const NUMERIC_FIELDS = new Set(["year"]);

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
const errOf = (res) => (res.json?.error ?? res.json?.message ?? res.json ?? "").toString().slice(0, 300);
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

function seedBody(suffix = "") {
  return {
    name: `ZZ Probe Vehicle ${STAMP}${suffix}`,
    vin: `ZZPROBEVIN${STAMP}${suffix}`.toUpperCase(),
    year: 2026,
    fuelType: "diesel",
    branch: "usa",
  };
}

// ---------------------------------------------------------------------------
// 1. CRUD
// ---------------------------------------------------------------------------
async function runCrud() {
  console.log(`\n=== VEHICLES CRUD (${RESOURCE}) ===`);
  let createdId = null;
  try {
    const list = await req("GET", `${RESOURCE}?limit=1&page=1&offset=0&sort=name:asc`);
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${list.json?.total} sampleId=${sample?.id ?? sample?._id ?? "-"}`);
    if (!ok(list)) return;
    if (sample) {
      console.log("    sample keys:", Object.keys(sample).join(", "));
      const sid = sample.id ?? sample._id;
      if (sid != null) line("READ(sample)", await req("GET", `${RESOURCE}/${sid}`), `id=${sid}`);
    }

    const body = seedBody("-CRUD");
    const create = await req("POST", RESOURCE, body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`)) return;

    if (createdId == null) {
      const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        operator: "and",
        filters: [{ field: "vin", operator: "eq", value: body.vin }],
        sort: [{ field: "name", direction: "asc" }],
      });
      createdId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
      console.log(`    resolved created id via search: ${createdId ?? "?"}`);
      if (createdId == null) return;
    }

    line("READ(new)", await req("GET", `${RESOURCE}/${createdId}`), `id=${createdId}`);

    const upd = { ...body, id: createdId, name: `${body.name} EDIT`, year: 2027 };
    line("UPDATE", await req("PUT", `${RESOURCE}/${createdId}`, upd));

    const readBack = await req("GET", `${RESOURCE}/${createdId}`);
    line("VERIFY(edit)", readBack, `name=${dataOf(readBack.json)?.name ?? "-"} year=${dataOf(readBack.json)?.year ?? "-"}`);

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
// 2. Advanced filters against a SEEDED record
// ---------------------------------------------------------------------------
const TEXT = ["startsWith", "contains", "eq", "neq"];
const ID_OPS = ["eq", "neq"];
const DATE = ["eq", "neq", "gte", "lte", "gt", "lt"];
const INCLUDE_OPS = new Set(["eq", "contains", "startsWith", "gte", "lte"]);

function coerce(field, value) {
  return NUMERIC_FIELDS.has(field) ? Number(value) : value;
}
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
    { field: "name", ops: TEXT, sample: rec.name },
    { field: "vin", ops: TEXT, sample: rec.vin },
    { field: "fuelType", ops: TEXT, sample: rec.fuelType },
    { field: "year", ops: ID_OPS, sample: rec.year },
    { field: "createdAt", ops: DATE, sample: rec.createdAt },
    { field: "updatedAt", ops: DATE, sample: rec.updatedAt },
  ];
  if (rec.vehicleId) fields.push({ field: "vehicleId", ops: TEXT, sample: rec.vehicleId });
  if (rec.branch) fields.push({ field: "branch", ops: TEXT, sample: rec.branch });
  // createdBy is a core.User object → filter on the nested createdBy.name path.
  const createdByName = rec.createdBy && typeof rec.createdBy === "object" ? rec.createdBy.name : rec.createdBy;
  if (createdByName) fields.push({ field: "createdBy.name", ops: TEXT, sample: createdByName });
  return fields.filter((entry) => entry.sample != null && String(entry.sample) !== "");
}

async function runSeededFilters() {
  console.log(`\n=== VEHICLES ADVANCED FILTERS — match-verified against a seeded record ===`);
  let seedId = null;
  try {
    const body = seedBody("-SEED");
    const create = await req("POST", RESOURCE, body);
    seedId = extractId(create.json);
    if (!ok(create)) {
      console.log(`  [FAIL] could not seed record: ${create.status} ${errOf(create)}`);
      return;
    }
    if (seedId == null) {
      const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        operator: "and",
        filters: [{ field: "vin", operator: "eq", value: body.vin }],
        sort: [{ field: "name", direction: "asc" }],
      });
      seedId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
    }
    if (seedId == null) {
      console.log("  [FAIL] seeded record created but id could not be resolved.");
      return;
    }

    const rec = dataOf((await req("GET", `${RESOURCE}/${seedId}`)).json);
    console.log(`  Seeded id=${seedId}`);
    console.log(`  Stored: name="${rec.name}" vin="${rec.vin}" year=${rec.year} fuelType="${rec.fuelType}" vehicleId="${rec.vehicleId ?? "-"}" branch="${rec.branch ?? "-"}"`);
    console.log(`  Each filter is AND-pinned to "id eq ${seedId}" so results are immune to other records.`);
    console.log(`  (INCLUDE ops eq/contains/startsWith/gte/lte expect to keep the seed; EXCLUDE ops neq/gt/lt expect to drop it)\n`);

    const results = [];
    for (const entry of buildFields(rec)) {
      for (const op of entry.ops) {
        const expectMatch = INCLUDE_OPS.has(op);
        const filterBody = {
          operator: "and",
          filters: [
            { field: entry.field, operator: op, value: coerce(entry.field, entry.sample) },
            { field: "id", operator: "eq", value: seedId },
          ],
          sort: [{ field: "name", direction: "asc" }],
        };
        let row;
        try {
          const { status, json } = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, filterBody);
          const accepted = status >= 200 && status < 300 && json?.success !== false;
          const matched = countOf(json) > 0;
          const correct = accepted && (expectMatch ? matched : !matched);
          row = { field: entry.field, op, status, accepted, expectMatch, matched, correct, detail: summarize(json) };
        } catch (e) {
          row = { field: entry.field, op, status: 0, accepted: false, expectMatch, matched: false, correct: false, detail: `network: ${e.message}` };
        }
        results.push(row);
        const verdict = row.correct ? "PASS" : row.accepted ? "MISS" : "FAIL";
        const want = row.expectMatch ? "match" : "none ";
        console.log(`  [${verdict}] ${entry.field.padEnd(12)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} want=${want} got=${row.matched ? "match" : "none "} ${row.detail}`);
      }
    }

    // Mirrors the app's VEHICLE_BAR_OR_SEARCH_FIELDS verbatim so the probe
    // reflects the real bar-search request the UI sends.
    const token = String(rec.name).split(" ").find((w) => w.length >= 3) ?? "ZZ";
    const barFields = ["vehicleId", "name", "licensePlate", "vin"];
    const bar = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
      operator: "and",
      filters: [
        { operator: "or", filters: barFields.map((field) => ({ field, operator: "contains", value: token })) },
        { field: "id", operator: "eq", value: seedId },
      ],
      sort: [{ field: "name", direction: "asc" }],
    });
    const barAccepted = bar.status >= 200 && bar.status < 300 && bar.json?.success !== false;
    const barMatched = countOf(bar.json) > 0;
    const barCorrect = barAccepted && barMatched;
    results.push({ field: "OR bar search", op: "contains", correct: barCorrect, accepted: barAccepted });
    console.log(`  [${barCorrect ? "PASS" : barAccepted ? "MISS" : "FAIL"}] ${"OR bar search".padEnd(12)} ${"contains".padEnd(11)} ${String(bar.status).padEnd(4)} token="${token}" got=${barMatched ? "match" : "none "} ${summarize(bar.json)}`);

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

await runCrud();
await runSeededFilters();
console.log("\nDone.");
