#!/usr/bin/env node
/**
 * Smoke-test Containers API endpoints used by the portal.
 *
 * Swagger: https://api.embarqueros.com/swagger/index.html#/container
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   GET  /containers
 *   POST /containers
 *   POST /containers/search
 *   GET  /containers/stats/average-value
 *   GET|PUT|DELETE /containers/{id}
 *
 * Usage:
 *   node scripts/test-containers-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-containers-api.mjs
 *
 * Optional:
 *   --company <id>                 override X-Company-ID
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer                       prefix Authorization with "Bearer "
 *   --skip-crud                    read/search only (no create/update/delete)
 *   --skip-stats                   skip GET /containers/stats/average-value
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_STATS=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

/** Portal container directory bar search fields. */
const CONTAINER_BAR_FIELDS = [
  "name",
  "containerNumber",
  "booking",
  "sealNumber",
  "seal",
  "itn",
  "broker",
  "company",
  "id",
  "cost",
  "departureDate",
  "arrivalDate",
];

const STATS_PERIODS = ["7d", "30d", "3m", "6m", "1y"];

function printHelp() {
  console.log(`Usage:
  node scripts/test-containers-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-containers-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-stats              Skip average-value stats
  -h, --help                Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    token: (process.env.EMSYS_TOKEN ?? "").trim(),
    companyId: (process.env.EMSYS_COMPANY_ID ?? DEFAULT_COMPANY_ID).trim(),
    baseUrl: (process.env.EMSYS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    useBearer: process.env.EMSYS_AUTH_BEARER === "1",
    skipCrud: process.env.EMSYS_SKIP_CRUD === "1",
    skipStats: process.env.EMSYS_SKIP_STATS === "1",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--company") {
      opts.companyId = String(argv[++i] ?? "").trim();
    } else if (arg === "--base-url") {
      opts.baseUrl = String(argv[++i] ?? "").replace(/\/$/, "");
    } else if (arg === "--bearer") {
      opts.useBearer = true;
    } else if (arg === "--skip-crud") {
      opts.skipCrud = true;
    } else if (arg === "--skip-stats") {
      opts.skipStats = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!opts.token) {
      opts.token = arg.trim();
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return opts;
}

const opts = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error?.message ?? error));
    printHelp();
    process.exit(1);
  }
})();

if (opts.help) {
  printHelp();
  process.exit(0);
}

if (!opts.token) {
  console.error("Pass a temporary JWT as the first argument, or set EMSYS_TOKEN.");
  printHelp();
  process.exit(1);
}

if (!opts.companyId) {
  console.error("Company ID is empty. Pass --company <id> or set EMSYS_COMPANY_ID.");
  process.exit(1);
}

const authValue = opts.useBearer
  ? opts.token.toLowerCase().startsWith("bearer ")
    ? opts.token
    : `Bearer ${opts.token}`
  : opts.token.replace(/^Bearer\s+/i, "");

const headers = {
  accept: "application/json",
  Authorization: authValue,
  "X-Company-ID": opts.companyId,
  "Content-Type": "application/json",
};

const stamp = Date.now();
const results = { passed: [], failed: [], notes: [] };

function pass(label, detail = "") {
  results.passed.push({ label, detail });
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, status, detail = "") {
  results.failed.push({ label, status, detail });
  console.log(`  [FAIL] ${label} — HTTP ${status}${detail ? ` ${detail}` : ""}`);
}

function note(message) {
  results.notes.push(message);
  console.log(`  [NOTE] ${message}`);
}

async function request(method, path, body) {
  const response = await fetch(`${opts.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, json };
}

function ok(res) {
  return res.status >= 200 && res.status < 300 && res.json?.success !== false;
}

function errDetail(res) {
  return String(res.json?.error ?? res.json?.message ?? res.json?.raw ?? "").slice(0, 160);
}

function summarizeList(res) {
  const items = Array.isArray(res.json?.data) ? res.json.data.length : 0;
  return `total=${res.json?.total ?? "?"} subtotal=${res.json?.subtotal ?? "?"} items=${items}`;
}

function extractId(json) {
  const data = json?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data.id ?? data._id ?? null;
  }
  if (typeof data === "number" || typeof data === "string") return data;
  return null;
}

