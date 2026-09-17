#!/usr/bin/env node
/**
 * Smoke-test User Activity (Admin audit log) API endpoints.
 *
 * Portal is a read-only consumer — activities are written by the API on mutations.
 * Swagger: https://api.embarqueros.com/swagger/index.html#/user_activity
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   GET  /user-activities
 *   POST /user-activities/search
 *   Confirms write endpoints are not available (read-only)
 *
 * Usage:
 *   node scripts/test-user-activities-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-user-activities-api.mjs
 *
 * Optional:
 *   --company <id>
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer
 *   --skip-readonly-check          skip POST rejection check
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_READONLY_CHECK=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";
const RESOURCE = "/user-activities";

/** Portal User Activity directory bar search fields. */
const ACTIVITY_BAR_FIELDS = [
  "description",
  "origin",
  "id",
  "user.name",
  "severity",
];

const SEVERITIES = ["common", "uncommon", "rare"];

function printHelp() {
  console.log(`Usage:
  node scripts/test-user-activities-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-user-activities-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-readonly-check     Skip write-rejection check
  -h, --help                Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    token: (process.env.EMSYS_TOKEN ?? "").trim(),
    companyId: (process.env.EMSYS_COMPANY_ID ?? DEFAULT_COMPANY_ID).trim(),
    baseUrl: (process.env.EMSYS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    useBearer: process.env.EMSYS_AUTH_BEARER === "1",
    skipReadonlyCheck: process.env.EMSYS_SKIP_READONLY_CHECK === "1",
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
    } else if (arg === "--skip-readonly-check") {
      opts.skipReadonlyCheck = true;
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

function firstOf(res) {
  return Array.isArray(res.json?.data) ? res.json.data[0] : null;
}

function auditName(user) {
  if (!user) return null;
  if (typeof user === "string") return user.trim() || null;
  if (typeof user === "object") {
    return String(user.fullName ?? user.userName ?? user.name ?? user.email ?? "").trim() || null;
  }
  return null;
}

/** Portal search: pagination in URL; filters + sort in body. */
async function search(filters, label) {
  const body = {
    filters,
    sort: [{ field: "timestamp", direction: "desc" }],
  };
  const res = await request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

function summarizeSample(row) {
  if (!row) return "";
  const user = auditName(row.user) ?? "?";
  return `origin=${row.origin ?? "?"} severity=${row.severity ?? "?"} user=${user} id=${row.id ?? row.entityId ?? "?"}`;
}

console.log("User Activity (Admin audit) API smoke test");
console.log(`Swagger:  https://api.embarqueros.com/swagger/index.html#/user_activity`);
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`Mode:     read-only (API writes activities on mutations)\n`);

// ---------------------------------------------------------------------------
// Auth + list
// ---------------------------------------------------------------------------
console.log("=== List ===");
const list = await request(
  "GET",
  `${RESOURCE}?page=1&offset=0&limit=40&sort=timestamp:desc`,
);
if (!ok(list)) {
  fail(`GET ${RESOURCE} (auth check)`, list.status, errDetail(list));
  if (list.status === 403) {
    console.log("\nForbidden — need canViewUserActivity (Administrador).");
  } else {
    console.log("\nAuth failed. Refresh the temporary token and try again.");
  }
  process.exit(1);
}
pass(`GET ${RESOURCE}`, summarizeList(list));

const sample = firstOf(list);
if (sample) {
  pass("sample activity shape", summarizeSample(sample));
  const keys = Object.keys(sample);
  const expected = ["timestamp", "description", "origin", "severity"];
  const missing = expected.filter((key) => !keys.includes(key));
  if (missing.length === 0) pass("sample has core fields", expected.join(", "));
  else note(`sample missing core fields: ${missing.join(", ")} (keys=${keys.join(",")})`);

  // Document key should not collide with entity id conceptually.
  if (sample._id || sample.activityId) {
    pass(
      "document key present",
      `_id=${sample._id ?? "—"} activityId=${sample.activityId ?? "—"}`,
    );
  } else {
    note("No _id/activityId on sample; portal may synthesize activityId.");
  }
} else {
  note("No activities returned yet (empty tenant log). Search checks still run.");
}

// ---------------------------------------------------------------------------
// Search / filters
// ---------------------------------------------------------------------------
console.log("\n=== Search / filters ===");
const barTerm =
  typeof sample?.description === "string" && sample.description.length >= 1
    ? sample.description.slice(0, Math.min(4, sample.description.length))
    : typeof sample?.origin === "string" && sample.origin.length >= 1
      ? sample.origin.slice(0, Math.min(4, sample.origin.length))
      : "a";

await search(
  [
    {
      operator: "or",
      filters: ACTIVITY_BAR_FIELDS.map((field) => ({
        field,
        operator: "contains",
        value: barTerm,
      })),
    },
  ],
  `POST ${RESOURCE}/search bar OR ("${barTerm}")`,
);

if (sample?.origin) {
  await search(
    [{ field: "origin", operator: "eq", value: sample.origin }],
    `search origin eq ${sample.origin}`,
  );
}

if (sample?.description) {
  await search(
    [
      {
        field: "description",
        operator: "contains",
        value: String(sample.description).slice(0, Math.min(8, sample.description.length)),
      },
    ],
    "search description contains",
  );
}

for (const severity of SEVERITIES) {
  await search(
    [{ field: "severity", operator: "eq", value: severity }],
    `search severity eq ${severity}`,
  );
}

const userName = auditName(sample?.user);
if (userName) {
  await search(
    [{ field: "user.name", operator: "eq", value: userName }],
    `search user.name eq ${userName}`,
  );
  await search(
    [{ field: "user.name", operator: "contains", value: userName.slice(0, 2) }],
    `search user.name contains ${userName.slice(0, 2)}`,
  );
}

if (sample?.id != null && sample.id !== "") {
  await search(
    [{ field: "id", operator: "eq", value: sample.id }],
    `search entity id eq ${sample.id}`,
  );
}

const ts = String(sample?.timestamp ?? sample?.createdAt ?? "").slice(0, 10);
if (ts) {
  await search(
    [
      {
        operator: "and",
        filters: [
          { field: "timestamp", operator: "gte", value: ts },
          { field: "timestamp", operator: "lte", value: ts },
        ],
      },
    ],
    `search timestamp range ${ts}`,
  );
} else {
  const today = new Date().toISOString().slice(0, 10);
  await search(
    [
      {
        operator: "and",
        filters: [
          { field: "timestamp", operator: "gte", value: today },
          { field: "timestamp", operator: "lte", value: today },
        ],
      },
    ],
    `search timestamp = today (${today})`,
  );
}

if (sample?.origin && sample?.severity) {
  await search(
    [
      { field: "origin", operator: "eq", value: sample.origin },
      { field: "severity", operator: "eq", value: sample.severity },
    ],
    "combined AND origin + severity",
  );
}

// ---------------------------------------------------------------------------
// Read-only check (portal must not create activities)
// ---------------------------------------------------------------------------
if (!opts.skipReadonlyCheck) {
  console.log("\n=== Read-only check ===");
  const createAttempt = await request("POST", RESOURCE, {
    description: "ZZ_PROBE should not create",
    origin: "probe",
    severity: "common",
  });
  if (
    createAttempt.status === 404 ||
    createAttempt.status === 405 ||
    createAttempt.status === 403 ||
    createAttempt.status === 501
  ) {
    pass(`POST ${RESOURCE} rejected`, `HTTP ${createAttempt.status} as expected (read-only)`);
  } else if (ok(createAttempt)) {
    fail(
      `POST ${RESOURCE} rejected`,
      createAttempt.status,
      "expected reject; user-activities are API-written only",
    );
    // Best-effort: do not try to delete — there is no documented delete endpoint.
    note("Unexpected create succeeded; inspect API — portal contract is read-only.");
  } else {
    note(`POST ${RESOURCE} returned HTTP ${createAttempt.status} (treated as non-writable).`);
  }
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

console.log("All user-activity checks passed.");
