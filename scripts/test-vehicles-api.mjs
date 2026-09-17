#!/usr/bin/env node
/**
 * Smoke-test Vehicles API endpoints used by the portal.
 *
 * Swagger: https://api.embarqueros.com/swagger/index.html#/vehicle
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   GET  /vehicles
 *   POST /vehicles
 *   POST /vehicles/search
 *   GET|PUT|DELETE /vehicles/{id}
 *
 * Usage:
 *   node scripts/test-vehicles-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-vehicles-api.mjs
 *
 * Optional:
 *   --company <id>
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer
 *   --skip-crud
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";
const RESOURCE = "/vehicles";

/** Portal vehicles directory bar search fields. */
const VEHICLE_BAR_FIELDS = [
  "vehicleId",
  "name",
  "vin",
  "licensePlate",
  "fuelType",
  "branch.code",
  "createdBy.name",
];

function printHelp() {
  console.log(`Usage:
  node scripts/test-vehicles-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-vehicles-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
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

function branchCodeOf(sample) {
  if (!sample?.branch) return null;
  if (typeof sample.branch === "string") return sample.branch.trim() || null;
  return String(sample.branch.code ?? "").trim() || null;
}

/** Portal search: pagination in URL; filters + sort in body. */
async function search(filters, label) {
  const body = {
    filters,
    sort: [{ field: "name", direction: "asc" }],
  };
  const res = await request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

console.log("Vehicles API smoke test");
console.log(`Swagger:  https://api.embarqueros.com/swagger/index.html#/vehicle`);
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}\n`);

// ---------------------------------------------------------------------------
// Auth + list / read
// ---------------------------------------------------------------------------
console.log("=== List / read ===");
const list = await request("GET", `${RESOURCE}?page=1&offset=0&limit=40&sort=name:asc`);
if (!ok(list)) {
  fail(`GET ${RESOURCE} (auth check)`, list.status, errDetail(list));
  console.log("\nAuth failed. Refresh the temporary token and try again.");
  process.exit(1);
}
pass(`GET ${RESOURCE}`, summarizeList(list));

const sample = firstOf(list);
const sampleId = sample?.id ?? null;
if (sampleId != null) {
  const read = await request("GET", `${RESOURCE}/${sampleId}`);
  if (ok(read)) {
    pass(
      `GET ${RESOURCE}/${sampleId}`,
      `name=${read.json?.data?.name ?? "?"} vin=${read.json?.data?.vin ?? "?"}`,
    );
  } else {
    fail(`GET ${RESOURCE}/${sampleId}`, read.status, errDetail(read));
  }
} else {
  note("No existing vehicles returned; read-by-id will run after create.");
}

// ---------------------------------------------------------------------------
// Search / filters
// ---------------------------------------------------------------------------
console.log("\n=== Search / filters ===");
const barTerm =
  typeof sample?.name === "string" && sample.name.length >= 1
    ? sample.name.slice(0, Math.min(3, sample.name.length))
    : typeof sample?.vin === "string" && sample.vin.length >= 1
      ? sample.vin.slice(0, Math.min(4, sample.vin.length))
      : "a";

await search(
  [
    {
      operator: "or",
      filters: VEHICLE_BAR_FIELDS.map((field) => ({
        field,
        operator: "contains",
        value: barTerm,
      })),
    },
  ],
  `POST ${RESOURCE}/search bar OR ("${barTerm}")`,
);

if (sample?.name) {
  await search(
    [{ field: "name", operator: "eq", value: sample.name }],
    `search name eq ${sample.name}`,
  );
}

if (sample?.vin) {
  await search(
    [{ field: "vin", operator: "eq", value: sample.vin }],
    `search vin eq ${sample.vin}`,
  );
}

if (sample?.fuelType) {
  await search(
    [{ field: "fuelType", operator: "eq", value: sample.fuelType }],
    `search fuelType eq ${sample.fuelType}`,
  );
}

await search([{ field: "active", operator: "eq", value: true }], "search active eq true");

const branchCode = branchCodeOf(sample);
if (branchCode) {
  await search(
    [{ field: "branch.code", operator: "eq", value: branchCode }],
    `search branch.code eq ${branchCode}`,
  );
}

if (sample?.year != null && Number.isFinite(Number(sample.year))) {
  const year = Number(sample.year);
  await search(
    [{ field: "year", operator: "eq", value: year }],
    `search year eq ${year} (number)`,
  );
  await search(
    [{ field: "year", operator: "gte", value: String(year) }],
    `search year gte "${year}" (string)`,
  );
}

if (sample?.licensePlate) {
  await search(
    [{ field: "licensePlate", operator: "contains", value: String(sample.licensePlate).slice(0, 2) }],
    `search licensePlate contains ${String(sample.licensePlate).slice(0, 2)}`,
  );
}

if (sample?.createdBy?.name) {
  await search(
    [{ field: "createdBy.name", operator: "eq", value: sample.createdBy.name }],
    `search createdBy.name eq ${sample.createdBy.name}`,
  );
}

// ---------------------------------------------------------------------------
// CRUD lifecycle (throwaway ZZ_PROBE_* record, always cleaned up)
// ---------------------------------------------------------------------------
let createdId = null;
let createdName = `ZZ_PROBE_VEHICLE_${stamp}`;
let createdVin = `ZZPROBEVIN${stamp}`.toUpperCase();

if (!opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const createBody = {
    name: createdName,
    vin: createdVin,
    year: 2024,
    fuelType: "diesel",
    licensePlate: `ZZ${String(stamp).slice(-5)}`,
    active: true,
    branch: { id: 1, code: "NY", name: "USA" },
  };

  const create = await request("POST", RESOURCE, createBody);
  createdId = extractId(create.json);

  // Some creates return success without an embedded id — resolve via VIN search.
  if (ok(create) && createdId == null) {
    const found = await search(
      [{ field: "vin", operator: "eq", value: createdVin }],
      "resolve created id via vin search",
    );
    createdId = firstOf(found)?.id ?? null;
  }

  if (ok(create) && createdId != null) {
    pass(`POST ${RESOURCE}`, `id=${createdId} name=${createdName}`);

    const createdRead = await request("GET", `${RESOURCE}/${createdId}`);
    if (ok(createdRead)) {
      const code = createdRead.json?.data?.vehicleId;
      pass(
        `GET ${RESOURCE}/${createdId} after create`,
        code ? `vehicleId=${code}` : "",
      );
    } else {
      fail(
        `GET ${RESOURCE}/${createdId} after create`,
        createdRead.status,
        errDetail(createdRead),
      );
    }

    createdName = `${createdName}_UPD`;
    const update = await request("PUT", `${RESOURCE}/${createdId}`, {
      ...createBody,
      id: createdId,
      name: createdName,
      year: 2025,
      fuelType: "gas",
      active: true,
    });
    if (ok(update)) pass(`PUT ${RESOURCE}/${createdId}`, `name=${createdName} year=2025`);
    else fail(`PUT ${RESOURCE}/${createdId}`, update.status, errDetail(update));

    await search(
      [{ field: "vin", operator: "eq", value: createdVin }],
      `search vin eq ${createdVin}`,
    );
    await search(
      [{ field: "name", operator: "eq", value: createdName }],
      `search name eq ${createdName}`,
    );
  } else {
    fail(`POST ${RESOURCE}`, create.status, errDetail(create));
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
if (createdId != null) {
  console.log("\n=== Cleanup ===");
  const del = await request("DELETE", `${RESOURCE}/${createdId}`);
  if (ok(del)) pass(`DELETE ${RESOURCE}/${createdId}`);
  else fail(`DELETE ${RESOURCE}/${createdId}`, del.status, errDetail(del));

  const gone = await request("GET", `${RESOURCE}/${createdId}`);
  if (gone.status === 404) pass(`GET ${RESOURCE}/${createdId} after delete`, "404 as expected");
  else fail(`GET ${RESOURCE}/${createdId} after delete`, gone.status, "expected 404");
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

console.log("All vehicle checks passed.");