function firstOf(res) {
  return Array.isArray(res.json?.data) ? res.json.data[0] : null;
}

/** Portal search: pagination in URL; filters + sort in body. */
async function search(filters, label) {
  const body = {
    filters,
    sort: [{ field: "id", direction: "desc" }],
  };
  const res = await request("POST", "/containers/search?page=1&limit=5&offset=0", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

console.log("Containers API smoke test");
console.log(`Swagger:  https://api.embarqueros.com/swagger/index.html#/container`);
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Stats:    ${opts.skipStats ? "skipped" : "enabled"}\n`);

// ---------------------------------------------------------------------------
// Auth + list / read
// ---------------------------------------------------------------------------
console.log("=== List / read ===");
const list = await request("GET", "/containers?page=1&offset=0&limit=40&sort=id:desc");
if (!ok(list)) {
  fail("GET /containers (auth check)", list.status, errDetail(list));
  console.log("\nAuth failed. Refresh the temporary token and try again.");
  process.exit(1);
}
pass("GET /containers", summarizeList(list));

const sample = firstOf(list);
const sampleId = sample?.id ?? null;
if (sampleId != null) {
  const read = await request("GET", `/containers/${sampleId}`);
  if (ok(read)) {
    pass(
      `GET /containers/${sampleId}`,
      `name=${read.json?.data?.name ?? "?"} booking=${read.json?.data?.booking ?? "?"}`,
    );
  } else {
    fail(`GET /containers/${sampleId}`, read.status, errDetail(read));
  }
} else {
  note("No existing containers returned; read-by-id will run after create.");
}

// ---------------------------------------------------------------------------
// Search / filters (portal Containers directory)
// ---------------------------------------------------------------------------
console.log("\n=== Search / filters ===");
const barTerm =
  typeof sample?.name === "string" && sample.name.length >= 1
    ? sample.name.slice(0, Math.min(3, sample.name.length))
    : typeof sample?.company === "string" && sample.company.length >= 1
      ? sample.company.slice(0, Math.min(3, sample.company.length))
      : "1";

await search(
  [
    {
      operator: "or",
      filters: CONTAINER_BAR_FIELDS.map((field) => ({
        field,
        operator: "contains",
        value: barTerm,
      })),
    },
  ],
  `POST /containers/search bar OR ("${barTerm}")`,
);

if (sample?.name) {
  await search(
    [{ field: "name", operator: "eq", value: sample.name }],
    `search name eq ${sample.name}`,
  );
}

if (sample?.company) {
  await search(
    [{ field: "company", operator: "eq", value: sample.company }],
    `search company eq ${sample.company}`,
  );
}

if (sample?.booking) {
  await search(
    [{ field: "booking", operator: "contains", value: String(sample.booking).slice(0, 4) }],
    `search booking contains ${String(sample.booking).slice(0, 4)}`,
  );
}

if (sample?.containerNumber) {
  await search(
    [{ field: "containerNumber", operator: "eq", value: sample.containerNumber }],
    `search containerNumber eq ${sample.containerNumber}`,
  );
}

if (sampleId != null) {
  await search(
    [{ field: "id", operator: "eq", value: Number(sampleId) }],
    `search id eq ${sampleId}`,
  );
}

const monthStart = new Date();
monthStart.setUTCDate(1);
monthStart.setUTCHours(0, 0, 0, 0);
const monthEnd = new Date(monthStart);
monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
monthEnd.setUTCDate(0);
const gte = monthStart.toISOString().slice(0, 10);
const lte = monthEnd.toISOString().slice(0, 10);
await search(
  [
    {
      operator: "and",
      filters: [
        { field: "departureDate", operator: "gte", value: gte },
        { field: "departureDate", operator: "lte", value: lte },
      ],
    },
  ],
  `search departureDate range ${gte}..${lte}`,
);

// ---------------------------------------------------------------------------
// Average merchandise value KPI
// ---------------------------------------------------------------------------
if (!opts.skipStats) {
  console.log("\n=== Stats: average-value ===");
  for (const period of STATS_PERIODS) {
    const stats = await request(
      "GET",
      `/containers/stats/average-value?period=${period}`,
    );
    if (ok(stats)) {
      const data = stats.json?.data ?? {};
      pass(
        `GET /containers/stats/average-value?period=${period}`,
        `avg=${data.average ?? "?"} prev=${data.previousAverage ?? "?"} count=${data.containerCount ?? "?"}`,
      );
    } else {
      fail(
        `GET /containers/stats/average-value?period=${period}`,
        stats.status,
        errDetail(stats),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD lifecycle (throwaway ZZ_PROBE_* record, always cleaned up)
// ---------------------------------------------------------------------------
let createdId = null;

if (!opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const depart = new Date();
  depart.setUTCDate(depart.getUTCDate() - 7);
  const arrive = new Date();
  arrive.setUTCDate(arrive.getUTCDate() + 7);

  const createBody = {
    name: `ZZ_PROBE_${stamp}`,
    booking: `BK-${stamp}`,
    containerNumber: `PROBE${String(stamp).slice(-7)}`,
    sealNumber: `SEAL-${stamp}`,
    itn: `ITN-${stamp}`,
    broker: "Probe Broker",
    company: "Probe Co",
    cost: 1234.56,
    departureDate: depart.toISOString(),
    arrivalDate: arrive.toISOString(),
  };

  const create = await request("POST", "/containers", createBody);
  createdId = extractId(create.json);
  if (ok(create) && createdId != null) {
    pass("POST /containers", `id=${createdId} name=${createBody.name}`);

    const createdRead = await request("GET", `/containers/${createdId}`);
    if (ok(createdRead)) {
      pass(
        `GET /containers/${createdId} after create`,
        `booking=${createdRead.json?.data?.booking ?? "?"}`,
      );
    } else {
      fail(
        `GET /containers/${createdId} after create`,
        createdRead.status,
        errDetail(createdRead),
      );
    }

    const updateBody = {
      id: Number(createdId),
      name: createBody.name,
      booking: `${createBody.booking}-UPD`,
      containerNumber: createBody.containerNumber,
      sealNumber: `${createBody.sealNumber}-2`,
      itn: createBody.itn,
      broker: "Probe Broker Updated",
      company: "Probe Co Updated",
      cost: 1500,
      departureDate: createBody.departureDate,
      arrivalDate: createBody.arrivalDate,
    };
    const update = await request("PUT", `/containers/${createdId}`, updateBody);
    if (ok(update)) {
      pass(
        `PUT /containers/${createdId}`,
        `booking=${update.json?.data?.booking ?? updateBody.booking}`,
      );
    } else {
      fail(`PUT /containers/${createdId}`, update.status, errDetail(update));
    }

    const found = await search(
      [{ field: "name", operator: "eq", value: createBody.name }],
      `search name eq ${createBody.name}`,
    );
    const foundId = Array.isArray(found.json?.data) ? found.json.data[0]?.id : null;
    if (String(foundId) === String(createdId)) pass("search finds created container");
    else note(`search after update returned id=${foundId}`);
  } else {
    fail("POST /containers", create.status, errDetail(create));
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
if (createdId != null) {
  console.log("\n=== Cleanup ===");
  const del = await request("DELETE", `/containers/${createdId}`);
  if (ok(del)) pass(`DELETE /containers/${createdId}`);
  else fail(`DELETE /containers/${createdId}`, del.status, errDetail(del));

  const gone = await request("GET", `/containers/${createdId}`);
  if (gone.status === 404) pass(`GET /containers/${createdId} after delete`, "404 as expected");
  else fail(`GET /containers/${createdId} after delete`, gone.status, "expected 404");
}

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
if (results.notes.length) {
  console.log("Notes:");
  for (const entry of results.notes) console.log(`  - ${entry}`);
}
if (results.failed.length) {
  console.log("Failures:");
  for (const entry of results.failed) {
    console.log(`  - ${entry.label}: ${entry.status} ${entry.detail}`);
  }
  process.exit(1);
}

console.log("All container checks passed.");
