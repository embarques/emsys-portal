#!/usr/bin/env node
/**
 * Smoke-test Customers API endpoints used by the portal.
 *
 * Swagger: https://api.embarqueros.com/swagger/index.html#/customer
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   GET  /customers
 *   POST /customers
 *   POST /customers/search
 *   GET  /customers/autocomplete
 *   GET|PUT|DELETE /customers/{id}
 *
 * Usage:
 *   node scripts/test-customers-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-customers-api.mjs
 *
 * Optional:
 *   --company <id>
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer
 *   --skip-crud
 *   --skip-autocomplete
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_AUTOCOMPLETE=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

/** Portal customer directory bar search fields. */
const CUSTOMER_BAR_FIELDS = [
  "name",
  "phones.number",
  "phone1",
  "phone2",
  "addresses.address1",
  "addresses.address2",
  "addresses.apartment",
  "addresses.city",
  "addresses.state",
  "addresses.zipcode",
];

function printHelp() {
  console.log(`Usage:
  node scripts/test-customers-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-customers-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-autocomplete       Skip GET /customers/autocomplete
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
    skipAutocomplete: process.env.EMSYS_SKIP_AUTOCOMPLETE === "1",
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
    } else if (arg === "--skip-autocomplete") {
      opts.skipAutocomplete = true;
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
    sort: [{ field: "name", direction: "asc" }],
  };
  const res = await request("POST", "/customers/search?page=1&limit=5&offset=0", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

console.log("Customers API smoke test");
console.log(`Swagger:  https://api.embarqueros.com/swagger/index.html#/customer`);
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Autocomplete: ${opts.skipAutocomplete ? "skipped" : "enabled"}\n`);

// ---------------------------------------------------------------------------
// Auth + list / read
// ---------------------------------------------------------------------------
console.log("=== List / read ===");
const list = await request("GET", "/customers?page=1&offset=0&limit=40&sort=name:asc");
if (!ok(list)) {
  fail("GET /customers (auth check)", list.status, errDetail(list));
  console.log("\nAuth failed. Refresh the temporary token and try again.");
  process.exit(1);
}
pass("GET /customers", summarizeList(list));

const sample = firstOf(list);
const sampleId = sample?.id ?? null;
if (sampleId != null) {
  const read = await request("GET", `/customers/${sampleId}`);
  if (ok(read)) {
    pass(
      `GET /customers/${sampleId}`,
      `name=${read.json?.data?.name ?? "?"} type=${read.json?.data?.customerType ?? "?"}`,
    );
  } else {
    fail(`GET /customers/${sampleId}`, read.status, errDetail(read));
  }
} else {
  note("No existing customers returned; read-by-id will run after create.");
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
      filters: CUSTOMER_BAR_FIELDS.map((field) => ({
        field,
        operator: "contains",
        value: barTerm,
      })),
    },
  ],
  `POST /customers/search bar OR ("${barTerm}")`,
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

await search(
  [{ field: "customerType", operator: "eq", value: 1 }],
  "search customerType eq 1 (sender)",
);
await search(
  [{ field: "customerType", operator: "eq", value: 2 }],
  "search customerType eq 2 (receiver)",
);
await search([{ field: "active", operator: "eq", value: true }], "search active eq true");

if (sample?.branch?.code || sample?.branch?.id != null) {
  if (sample.branch?.code) {
    await search(
      [{ field: "branch.code", operator: "eq", value: sample.branch.code }],
      `search branch.code eq ${sample.branch.code}`,
    );
  }
  if (sample.branch?.id != null) {
    await search(
      [{ field: "branch.id", operator: "eq", value: Number(sample.branch.id) }],
      `search branch.id eq ${sample.branch.id}`,
    );
  }
}

const phoneSample =
  sample?.phones?.[0]?.number ?? sample?.phone1 ?? null;
if (phoneSample) {
  await search(
    [{ field: "phones.number", operator: "contains", value: String(phoneSample).slice(0, 3) }],
    `search phones.number contains ${String(phoneSample).slice(0, 3)}`,
  );
}

const citySample =
  sample?.addresses?.[0]?.city ?? sample?.address?.city ?? null;
if (citySample) {
  await search(
    [{ field: "addresses.city", operator: "eq", value: citySample }],
    `search addresses.city eq ${citySample}`,
  );
}

// ---------------------------------------------------------------------------
// Autocomplete (party pickers)
// ---------------------------------------------------------------------------
if (!opts.skipAutocomplete) {
  console.log("\n=== Autocomplete ===");
  const q = encodeURIComponent(barTerm);
  const ac = await request("GET", `/customers/autocomplete?q=${q}&limit=10`);
  if (ok(ac)) pass("GET /customers/autocomplete", summarizeList(ac));
  else fail("GET /customers/autocomplete", ac.status, errDetail(ac));

  const acSender = await request(
    "GET",
    `/customers/autocomplete?q=${q}&customerType=sender&limit=10`,
  );
  if (ok(acSender)) pass("GET /customers/autocomplete?customerType=sender", summarizeList(acSender));
  else fail("GET /customers/autocomplete?customerType=sender", acSender.status, errDetail(acSender));

  const acReceiver = await request(
    "GET",
    `/customers/autocomplete?q=${q}&customerType=1&limit=5`,
  );
  if (ok(acReceiver)) {
    pass("GET /customers/autocomplete?customerType=1", summarizeList(acReceiver));
  } else {
    fail(
      "GET /customers/autocomplete?customerType=1",
      acReceiver.status,
      errDetail(acReceiver),
    );
  }
}

// ---------------------------------------------------------------------------
// CRUD lifecycle (throwaway ZZ_PROBE_* record, always cleaned up)
// ---------------------------------------------------------------------------
let createdId = null;
let createdName = `ZZ_PROBE_CUSTOMER_${stamp}`;

if (!opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const createBody = {
    name: createdName,
    customerType: 1,
    phone1: "555-0100",
    phones: [{ number: "555-0100", type: "mobile", isPrimary: true }],
    active: true,
    branch: { id: 1, code: "NY", name: "USA" },
    email: `probe-${stamp}@example.com`,
    IDNumber: `PROBE-${stamp}`,
    notes: "API smoke test",
    addresses: [
      {
        address1: "1 Probe St",
        city: "Bronx",
        state: "NY",
        zipcode: "10451",
        country: "US",
        isPrimary: true,
      },
    ],
  };

  const create = await request("POST", "/customers", createBody);
  createdId = extractId(create.json);
  if (ok(create) && createdId != null) {
    pass("POST /customers", `id=${createdId} name=${createdName}`);

    const createdRead = await request("GET", `/customers/${createdId}`);
    if (ok(createdRead)) pass(`GET /customers/${createdId} after create`);
    else fail(`GET /customers/${createdId} after create`, createdRead.status, errDetail(createdRead));

    createdName = `${createdName}_UPD`;
    const updateBody = {
      ...createBody,
      id: createdId,
      name: createdName,
      phone1: "555-0199",
      phones: [
        { number: "555-0199", type: "mobile", isPrimary: true },
        { number: "555-0200", type: "business", isPrimary: false },
      ],
      phone2: "555-0200",
      notes: "API smoke test updated",
      addresses: [
        {
          address1: "2 Probe Ave",
          city: "Bronx",
          state: "NY",
          zipcode: "10452",
          country: "US",
          isPrimary: true,
        },
      ],
    };
    const update = await request("PUT", `/customers/${createdId}`, updateBody);
    if (ok(update)) pass(`PUT /customers/${createdId}`, createdName);
    else fail(`PUT /customers/${createdId}`, update.status, errDetail(update));

    await search(
      [{ field: "name", operator: "eq", value: createdName }],
      `search name eq ${createdName}`,
    );

    // Optional primary-phone endpoint.
    const primaryPhone = await request(
      "POST",
      `/customers/${createdId}/phones/primary`,
      { type: "mobile", number: "555-0199" },
    );
    if (ok(primaryPhone)) {
      pass(`POST /customers/${createdId}/phones/primary`);
    } else if (primaryPhone.status === 404 || primaryPhone.status === 405) {
      note(`phones/primary not available (HTTP ${primaryPhone.status}).`);
    } else {
      fail(
        `POST /customers/${createdId}/phones/primary`,
        primaryPhone.status,
        errDetail(primaryPhone),
      );
    }
  } else {
    fail("POST /customers", create.status, errDetail(create));
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
if (createdId != null) {
  console.log("\n=== Cleanup ===");
  const del = await request("DELETE", `/customers/${createdId}`);
  if (ok(del)) pass(`DELETE /customers/${createdId}`);
  else fail(`DELETE /customers/${createdId}`, del.status, errDetail(del));

  const gone = await request("GET", `/customers/${createdId}`);
  if (gone.status === 404) pass(`GET /customers/${createdId} after delete`, "404 as expected");
  else fail(`GET /customers/${createdId} after delete`, gone.status, "expected 404");
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

console.log("All customer checks passed.");
