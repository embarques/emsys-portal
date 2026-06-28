#!/usr/bin/env node
/**
 * Probe EMPLOYEE GROUPS against the live EMSYS API:
 *   1. CRUD round-trip (LIST → READ → CREATE → READ → UPDATE? → DELETE → verify gone)
 *      using a throwaway ZZ Probe Group that is cleaned up afterwards.
 *      NOTE: the app only wires create + delete (no updateEmployeeGroup), so the
 *      PUT step is probed for information and not relied upon.
 *   2. Advanced-filter matrix run against a SEEDED record so we verify real
 *      matching (not just acceptance): field × operator via
 *      POST /employee-groups/search, plus the OR bar-search across
 *      [name, employees.name, branch]. The seeded record is deleted after.
 *
 * Mirrors src/lib/employee-groups/*: create payload is
 * { name, branch, employees: [{ id(number), name }] }, ids are Mongo ObjectId
 * strings, employees is a nested array, default sort name:asc, and bar search
 * fans out OR across [name, employees.name, branch].
 *
 * Match expectations (sample value == the seeded record's own value):
 *   INCLUDE ops → expect to match: eq, contains, startsWith, gte, lte
 *   EXCLUDE ops → expect NOT to match: neq, gt, lt
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-employee-groups.mjs
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
const RESOURCE = "/employee-groups";

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

async function pickEmployees() {
  const res = await req("GET", "/employees?limit=2&page=1&offset=0");
  const list = Array.isArray(res.json?.data) ? res.json.data : [];
  return list
    .map((e) => ({ id: Number(e.id ?? e._id), name: String(e.name ?? e.fullName ?? "Probe").trim() }))
    .filter((e) => Number.isFinite(e.id) && e.name);
}

function seedBody(employees, suffix = "") {
  return {
    name: `ZZ Probe Group ${STAMP}${suffix}`,
    branch: "usa",
    employees: employees.length ? employees : [{ id: 1, name: "Probe Employee" }],
  };
}

// ---------------------------------------------------------------------------
// 1. CRUD
// ---------------------------------------------------------------------------
async function runCrud() {
  console.log(`\n=== EMPLOYEE GROUPS CRUD (${RESOURCE}) ===`);
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

    const employees = await pickEmployees();
    console.log(`    employees: ${employees.length ? employees.map((e) => `${e.id}:${e.name}`).join(", ") : "NONE (using fallback)"}`);

    const body = seedBody(employees, "-CRUD");
    const create = await req("POST", RESOURCE, body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`)) return;

    if (createdId == null) {
      const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        operator: "and",
        filters: [{ field: "name", operator: "eq", value: body.name }],
        sort: [{ field: "name", direction: "asc" }],
      });
      createdId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
      console.log(`    resolved created id via search: ${createdId ?? "?"}`);
      if (createdId == null) return;
    }

    line("READ(new)", await req("GET", `${RESOURCE}/${createdId}`), `id=${createdId}`);

    // The app does NOT wire an update; probe PUT for information only.
    const upd = { ...body, id: createdId, name: `${body.name} EDIT` };
    const update = await req("PUT", `${RESOURCE}/${createdId}`, upd);
    console.log(`  [${ok(update) ? "PASS" : "INFO"}] UPDATE(probe)    ${update.status} ${ok(update) ? "" : errOf(update)} (app has no update endpoint)`);

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

function buildFields(rec) {
  const fields = [
    { field: "id", ops: ID_OPS, sample: rec.id ?? rec._id },
    { field: "name", ops: TEXT, sample: rec.name },
    { field: "branch", ops: TEXT, sample: rec.branch },
    { field: "createdAt", ops: DATE, sample: rec.createdAt },
    { field: "updatedAt", ops: DATE, sample: rec.updatedAt },
  ];
  if (rec.employeeGroupId) fields.push({ field: "employeeGroupId", ops: TEXT, sample: rec.employeeGroupId });
  const firstEmployee = Array.isArray(rec.employees) ? rec.employees[0] : null;
  if (firstEmployee?.name) {
    fields.push({ field: "employees.name", ops: ["startsWith", "contains", "eq"], sample: firstEmployee.name });
  }
  return fields.filter((entry) => entry.sample != null && String(entry.sample) !== "");
}

async function runSeededFilters() {
  console.log(`\n=== EMPLOYEE GROUPS ADVANCED FILTERS — match-verified against a seeded record ===`);
  const employees = await pickEmployees();
  let seedId = null;
  try {
    const body = seedBody(employees, "-SEED");
    const create = await req("POST", RESOURCE, body);
    seedId = extractId(create.json);
    if (!ok(create)) {
      console.log(`  [FAIL] could not seed record: ${create.status} ${errOf(create)}`);
      return;
    }
    if (seedId == null) {
      const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        operator: "and",
        filters: [{ field: "name", operator: "eq", value: body.name }],
        sort: [{ field: "name", direction: "asc" }],
      });
      seedId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
    }
    if (seedId == null) {
      console.log("  [FAIL] seeded record created but id could not be resolved.");
      return;
    }

    const rec = dataOf((await req("GET", `${RESOURCE}/${seedId}`)).json);
    const emp0 = Array.isArray(rec.employees) ? rec.employees[0] : null;
    console.log(`  Seeded id=${seedId}`);
    console.log(`  Stored: name="${rec.name}" branch="${rec.branch ?? "-"}" employeeGroupId="${rec.employeeGroupId ?? "-"}" employees[0]="${emp0?.name ?? "-"}"`);
    console.log(`  Each filter is AND-pinned to "id eq ${seedId}" so results are immune to other records.`);
    console.log(`  (INCLUDE ops eq/contains/startsWith/gte/lte expect to keep the seed; EXCLUDE ops neq/gt/lt expect to drop it)\n`);

    const results = [];
    for (const entry of buildFields(rec)) {
      for (const op of entry.ops) {
        const expectMatch = INCLUDE_OPS.has(op);
        const filterBody = {
          operator: "and",
          filters: [
            { field: entry.field, operator: op, value: entry.sample },
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
        console.log(`  [${verdict}] ${entry.field.padEnd(16)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} want=${want} got=${row.matched ? "match" : "none "} ${row.detail}`);
      }
    }

    const token = String(rec.name).split(" ").find((w) => w.length >= 3) ?? "ZZ";
    const barFields = ["name", "employees.name", "branch"];
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
    console.log(`  [${barCorrect ? "PASS" : barAccepted ? "MISS" : "FAIL"}] ${"OR bar search".padEnd(16)} ${"contains".padEnd(11)} ${String(bar.status).padEnd(4)} token="${token}" got=${barMatched ? "match" : "none "} ${summarize(bar.json)}`);

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
