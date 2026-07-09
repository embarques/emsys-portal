#!/usr/bin/env node
/**
 * Probe pickup vehicle-routes (POST /vehicle-routes/search?routeType=pickup):
 *   - Auth + list/read
 *   - CRUD round-trip (create → read → update → delete)
 *   - Advanced filters (match-verified against a seeded record)
 *   - OR bar search across ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS (pickup subset)
 *   - Rejected-field sanity checks (driver.name, container.name)
 *
 * Usage:
 *   EMSYS_TOKEN='<jwt>' EMSYS_COMPANY_ID=64d5c0b0d1eab2aaf30b1819 node scripts/probe-pickup-routes-live.mjs
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

const STAMP = Date.now();
const RESOURCE = "/vehicle-routes";
const PICKUP_TYPE = "pickup";

const BAR_OR_SEARCH_FIELDS = ["name", "route.name", "employees.name", "date"];
const ALLOWED_FILTER_FIELDS = [
  { field: "id", ops: ["eq", "neq"], valueType: "text" },
  { field: "name", ops: ["startsWith", "contains", "eq", "neq"], valueType: "text" },
  { field: "date", ops: ["eq", "neq", "gte", "lte", "gt", "lt"], valueType: "date" },
  { field: "route.name", ops: ["startsWith", "contains", "eq", "neq"], valueType: "text" },
  { field: "route.id", ops: ["eq", "neq"], valueType: "text" },
  { field: "employees.name", ops: ["startsWith", "contains", "eq", "neq"], valueType: "text" },
  { field: "employees.id", ops: ["eq", "neq", "gte", "lte", "gt", "lt"], valueType: "number" },
  { field: "employees.role", ops: ["eq", "neq"], valueType: "text" },
  { field: "branch.code", ops: ["startsWith", "contains", "eq", "neq"], valueType: "text" },
  { field: "branch.id", ops: ["eq", "neq", "gte", "lte", "gt", "lt"], valueType: "number" },
  { field: "branch.name", ops: ["startsWith", "contains", "eq", "neq"], valueType: "text" },
  { field: "active", ops: ["eq", "neq"], valueType: "bool" },
  { field: "dayOfWeek", ops: ["eq", "neq", "in", "notIn"], valueType: "text" },
  { field: "rate", ops: ["eq", "neq", "gte", "lte", "gt", "lt"], valueType: "number" },
  { field: "routeType", ops: ["eq", "neq"], valueType: "text" },
];

const REJECTED_FIELDS = ["driver.name", "appraiser.name", "helper.name", "container.name"];
const INCLUDE_OPS = new Set(["eq", "contains", "startsWith", "gte", "lte", "in"]);

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let json;
  try {
    json = JSON.parse(t);
  } catch {
    json = { raw: t };
  }
  return { status: r.status, json };
}

const ok = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const dataOf = (j) => (j && typeof j === "object" && "data" in j ? j.data : j);
const errOf = (res) =>
  String(res.json?.error ?? res.json?.message ?? res.json?.raw ?? "").slice(0, 140);

function extractId(json) {
  const d = dataOf(json);
  if (d && typeof d === "object" && !Array.isArray(d)) return d.id ?? d._id ?? null;
  if (typeof d === "number") return d;
  if (typeof d === "string" && d.trim()) return d.trim();
  return null;
}

function line(label, res, extra = "") {
  const pass = ok(res);
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${label.padEnd(22)} ${String(res.status).padEnd(4)} ${pass ? extra : errOf(res)}`);
  return pass;
}

function summarize(json) {
  if (json && typeof json === "object") {
    if (json.success === false) return String(json.error ?? json.message ?? "").slice(0, 120);
    return `rows=${Array.isArray(json.data) ? json.data.length : 0} subtotal=${json.subtotal ?? "-"} total=${json.total ?? "-"}`;
  }
  return String(json).slice(0, 120);
}

function countOf(json) {
  if (json && typeof json === "object") {
    if (typeof json.total === "number") return json.total;
    if (Array.isArray(json.data)) return json.data.length;
  }
  return 0;
}

function pickupSearchBody(filters, sort = [{ field: "date", direction: "desc" }]) {
  return {
    operator: "and",
    filters: [{ field: "routeType", operator: "eq", value: PICKUP_TYPE }, ...filters],
    sort,
  };
}

async function search(filters, label, extra = "") {
  const body = pickupSearchBody(filters);
  const res = await req("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, body);
  if (ok(res)) line(label, res, `${summarize(res.json)} ${extra}`.trim());
  else line(label, res);
  return res;
}

async function firstOne(path) {
  const r = await req("GET", `${path}?limit=3&page=1&offset=0`);
  return (Array.isArray(r.json?.data) ? r.json.data : [])[0] ?? null;
}

async function pickRefs() {
  const route = await firstOne("/routes");
  const employee = await firstOne("/employees");
  const branch = route?.branch ?? employee?.branch ?? { id: 1, code: "NY" };
  return { route, employee, branch };
}

function buildPickupWriteBody({ route, employee, branch, suffix = "", overrides = {} }) {
  const emp = employee
    ? { id: employee.id, name: employee.name ?? employee.fullName ?? `Emp ${employee.id}` }
    : { id: 1, name: "Probe Driver" };
  const routeRef = route
    ? { id: String(route.id ?? route._id), name: route.name ?? route.routeAssignmentId ?? "Probe Route" }
    : { id: "674a1b2c3d4e5f6789012345", name: "ZZ Probe Route" };

  return {
    routeType: PICKUP_TYPE,
    active: true,
    name: `ZZ_PROBE_PICKUP_${STAMP}${suffix}`,
    branch: {
      id: Number(branch.id ?? 1),
      code: String(branch.code ?? "NY"),
      ...(branch.name ? { name: String(branch.name) } : {}),
    },
    date: "2026-07-09T00:00:00Z",
    route: routeRef,
    employees: [{ id: emp.id, name: emp.name, role: "driver" }],
    driver: { id: emp.id, name: emp.name },
    ...overrides,
  };
}

function sampleForField(rec, field) {
  switch (field) {
    case "id":
      return rec.id ?? rec._id;
    case "name":
      return rec.name;
    case "date":
      return String(rec.date ?? "").slice(0, 10);
    case "route.name":
      return rec.route?.name;
    case "route.id":
      return rec.route?.id;
    case "employees.name":
      return rec.employees?.[0]?.name ?? rec.driver?.name;
    case "employees.id":
      return rec.employees?.[0]?.id ?? rec.driver?.id;
    case "employees.role":
      return rec.employees?.[0]?.role ?? "driver";
    case "branch.code":
      return rec.branch?.code;
    case "branch.id":
      return rec.branch?.id;
    case "branch.name":
      return rec.branch?.name;
    case "active":
      return rec.active !== false;
    case "dayOfWeek":
      return Array.isArray(rec.dayOfWeek) ? rec.dayOfWeek[0] : rec.dayOfWeek;
    case "rate":
      return rec.rate;
    case "routeType":
      return rec.routeType ?? rec.type ?? PICKUP_TYPE;
    default:
      return null;
  }
}

function buildFields(rec) {
  return ALLOWED_FILTER_FIELDS.map((entry) => ({
    ...entry,
    sample: sampleForField(rec, entry.field),
  })).filter((entry) => entry.sample != null && String(entry.sample) !== "");
}

async function runAuthAndList() {
  console.log("\n=== AUTH + LIST ===");
  const searchRes = await search([], "POST search (pickup only)");
  if (!ok(searchRes)) return null;

  const sample = Array.isArray(searchRes.json?.data) ? searchRes.json.data[0] : null;
  if (sample) {
    console.log("    sample keys:", Object.keys(sample).join(", "));
    const sid = sample.id ?? sample._id;
    if (sid) line("GET by id", await req("GET", `${RESOURCE}/${sid}`), `id=${sid} name=${sample.name ?? "-"}`);
  }

  const mixed = await req("GET", `${RESOURCE}?page=1&limit=5&offset=0`);
  line("GET list (mixed)", mixed, summarize(mixed.json));

  return sample;
}

async function runCrud() {
  console.log("\n=== CRUD (pickup vehicle-routes) ===");
  const { route, employee, branch } = await pickRefs();
  console.log(
    `    refs: route=${route ? route.id ?? route._id : "NONE"} employee=${employee ? employee.id : "NONE"} branch=${branch?.code ?? "-"}`,
  );

  let createdId = null;
  try {
    const body = buildPickupWriteBody({ route, employee, branch, suffix: "-CRUD" });
    const create = await req("POST", RESOURCE, body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`)) return;

    if (createdId == null) {
      const found = await search(
        [{ field: "name", operator: "eq", value: body.name }],
        "resolve id via search",
      );
      createdId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
      console.log(`    resolved created id: ${createdId ?? "?"}`);
      if (createdId == null) return;
    }

    line("READ(new)", await req("GET", `${RESOURCE}/${createdId}`), `id=${createdId}`);

    const updBody = {
      ...body,
      name: `${body.name}_EDIT`,
      active: false,
    };
    line("UPDATE", await req("PUT", `${RESOURCE}/${createdId}`, updBody));

    const readBack = await req("GET", `${RESOURCE}/${createdId}`);
    const rec = dataOf(readBack.json);
    line("VERIFY(edit)", readBack, `name=${rec?.name ?? "-"} active=${rec?.active}`);

    const del = await req("DELETE", `${RESOURCE}/${createdId}`);
    if (line("DELETE", del, `id=${createdId}`)) {
      const gone = await req("GET", `${RESOURCE}/${createdId}`);
      console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE         ${gone.status}`);
      createdId = null;
    }
  } finally {
    if (createdId != null) {
      console.log(`  [cleanup] delete ${createdId}: ${(await req("DELETE", `${RESOURCE}/${createdId}`)).status}`);
    }
  }
}

async function runQuickFilters(sample) {
  console.log("\n=== QUICK FILTERS (existing data) ===");
  await search([{ field: "active", operator: "eq", value: true }], "active eq true");
  await search([{ field: "active", operator: "eq", value: false }], "active eq false");

  if (sample?.branch?.id != null) {
    await search([{ field: "branch.id", operator: "eq", value: sample.branch.id }], `branch.id eq ${sample.branch.id}`);
  }
  if (sample?.route?.id) {
    await search([{ field: "route.id", operator: "eq", value: sample.route.id }], `route.id eq`);
  }

  await search(
    [
      { field: "date", operator: "gte", value: "2026-07-01" },
      { field: "date", operator: "lte", value: "2026-07-09" },
    ],
    "date range Jul 2026",
  );

  const bar = await req("POST", `${RESOURCE}/search?page=1&limit=3&offset=0`, {
    operator: "and",
    filters: [
      { field: "routeType", operator: "eq", value: PICKUP_TYPE },
      {
        operator: "or",
        filters: BAR_OR_SEARCH_FIELDS.map((field) => ({ field, operator: "contains", value: "a" })),
      },
    ],
    sort: [{ field: "date", direction: "desc" }],
  });
  line("OR bar contains 'a'", bar, summarize(bar.json));
}

async function runRejectedFields() {
  console.log("\n=== REJECTED FIELDS (expect 400) ===");
  for (const field of REJECTED_FIELDS) {
    const res = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, pickupSearchBody([
      { field, operator: "contains", value: "test" },
    ]));
    const rejected = res.status === 400 || res.json?.success === false;
    console.log(`  [${rejected ? "PASS" : "FAIL"}] ${field.padEnd(18)} ${res.status} ${errOf(res) || summarize(res.json)}`);
  }
}

async function runSeededFilters() {
  console.log("\n=== ADVANCED FILTERS — match-verified (seeded record) ===");
  const { route, employee, branch } = await pickRefs();
  let seedId = null;

  try {
    const body = buildPickupWriteBody({ route, employee, branch, suffix: "-SEED" });
    const create = await req("POST", RESOURCE, body);
    seedId = extractId(create.json);
    if (!ok(create)) {
      console.log(`  [FAIL] could not seed: ${create.status} ${errOf(create)}`);
      return;
    }
    if (seedId == null) {
      const found = await search([{ field: "name", operator: "eq", value: body.name }], "resolve seed id");
      seedId = Array.isArray(found.json?.data) ? extractId({ data: found.json.data[0] }) : null;
    }
    if (seedId == null) {
      console.log("  [FAIL] seeded but id unresolved");
      return;
    }

    const rec = dataOf((await req("GET", `${RESOURCE}/${seedId}`)).json);
    console.log(`  Seeded id=${seedId} name="${rec.name}" date="${rec.date}" route="${rec.route?.name ?? "-"}"`);
    console.log(`  (INCLUDE ops expect match; EXCLUDE ops neq/gt/lt expect no match)\n`);

    const results = [];
    for (const entry of buildFields(rec)) {
      for (const op of entry.ops) {
        const expectMatch = INCLUDE_OPS.has(op);
        let value = entry.sample;
        if (entry.field === "dayOfWeek" && (op === "in" || op === "notIn")) {
          value = Array.isArray(rec.dayOfWeek) ? rec.dayOfWeek : [String(value)];
        }
        const filterBody = pickupSearchBody([{ field: entry.field, operator: op, value }]);
        const { status, json } = await req("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, filterBody);
        const accepted = status >= 200 && status < 300 && json?.success !== false;
        const matched = countOf(json) > 0;
        const correct = accepted && (expectMatch ? matched : !matched);
        results.push({ field: entry.field, op, status, accepted, expectMatch, matched, correct, detail: summarize(json) });
        const verdict = correct ? "PASS" : accepted ? "MISS" : "FAIL";
        const want = expectMatch ? "match" : "none ";
        console.log(
          `  [${verdict}] ${entry.field.padEnd(18)} ${op.padEnd(11)} ${String(status).padEnd(4)} want=${want} got=${matched ? "match" : "none "} ${results.at(-1).detail}`,
        );
      }
    }

    const token = String(rec.name).split("_").find((w) => w.length >= 3) ?? "ZZ";
    const bar = await req("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, {
      operator: "and",
      filters: [
        { field: "routeType", operator: "eq", value: PICKUP_TYPE },
        {
          operator: "or",
          filters: BAR_OR_SEARCH_FIELDS.map((field) => ({ field, operator: "contains", value: token })),
        },
      ],
      sort: [{ field: "date", direction: "desc" }],
    });
    const barAccepted = bar.status >= 200 && bar.status < 300 && bar.json?.success !== false;
    const barMatched = countOf(bar.json) > 0;
    results.push({ field: "OR bar", op: "contains", correct: barAccepted && barMatched, accepted: barAccepted });

    console.log(
      `  [${barAccepted && barMatched ? "PASS" : barAccepted ? "MISS" : "FAIL"}] ${"OR bar search".padEnd(18)} ${"contains".padEnd(11)} ${String(bar.status).padEnd(4)} token="${token}" got=${barMatched ? "match" : "none "} ${summarize(bar.json)}`,
    );

    const correct = results.filter((r) => r.correct).length;
    const misses = results.filter((r) => r.accepted && !r.correct).length;
    const rejected = results.filter((r) => !r.accepted).length;
    console.log(`\n=== FILTER SUMMARY ===`);
    console.log(`Total combos      : ${results.length}`);
    console.log(`Correct           : ${correct}`);
    console.log(`Accepted but wrong: ${misses}`);
    console.log(`Rejected (4xx/5xx): ${rejected}`);
  } finally {
    if (seedId != null) {
      console.log(`\n  [cleanup] delete seeded ${seedId}: ${(await req("DELETE", `${RESOURCE}/${seedId}`)).status}`);
    }
  }
}

console.log("Pickup routes live probe (/vehicle-routes, routeType=pickup)");
console.log(`Base    : ${baseUrl}`);
console.log(`Company : ${companyId}`);
console.log(`Auth    : ${useBearer ? "Bearer" : "raw JWT"}`);
console.log(`Stamp   : ${STAMP}`);

const sample = await runAuthAndList();
if (!sample && !ok(await search([], "auth retry"))) {
  console.log("\nAuth failed. Token may be expired — refresh and retry.");
  process.exit(1);
}

await runQuickFilters(sample);
await runRejectedFields();

if (!skipCrud) {
  await runCrud();
  await runSeededFilters();
} else {
  console.log("\n[SKIP] CRUD + seeded filter matrix (EMSYS_SKIP_CRUD=1)");
}

console.log("\nDone.");
