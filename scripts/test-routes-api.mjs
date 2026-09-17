#!/usr/bin/env node
/**
 * Smoke-test Route crews + Daily routes API endpoints used by the portal.
 *
 * Swagger:
 *   https://api.embarqueros.com/swagger/index.html#/route
 *   https://api.embarqueros.com/swagger/index.html#/vehicle-route
 *
 * Portal mapping:
 *   Route crews  → GET/POST/PUT/DELETE /routes
 *   Daily routes → GET/POST/PUT/DELETE /vehicle-routes  (routeType: pickup|delivery)
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Usage:
 *   node scripts/test-routes-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-routes-api.mjs
 *
 * Optional:
 *   --company <id>
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer
 *   --skip-crud
 *   --skip-crews                   skip /routes
 *   --skip-daily                   skip /vehicle-routes
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_CREWS=1, EMSYS_SKIP_DAILY=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

/** Portal route-crew directory bar search. */
const CREW_BAR_FIELDS = ["name", "routeId", "branch.code", "employees.name"];

/** Portal daily-route directory bar search. */
const DAILY_BAR_FIELDS = [
  "name",
  "route.name",
  "employees.name",
  "container.number",
  "date",
  "tripNumber",
];

function printHelp() {
  console.log(`Usage:
  node scripts/test-routes-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-routes-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-crews              Skip /routes (route crews)
  --skip-daily              Skip /vehicle-routes (daily routes)
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
    skipCrews: process.env.EMSYS_SKIP_CREWS === "1",
    skipDaily: process.env.EMSYS_SKIP_DAILY === "1",
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
    } else if (arg === "--skip-crews") {
      opts.skipCrews = true;
    } else if (arg === "--skip-daily") {
      opts.skipDaily = true;
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

if (opts.skipCrews && opts.skipDaily) {
  console.error("Nothing to run: both --skip-crews and --skip-daily were set.");
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
const today = new Date().toISOString().slice(0, 10);
// Far-future probe date avoids colliding with real daily routes.
const probeDate = "2099-01-15";
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

function listOf(res) {
  return Array.isArray(res.json?.data) ? res.json.data : [];
}

async function search(path, filters, sortField, label, extraBody = {}) {
  const body = {
    ...extraBody,
    filters,
    sort: [{ field: sortField, direction: "desc" }],
  };
  const res = await request("POST", `${path}?page=1&limit=5&offset=0`, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

async function expectGone(path, label) {
  const gone = await request("GET", path);
  if (gone.status === 404) pass(`${label} after delete`, "404 as expected");
  else fail(`${label} after delete`, gone.status, "expected 404");
}

function normalizeBranch(raw) {
  const branch = raw ?? {};
  return {
    id: Number(branch.id) || 1,
    code: String(branch.code ?? "NY").trim() || "NY",
    name: String(branch.name ?? "USA").trim() || "USA",
  };
}

function employeeRef(emp) {
  return {
    id: Number(emp.id),
    name: String(emp.name ?? emp.fullName ?? `Emp ${emp.id}`).trim(),
  };
}

console.log("Route crews + daily routes API smoke test");
console.log(`Swagger:  route + vehicle-route tags`);
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Crews:    ${opts.skipCrews ? "skipped" : "enabled"}`);
console.log(`Daily:    ${opts.skipDaily ? "skipped" : "enabled"}\n`);

let createdCrewId = null;
let createdCrewName = null;
let createdCrewEmployees = [];
let createdCrewBranch = null;
let createdDailyId = null;

// Shared refs for CRUD
let employees = [];
let vehicles = [];
let existingCrew = null;

{
  const warm = await request("GET", "/routes?page=1&limit=1");
  if (!ok(warm) && warm.status === 401) {
    fail("GET /routes (auth check)", warm.status, errDetail(warm));
    console.log("\nAuth failed. Refresh the temporary token and try again.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Route crews (/routes)
// ---------------------------------------------------------------------------
if (!opts.skipCrews) {
  console.log("=== Route crews (/routes) ===");
  const list = await request("GET", "/routes?page=1&offset=0&limit=40&sort=name:asc");
  if (!ok(list)) {
    fail("GET /routes", list.status, errDetail(list));
  } else {
    pass("GET /routes", summarizeList(list));
    existingCrew = firstOf(list);
    if (existingCrew?.id) {
      const read = await request("GET", `/routes/${existingCrew.id}`);
      if (ok(read)) {
        pass(
          `GET /routes/${existingCrew.id}`,
          `name=${read.json?.data?.name ?? "?"} employees=${Array.isArray(read.json?.data?.employees) ? read.json.data.employees.length : 0}`,
        );
      } else {
        fail(`GET /routes/${existingCrew.id}`, read.status, errDetail(read));
      }
    } else {
      note("No existing route crews returned.");
    }
  }

  const barTerm =
    typeof existingCrew?.name === "string" && existingCrew.name.length >= 1
      ? existingCrew.name.slice(0, Math.min(3, existingCrew.name.length))
      : "a";

  await search(
    "/routes/search",
    [
      {
        operator: "or",
        filters: CREW_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: barTerm,
        })),
      },
    ],
    "name",
    `POST /routes/search bar OR ("${barTerm}")`,
  );

  await search(
    "/routes/search",
    [{ field: "active", operator: "eq", value: true }],
    "name",
    "search active eq true",
  );

  if (existingCrew?.branch?.code) {
    await search(
      "/routes/search",
      [{ field: "branch.code", operator: "eq", value: existingCrew.branch.code }],
      "name",
      `search branch.code eq ${existingCrew.branch.code}`,
    );
  }

  if (existingCrew?.employees?.[0]?.name) {
    await search(
      "/routes/search",
      [{ field: "employees.name", operator: "contains", value: existingCrew.employees[0].name }],
      "name",
      `search employees.name contains ${existingCrew.employees[0].name}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Daily routes (/vehicle-routes)
// ---------------------------------------------------------------------------
if (!opts.skipDaily) {
  console.log("\n=== Daily routes (/vehicle-routes) ===");
  const list = await request("GET", "/vehicle-routes?page=1&offset=0&limit=40&sort=date:desc");
  if (!ok(list)) {
    fail("GET /vehicle-routes", list.status, errDetail(list));
  } else {
    pass("GET /vehicle-routes", summarizeList(list));
    const sample = firstOf(list);
    if (sample?.id) {
      const read = await request("GET", `/vehicle-routes/${sample.id}`);
      if (ok(read)) {
        pass(
          `GET /vehicle-routes/${sample.id}`,
          `name=${read.json?.data?.name ?? "?"} type=${read.json?.data?.routeType ?? read.json?.data?.type ?? "?"}`,
        );
      } else {
        fail(`GET /vehicle-routes/${sample.id}`, read.status, errDetail(read));
      }
    } else {
      note("No existing daily routes returned.");
    }
  }

  const pickupSearch = await search(
    "/vehicle-routes/search",
    [{ field: "routeType", operator: "eq", value: "pickup" }],
    "date",
    "POST /vehicle-routes/search routeType=pickup",
  );
  const pickupSample = firstOf(pickupSearch);

  await search(
    "/vehicle-routes/search",
    [{ field: "routeType", operator: "eq", value: "delivery" }],
    "date",
    "POST /vehicle-routes/search routeType=delivery",
  );

  const barTerm =
    typeof pickupSample?.name === "string" && pickupSample.name.length >= 1
      ? pickupSample.name.slice(0, Math.min(3, pickupSample.name.length))
      : today.slice(0, 4);

  await search(
    "/vehicle-routes/search",
    [
      { field: "routeType", operator: "eq", value: "pickup" },
      {
        operator: "or",
        filters: DAILY_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: barTerm,
        })),
      },
    ],
    "date",
    `POST /vehicle-routes/search pickup bar OR ("${barTerm}")`,
  );

  await search(
    "/vehicle-routes/search",
    [
      { field: "routeType", operator: "eq", value: "pickup" },
      { field: "date", operator: "eq", value: today },
    ],
    "date",
    `search pickup date eq ${today}`,
  );

  if (pickupSample?.route?.id) {
    await search(
      "/vehicle-routes/search",
      [
        { field: "routeType", operator: "eq", value: "pickup" },
        { field: "route.id", operator: "eq", value: String(pickupSample.route.id) },
      ],
      "date",
      `search route.id eq ${pickupSample.route.id}`,
    );
  }

  if (pickupSample?.branch?.code) {
    await search(
      "/vehicle-routes/search",
      [
        { field: "routeType", operator: "eq", value: "pickup" },
        { field: "branch.code", operator: "eq", value: pickupSample.branch.code },
      ],
      "date",
      `search branch.code eq ${pickupSample.branch.code}`,
    );
  }
}

// ---------------------------------------------------------------------------
// CRUD prerequisites
// ---------------------------------------------------------------------------
if (!opts.skipCrud && (!opts.skipCrews || !opts.skipDaily)) {
  console.log("\n=== CRUD prerequisites ===");
  const empRes = await request("GET", "/employees?page=1&limit=10&sort=id:desc");
  employees = listOf(empRes).filter((e) => Number(e?.id) > 0);
  if (ok(empRes) && employees.length > 0) {
    pass("GET /employees", `count=${employees.length}`);
  } else {
    fail("GET /employees", empRes.status, errDetail(empRes) || "no employees");
  }

  const vehRes = await request("GET", "/vehicles?page=1&limit=5&sort=id:desc");
  vehicles = listOf(vehRes);
  if (ok(vehRes) && vehicles.length > 0) {
    pass("GET /vehicles", `id=${vehicles[0].id} name=${vehicles[0].name ?? ""}`);
  } else {
    note("No vehicles found; daily-route create requires a vehicle.");
  }

  if (!existingCrew && !opts.skipDaily) {
    const crewRes = await request("GET", "/routes?page=1&limit=5&sort=name:asc");
    existingCrew = firstOf(crewRes);
    if (ok(crewRes) && existingCrew?.id) {
      pass("GET /routes (prereq)", `id=${existingCrew.id}`);
    } else {
      note("No route crew available for daily-route create.");
    }
  }
}

// ---------------------------------------------------------------------------
// Route crew CRUD
// ---------------------------------------------------------------------------
if (!opts.skipCrud && !opts.skipCrews && employees.length > 0) {
  console.log("\n=== Route crew CRUD ===");
  // Unique employee set: take up to 2 employees; API rejects duplicate
  // branch + same employee id set. Using the newest employees reduces collisions.
  const crewEmps = employees.slice(0, Math.min(2, employees.length)).map(employeeRef);
  const branch = normalizeBranch(
    employees[0]?.branch ?? existingCrew?.branch ?? { id: 1, code: "NY", name: "USA" },
  );

  const createBody = {
    active: true,
    branch,
    employees: crewEmps,
  };

  const create = await request("POST", "/routes", createBody);
  createdCrewId = extractId(create.json);
  if (ok(create) && createdCrewId != null) {
    createdCrewEmployees = crewEmps;
    createdCrewBranch = branch;
    createdCrewName = create.json?.data?.name ?? "";
    pass(
      "POST /routes",
      `id=${createdCrewId} name=${createdCrewName || "(server)"} employees=${crewEmps.length}`,
    );

    const createdRead = await request("GET", `/routes/${createdCrewId}`);
    if (ok(createdRead)) {
      createdCrewName = createdRead.json?.data?.name ?? createdCrewName;
      pass(`GET /routes/${createdCrewId} after create`, createdCrewName);
    } else {
      fail(`GET /routes/${createdCrewId} after create`, createdRead.status, errDetail(createdRead));
    }

    const update = await request("PUT", `/routes/${createdCrewId}`, {
      ...createBody,
      active: true,
      ...(createdCrewName ? { name: createdCrewName } : {}),
    });
    if (ok(update)) pass(`PUT /routes/${createdCrewId}`);
    else fail(`PUT /routes/${createdCrewId}`, update.status, errDetail(update));
  } else {
    const detail = errDetail(create);
    // Duplicate crew (same branch + employee set) is a known business rule.
    if (/duplicate|already|same/i.test(detail) || create.status === 409) {
      note(`POST /routes skipped create conflict: ${detail || create.status}`);
      // Fall back to an existing crew for daily-route CRUD.
      if (existingCrew?.id) {
        createdCrewId = existingCrew.id;
        createdCrewName = existingCrew.name ?? "";
        createdCrewBranch = normalizeBranch(existingCrew.branch ?? branch);
        createdCrewEmployees = Array.isArray(existingCrew.employees)
          ? existingCrew.employees.map(employeeRef).filter((e) => e.id > 0)
          : crewEmps;
        note(`Using existing crew ${createdCrewId} for daily-route CRUD.`);
        // Do not delete existing crew in cleanup.
        createdCrewId = `KEEP:${createdCrewId}`;
      } else {
        fail("POST /routes", create.status, detail);
      }
    } else {
      fail("POST /routes", create.status, detail);
    }
  }
}

const usableCrewId =
  createdCrewId && String(createdCrewId).startsWith("KEEP:")
    ? String(createdCrewId).slice(5)
    : createdCrewId;
const shouldDeleteCrew = createdCrewId != null && !String(createdCrewId).startsWith("KEEP:");

// ---------------------------------------------------------------------------
// Daily route CRUD (pickup — no container required)
// ---------------------------------------------------------------------------
if (!opts.skipCrud && !opts.skipDaily) {
  console.log("\n=== Daily route CRUD (pickup) ===");

  const crewId = usableCrewId;
  const crewEmployees =
    createdCrewEmployees.length > 0
      ? createdCrewEmployees
      : Array.isArray(existingCrew?.employees)
        ? existingCrew.employees.map(employeeRef).filter((e) => e.id > 0)
        : employees.slice(0, 1).map(employeeRef);
  const branch = createdCrewBranch ?? normalizeBranch(existingCrew?.branch ?? employees[0]?.branch);
  const vehicle = vehicles[0];
  const fallbackCrew = existingCrew;

  if (!crewId && !fallbackCrew?.id) {
    note("Skipping daily-route create (no route crew available).");
  } else if (!vehicle?.id) {
    note("Skipping daily-route create (no vehicle available).");
  } else if (crewEmployees.length === 0) {
    note("Skipping daily-route create (no crew employees).");
  } else {
    const routeRef = {
      id: String(crewId ?? fallbackCrew.id),
      name: String(
        createdCrewName || fallbackCrew?.name || crewId || fallbackCrew.id,
      ),
    };
    const driver = crewEmployees[0];
    const appraiser = crewEmployees[1] ?? crewEmployees[0];

    const createBody = {
      routeType: "pickup",
      active: true,
      name: `ZZ_PROBE_DAILY_${stamp}`,
      branch,
      date: `${probeDate}T00:00:00Z`,
      route: routeRef,
      vehicle: {
        id: String(vehicle.id),
        name: String(vehicle.name ?? vehicle.id),
        ...(vehicle.branch?.code || vehicle.branch
          ? { branch: String(vehicle.branch?.code ?? vehicle.branch) }
          : {}),
      },
      // Daily-route employees must match the selected crew membership.
      employees: crewEmployees.map((emp, index) => ({
        id: emp.id,
        name: emp.name,
        role: index === 0 ? "driver" : index === 1 ? "appraiser" : "helper",
      })),
      driver: { id: driver.id, name: driver.name },
      appraiser: { id: appraiser.id, name: appraiser.name },
    };

    const create = await request("POST", "/vehicle-routes", createBody);
    createdDailyId = extractId(create.json);
    if (ok(create) && createdDailyId != null) {
      pass(
        "POST /vehicle-routes",
        `id=${createdDailyId} name=${create.json?.data?.name ?? createBody.name}`,
      );

      const createdRead = await request("GET", `/vehicle-routes/${createdDailyId}`);
      if (ok(createdRead)) pass(`GET /vehicle-routes/${createdDailyId} after create`);
      else {
        fail(
          `GET /vehicle-routes/${createdDailyId} after create`,
          createdRead.status,
          errDetail(createdRead),
        );
      }

      const update = await request("PUT", `/vehicle-routes/${createdDailyId}`, {
        ...createBody,
        name: `${createBody.name}_UPD`,
        active: true,
      });
      if (ok(update)) pass(`PUT /vehicle-routes/${createdDailyId}`);
      else fail(`PUT /vehicle-routes/${createdDailyId}`, update.status, errDetail(update));

      await search(
        "/vehicle-routes/search",
        [
          { field: "routeType", operator: "eq", value: "pickup" },
          { field: "route.id", operator: "eq", value: routeRef.id },
          { field: "date", operator: "eq", value: probeDate },
        ],
        "date",
        "search finds probe daily route",
      );
    } else {
      fail("POST /vehicle-routes", create.status, errDetail(create));
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup (daily route first, then throwaway crew)
// ---------------------------------------------------------------------------
if (createdDailyId != null || shouldDeleteCrew) {
  console.log("\n=== Cleanup ===");
}

if (createdDailyId != null) {
  const del = await request("DELETE", `/vehicle-routes/${createdDailyId}`);
  if (ok(del)) pass(`DELETE /vehicle-routes/${createdDailyId}`);
  else fail(`DELETE /vehicle-routes/${createdDailyId}`, del.status, errDetail(del));
  await expectGone(
    `/vehicle-routes/${createdDailyId}`,
    `GET /vehicle-routes/${createdDailyId}`,
  );
}

if (shouldDeleteCrew && usableCrewId) {
  const del = await request("DELETE", `/routes/${usableCrewId}`);
  if (ok(del)) pass(`DELETE /routes/${usableCrewId}`);
  else fail(`DELETE /routes/${usableCrewId}`, del.status, errDetail(del));
  await expectGone(`/routes/${usableCrewId}`, `GET /routes/${usableCrewId}`);
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

console.log("All route crew / daily route checks passed.");
