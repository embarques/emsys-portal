#!/usr/bin/env node
/**
 * Smoke-test Roles API endpoints used by the portal.
 *
 * Swagger: https://api.embarqueros.com/swagger/index.html#/role
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   GET  /roles
 *   POST /roles
 *   POST /roles/search
 *   GET|PUT|DELETE /roles/{id}
 *   GET  /permissions  (prereq for role create)
 *
 * Usage:
 *   node scripts/test-roles-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-roles-api.mjs
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
const RESOURCE = "/roles";

/** Portal roles directory bar search fields. */
const ROLE_BAR_FIELDS = ["name", "createdBy.name", "updatedBy.name", "id"];

function printHelp() {
  console.log(`Usage:
  node scripts/test-roles-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-roles-api.mjs

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

function auditName(user) {
  if (!user) return null;
  if (typeof user === "string") return user.trim() || null;
  if (typeof user === "object") {
    return String(user.fullName ?? user.userName ?? user.name ?? "").trim() || null;
  }
  return null;
}

/** Portal search: pagination in URL; filters + sort in body. */
async function search(filters, label) {
  const body = {
    filters,
    sort: [{ field: "id", direction: "desc" }],
  };
  const res = await request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

console.log("Roles API smoke test");
console.log(`Swagger:  https://api.embarqueros.com/swagger/index.html#/role`);
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}\n`);

// ---------------------------------------------------------------------------
// Auth + list / read
// ---------------------------------------------------------------------------
console.log("=== List / read ===");
const list = await request("GET", `${RESOURCE}?page=1&offset=0&limit=40&sort=id:desc`);
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
    const perms = Array.isArray(read.json?.data?.permissions)
      ? read.json.data.permissions.length
      : 0;
    pass(
      `GET ${RESOURCE}/${sampleId}`,
      `name=${read.json?.data?.name ?? "?"} active=${read.json?.data?.active ?? "?"} permissions=${perms}`,
    );
  } else {
    fail(`GET ${RESOURCE}/${sampleId}`, read.status, errDetail(read));
  }
} else {
  note("No existing roles returned; read-by-id will run after create.");
}

// ---------------------------------------------------------------------------
// Search / filters
// ---------------------------------------------------------------------------
console.log("\n=== Search / filters ===");
const barTerm =
  typeof sample?.name === "string" && sample.name.length >= 1
    ? sample.name.slice(0, Math.min(3, sample.name.length))
    : "a";

await search(
  [
    {
      operator: "or",
      filters: ROLE_BAR_FIELDS.map((field) => ({
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
  await search(
    [{ field: "name", operator: "startsWith", value: String(sample.name).slice(0, 1) }],
    `search name startsWith ${String(sample.name).slice(0, 1)}`,
  );
}

await search([{ field: "active", operator: "eq", value: true }], "search active eq true");
await search([{ field: "active", operator: "eq", value: false }], "search active eq false");

if (sampleId != null) {
  await search(
    [{ field: "id", operator: "eq", value: Number(sampleId) }],
    `search id eq ${sampleId} (number)`,
  );
  await search(
    [{ field: "id", operator: "eq", value: String(sampleId) }],
    `search id eq "${sampleId}" (string)`,
  );
}

const createdBy = auditName(sample?.createdBy);
if (createdBy) {
  await search(
    [{ field: "createdBy.name", operator: "eq", value: createdBy }],
    `search createdBy.name eq ${createdBy}`,
  );
}

await search(
  [{ field: "permissions.name", operator: "contains", value: "a" }],
  "search permissions.name contains a",
);

// ---------------------------------------------------------------------------
// Permissions catalog (needed for role create)
// ---------------------------------------------------------------------------
let permissionId = null;
if (!opts.skipCrud) {
  console.log("\n=== Permissions prereq ===");
  const perms = await request("GET", "/permissions?page=1&limit=5&sort=id:asc");
  if (ok(perms)) {
    const first = firstOf(perms);
    permissionId = first?.id ?? first?._id ?? null;
    pass("GET /permissions", `count=${summarizeList(perms)} sampleId=${permissionId ?? "?"}`);
  } else {
    fail("GET /permissions", perms.status, errDetail(perms));
    // Fallback: reuse a permission id from an existing role.
    const fromRole = Array.isArray(sample?.permissions) ? sample.permissions[0]?.id : null;
    if (fromRole != null) {
      permissionId = fromRole;
      note(`Using permission id=${permissionId} from sample role.`);
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD lifecycle (throwaway ZZ_PROBE_* record, always cleaned up)
// ---------------------------------------------------------------------------
let createdId = null;
let createdName = `ZZ_PROBE_ROLE_${stamp}`;

if (!opts.skipCrud) {
  console.log("\n=== CRUD ===");
  if (permissionId == null) {
    note("Skipping role create (no permission id available).");
  } else {
    const createBody = {
      name: createdName,
      active: true,
      permissions: [{ id: Number(permissionId) }],
    };

    const create = await request("POST", RESOURCE, createBody);
    createdId = extractId(create.json);

    if (ok(create) && createdId == null) {
      const found = await search(
        [{ field: "name", operator: "eq", value: createdName }],
        "resolve created id via name search",
      );
      createdId = firstOf(found)?.id ?? null;
    }

    if (ok(create) && createdId != null) {
      pass(`POST ${RESOURCE}`, `id=${createdId} name=${createdName}`);

      const createdRead = await request("GET", `${RESOURCE}/${createdId}`);
      if (ok(createdRead)) pass(`GET ${RESOURCE}/${createdId} after create`);
      else {
        fail(
          `GET ${RESOURCE}/${createdId} after create`,
          createdRead.status,
          errDetail(createdRead),
        );
      }

      createdName = `${createdName}_UPD`;
      const update = await request("PUT", `${RESOURCE}/${createdId}`, {
        ...createBody,
        name: createdName,
        active: false,
      });
      if (ok(update)) pass(`PUT ${RESOURCE}/${createdId}`, `name=${createdName} active=false`);
      else fail(`PUT ${RESOURCE}/${createdId}`, update.status, errDetail(update));

      await search(
        [{ field: "name", operator: "eq", value: createdName }],
        `search name eq ${createdName}`,
      );
      await search(
        [
          { field: "name", operator: "eq", value: createdName },
          { field: "active", operator: "eq", value: false },
        ],
        "search finds inactive probe role",
      );
    } else {
      fail(`POST ${RESOURCE}`, create.status, errDetail(create));
    }
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

console.log("All role checks passed.");
