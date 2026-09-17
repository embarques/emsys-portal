#!/usr/bin/env node
/**
 * Smoke-test Employee API endpoints used by the portal:
 *   employees, employee-departments, employee-titles
 *
 * Swagger:
 *   https://api.embarqueros.com/swagger/index.html#/employee
 *   https://api.embarqueros.com/swagger/index.html#/employee_department
 *   https://api.embarqueros.com/swagger/index.html#/employee_title
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   /employee-departments[+ /search /{id}]
 *   /employee-titles[+ /search /{id}]
 *   /employees[+ /search /{id}]
 *
 * CRUD creates throwaway ZZ_PROBE_* records, then cleans them up
 * (employee first, then title, then department).
 *
 * Usage:
 *   node scripts/test-employees-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-employees-api.mjs
 *
 * Optional:
 *   --company <id>                 override X-Company-ID
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer                       prefix Authorization with "Bearer "
 *   --skip-crud                    read/search only
 *   --skip-departments
 *   --skip-titles
 *   --skip-employees
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_DEPARTMENTS=1, EMSYS_SKIP_TITLES=1
 *   EMSYS_SKIP_EMPLOYEES=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

const DEPARTMENT_BAR_FIELDS = ["name"];
const TITLE_BAR_FIELDS = ["name"];
const EMPLOYEE_BAR_FIELDS = [
  "name",
  "title",
  "department",
  "email",
  "phones.number",
  "address.address1",
  "address.address2",
  "address.apartment",
  "address.city",
  "address.state",
  "address.zipcode",
  "address.country",
  "branch.code",
];

function printHelp() {
  console.log(`Usage:
  node scripts/test-employees-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-employees-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-departments        Skip /employee-departments
  --skip-titles             Skip /employee-titles
  --skip-employees          Skip /employees
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
    skipDepartments: process.env.EMSYS_SKIP_DEPARTMENTS === "1",
    skipTitles: process.env.EMSYS_SKIP_TITLES === "1",
    skipEmployees: process.env.EMSYS_SKIP_EMPLOYEES === "1",
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
    } else if (arg === "--skip-departments") {
      opts.skipDepartments = true;
    } else if (arg === "--skip-titles") {
      opts.skipTitles = true;
    } else if (arg === "--skip-employees") {
      opts.skipEmployees = true;
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

if (opts.skipDepartments && opts.skipTitles && opts.skipEmployees) {
  console.error("Nothing to run: all resource sections were skipped.");
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

async function search(path, filters, sortField, label) {
  const body = {
    filters,
    sort: [{ field: sortField, direction: "asc" }],
  };
  const res = await request("POST", `${path}?page=1&limit=5&offset=0`, body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

async function listAndRead(basePath, sort, labelPrefix) {
  const list = await request("GET", `${basePath}?page=1&offset=0&limit=40&sort=${sort}`);
  if (!ok(list)) {
    fail(`GET ${basePath}`, list.status, errDetail(list));
    return { list, sample: null };
  }
  pass(`GET ${basePath}`, summarizeList(list));
  const sample = firstOf(list);
  if (sample?.id != null) {
    const read = await request("GET", `${basePath}/${sample.id}`);
    if (ok(read)) pass(`GET ${basePath}/${sample.id}`, labelPrefix?.(read.json?.data) ?? "");
    else fail(`GET ${basePath}/${sample.id}`, read.status, errDetail(read));
  } else {
    note(`No existing records on ${basePath}.`);
  }
  return { list, sample };
}

async function expectGone(path, label) {
  const gone = await request("GET", path);
  if (gone.status === 404) pass(`${label} after delete`, "404 as expected");
  else fail(`${label} after delete`, gone.status, "expected 404");
}

/** Employees historically accept client-assigned ids (maxId+1). */
async function nextId(resourcePath) {
  const res = await request("POST", `${resourcePath}/search?page=1&limit=1&offset=0`, {
    sort: [{ field: "id", direction: "desc" }],
    filters: [],
  });
  const top = firstOf(res);
  const max = Number(top?.id);
  return Number.isFinite(max) && max > 0 ? max + 1 : 1;
}

console.log("Employees API smoke test (employees / departments / titles)");
console.log(`Swagger:      https://api.embarqueros.com/swagger/index.html#/employee`);
console.log(`Base:         ${opts.baseUrl}`);
console.log(`Company:      ${opts.companyId}`);
console.log(`Auth:         ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:         ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Departments:  ${opts.skipDepartments ? "skipped" : "enabled"}`);
console.log(`Titles:       ${opts.skipTitles ? "skipped" : "enabled"}`);
console.log(`Employees:    ${opts.skipEmployees ? "skipped" : "enabled"}\n`);

let createdDepartmentId = null;
let createdTitleId = null;
let createdEmployeeId = null;
let probeDepartmentName = `ZZ_PROBE_DEPT_${stamp}`;
let probeTitleName = `ZZ_PROBE_TITLE_${stamp}`;
let probeEmployeeName = `ZZ_PROBE_EMP_${stamp}`;

// Auth warm-up
{
  const warm = await request("GET", "/employees?page=1&limit=1");
  if (!ok(warm) && warm.status === 401) {
    fail("GET /employees (auth check)", warm.status, errDetail(warm));
    console.log("\nAuth failed. Refresh the temporary token and try again.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Employee departments
// ---------------------------------------------------------------------------
if (!opts.skipDepartments) {
  console.log("=== Employee departments ===");
  const { sample } = await listAndRead(
    "/employee-departments",
    "name:asc",
    (data) => `name=${data?.name ?? "?"} active=${data?.active ?? "?"}`,
  );

  const barTerm =
    typeof sample?.name === "string" && sample.name.length >= 1
      ? sample.name.slice(0, Math.min(3, sample.name.length))
      : "a";

  await search(
    "/employee-departments/search",
    [
      {
        operator: "or",
        filters: DEPARTMENT_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: barTerm,
        })),
      },
    ],
    "name",
    `POST /employee-departments/search bar OR ("${barTerm}")`,
  );

  if (sample?.name) {
    await search(
      "/employee-departments/search",
      [{ field: "name", operator: "eq", value: sample.name }],
      "name",
      `search name eq ${sample.name}`,
    );
  }

  if (sample?.id != null) {
    await search(
      "/employee-departments/search",
      [{ field: "id", operator: "eq", value: Number(sample.id) }],
      "name",
      `search id eq ${sample.id}`,
    );
  }

  if (typeof sample?.active === "boolean") {
    await search(
      "/employee-departments/search",
      [{ field: "active", operator: "eq", value: sample.active }],
      "name",
      `search active eq ${sample.active}`,
    );
  }

  if (!opts.skipCrud) {
    const create = await request("POST", "/employee-departments", {
      name: probeDepartmentName,
      active: true,
    });
    createdDepartmentId = extractId(create.json);

    if (ok(create) && createdDepartmentId == null) {
      const found = await search(
        "/employee-departments/search",
        [{ field: "name", operator: "eq", value: probeDepartmentName }],
        "name",
        "resolve created department id via name search",
      );
      createdDepartmentId = firstOf(found)?.id ?? null;
    }

    if (ok(create) && createdDepartmentId != null) {
      pass("POST /employee-departments", `id=${createdDepartmentId} name=${probeDepartmentName}`);

      const createdRead = await request("GET", `/employee-departments/${createdDepartmentId}`);
      if (ok(createdRead)) pass(`GET /employee-departments/${createdDepartmentId} after create`);
      else {
        fail(
          `GET /employee-departments/${createdDepartmentId} after create`,
          createdRead.status,
          errDetail(createdRead),
        );
      }

      probeDepartmentName = `${probeDepartmentName}_UPD`;
      const update = await request("PUT", `/employee-departments/${createdDepartmentId}`, {
        name: probeDepartmentName,
        active: true,
      });
      if (ok(update)) pass(`PUT /employee-departments/${createdDepartmentId}`, probeDepartmentName);
      else {
        fail(
          `PUT /employee-departments/${createdDepartmentId}`,
          update.status,
          errDetail(update),
        );
      }

      await search(
        "/employee-departments/search",
        [{ field: "name", operator: "eq", value: probeDepartmentName }],
        "name",
        `search name eq ${probeDepartmentName}`,
      );
    } else {
      fail("POST /employee-departments", create.status, errDetail(create));
    }
  }
}

// ---------------------------------------------------------------------------
// Employee titles
// ---------------------------------------------------------------------------
if (!opts.skipTitles) {
  console.log("\n=== Employee titles ===");
  const { sample } = await listAndRead(
    "/employee-titles",
    "name:asc",
    (data) => `name=${data?.name ?? "?"} active=${data?.active ?? "?"}`,
  );

  const barTerm =
    typeof sample?.name === "string" && sample.name.length >= 1
      ? sample.name.slice(0, Math.min(3, sample.name.length))
      : "a";

  await search(
    "/employee-titles/search",
    [
      {
        operator: "or",
        filters: TITLE_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: barTerm,
        })),
      },
    ],
    "name",
    `POST /employee-titles/search bar OR ("${barTerm}")`,
  );

  if (sample?.name) {
    await search(
      "/employee-titles/search",
      [{ field: "name", operator: "eq", value: sample.name }],
      "name",
      `search name eq ${sample.name}`,
    );
  }

  if (sample?.id != null) {
    await search(
      "/employee-titles/search",
      [{ field: "id", operator: "eq", value: Number(sample.id) }],
      "name",
      `search id eq ${sample.id}`,
    );
  }

  if (typeof sample?.active === "boolean") {
    await search(
      "/employee-titles/search",
      [{ field: "active", operator: "eq", value: sample.active }],
      "name",
      `search active eq ${sample.active}`,
    );
  }

  if (!opts.skipCrud) {
    const create = await request("POST", "/employee-titles", {
      name: probeTitleName,
      active: true,
    });
    createdTitleId = extractId(create.json);

    if (ok(create) && createdTitleId == null) {
      const found = await search(
        "/employee-titles/search",
        [{ field: "name", operator: "eq", value: probeTitleName }],
        "name",
        "resolve created title id via name search",
      );
      createdTitleId = firstOf(found)?.id ?? null;
    }

    if (ok(create) && createdTitleId != null) {
      pass("POST /employee-titles", `id=${createdTitleId} name=${probeTitleName}`);

      const createdRead = await request("GET", `/employee-titles/${createdTitleId}`);
      if (ok(createdRead)) pass(`GET /employee-titles/${createdTitleId} after create`);
      else {
        fail(
          `GET /employee-titles/${createdTitleId} after create`,
          createdRead.status,
          errDetail(createdRead),
        );
      }

      probeTitleName = `${probeTitleName}_UPD`;
      const update = await request("PUT", `/employee-titles/${createdTitleId}`, {
        name: probeTitleName,
        active: true,
      });
      if (ok(update)) pass(`PUT /employee-titles/${createdTitleId}`, probeTitleName);
      else fail(`PUT /employee-titles/${createdTitleId}`, update.status, errDetail(update));

      await search(
        "/employee-titles/search",
        [{ field: "name", operator: "eq", value: probeTitleName }],
        "name",
        `search name eq ${probeTitleName}`,
      );
    } else {
      fail("POST /employee-titles", create.status, errDetail(create));
    }
  }
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------
if (!opts.skipEmployees) {
  console.log("\n=== Employees ===");
  const { sample } = await listAndRead(
    "/employees",
    "name:asc",
    (data) =>
      `name=${data?.name ?? "?"} title=${data?.title ?? "?"} dept=${data?.department ?? "?"} active=${data?.active ?? "?"}`,
  );

  const barTerm =
    typeof sample?.name === "string" && sample.name.length >= 1
      ? sample.name.slice(0, Math.min(3, sample.name.length))
      : "a";

  await search(
    "/employees/search",
    [
      {
        operator: "or",
        filters: EMPLOYEE_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: barTerm,
        })),
      },
    ],
    "name",
    `POST /employees/search bar OR ("${barTerm}")`,
  );

  if (sample?.name) {
    await search(
      "/employees/search",
      [{ field: "name", operator: "eq", value: sample.name }],
      "name",
      `search name eq ${sample.name}`,
    );
  }

  if (sample?.title) {
    await search(
      "/employees/search",
      [{ field: "title", operator: "eq", value: sample.title }],
      "name",
      `search title eq ${sample.title}`,
    );
  }

  if (sample?.department) {
    await search(
      "/employees/search",
      [{ field: "department", operator: "eq", value: sample.department }],
      "name",
      `search department eq ${sample.department}`,
    );
  }

  if (sample?.branch?.code) {
    await search(
      "/employees/search",
      [{ field: "branch.code", operator: "eq", value: sample.branch.code }],
      "name",
      `search branch.code eq ${sample.branch.code}`,
    );
  }

  if (sample?.id != null) {
    await search(
      "/employees/search",
      [{ field: "id", operator: "eq", value: Number(sample.id) }],
      "name",
      `search id eq ${sample.id}`,
    );
  }

  if (typeof sample?.active === "boolean") {
    await search(
      "/employees/search",
      [{ field: "active", operator: "eq", value: sample.active }],
      "name",
      `search active eq ${sample.active}`,
    );
  }

  const phoneSample = sample?.phones?.[0]?.number ?? null;
  if (phoneSample) {
    await search(
      "/employees/search",
      [{ field: "phones.number", operator: "contains", value: String(phoneSample).slice(0, 3) }],
      "name",
      `search phones.number contains ${String(phoneSample).slice(0, 3)}`,
    );
  }

  if (!opts.skipCrud) {
    // Resolve a real branch for the write payload.
    const branches = await request("GET", "/branches?page=1&limit=5&sort=name:asc");
    const branchSample = firstOf(branches) ?? sample?.branch ?? null;
    if (!ok(branches) || branchSample?.id == null) {
      fail(
        "GET /branches (employee create prereq)",
        branches.status,
        errDetail(branches) || "no branch available",
      );
    } else {
      const branchRef = {
        id: Number(branchSample.id),
        code: String(branchSample.code ?? sample?.branch?.code ?? "").trim(),
      };

      const departmentName =
        createdDepartmentId != null
          ? probeDepartmentName
          : String(sample?.department ?? "driver").trim() || "driver";
      const titleName =
        createdTitleId != null
          ? probeTitleName
          : String(sample?.title ?? "Probe").trim() || "Probe";

      const nextEmployeeId = await nextId("/employees");
      const createBody = {
        id: nextEmployeeId,
        name: probeEmployeeName,
        title: titleName,
        department: departmentName,
        active: true,
        phones: [{ number: "555-0100", type: "mobile", isPrimary: true }],
        branch: branchRef,
        email: `probe-emp-${stamp}@example.com`,
        address: {
          address1: "1 Probe Ave",
          city: "Bronx",
          state: "NY",
          zipcode: "10451",
          country: "US",
        },
      };

      const create = await request("POST", "/employees", createBody);
      createdEmployeeId = extractId(create.json) ?? (ok(create) ? nextEmployeeId : null);

      if (ok(create) && createdEmployeeId == null) {
        const found = await search(
          "/employees/search",
          [{ field: "name", operator: "eq", value: probeEmployeeName }],
          "name",
          "resolve created employee id via name search",
        );
        createdEmployeeId = firstOf(found)?.id ?? null;
      }

      if (ok(create) && createdEmployeeId != null) {
        pass(
          "POST /employees",
          `id=${createdEmployeeId} name=${probeEmployeeName} branch=${branchRef.code || branchRef.id}`,
        );

        const createdRead = await request("GET", `/employees/${createdEmployeeId}`);
        if (ok(createdRead)) pass(`GET /employees/${createdEmployeeId} after create`);
        else {
          fail(
            `GET /employees/${createdEmployeeId} after create`,
            createdRead.status,
            errDetail(createdRead),
          );
        }

        probeEmployeeName = `${probeEmployeeName}_UPD`;
        const update = await request("PUT", `/employees/${createdEmployeeId}`, {
          ...createBody,
          id: Number(createdEmployeeId),
          name: probeEmployeeName,
          title: `${titleName} UPD`,
          phones: [{ number: "555-0199", type: "mobile", isPrimary: true }],
          address: {
            ...createBody.address,
            address1: "2 Probe Ave",
            zipcode: "10452",
          },
        });
        if (ok(update)) pass(`PUT /employees/${createdEmployeeId}`, probeEmployeeName);
        else fail(`PUT /employees/${createdEmployeeId}`, update.status, errDetail(update));

        await search(
          "/employees/search",
          [{ field: "name", operator: "eq", value: probeEmployeeName }],
          "name",
          `search name eq ${probeEmployeeName}`,
        );
        await search(
          "/employees/search",
          [{ field: "department", operator: "eq", value: departmentName }],
          "name",
          `search department eq ${departmentName}`,
        );
      } else {
        fail("POST /employees", create.status, errDetail(create));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup (employee → title → department)
// ---------------------------------------------------------------------------
if (createdEmployeeId != null || createdTitleId != null || createdDepartmentId != null) {
  console.log("\n=== Cleanup ===");

  if (createdEmployeeId != null) {
    const del = await request("DELETE", `/employees/${createdEmployeeId}`);
    if (ok(del)) pass(`DELETE /employees/${createdEmployeeId}`);
    else fail(`DELETE /employees/${createdEmployeeId}`, del.status, errDetail(del));
    await expectGone(`/employees/${createdEmployeeId}`, `GET /employees/${createdEmployeeId}`);
  }

  if (createdTitleId != null) {
    const del = await request("DELETE", `/employee-titles/${createdTitleId}`);
    if (ok(del)) pass(`DELETE /employee-titles/${createdTitleId}`);
    else fail(`DELETE /employee-titles/${createdTitleId}`, del.status, errDetail(del));
    await expectGone(
      `/employee-titles/${createdTitleId}`,
      `GET /employee-titles/${createdTitleId}`,
    );
  }

  if (createdDepartmentId != null) {
    const del = await request("DELETE", `/employee-departments/${createdDepartmentId}`);
    if (ok(del)) pass(`DELETE /employee-departments/${createdDepartmentId}`);
    else {
      fail(
        `DELETE /employee-departments/${createdDepartmentId}`,
        del.status,
        errDetail(del),
      );
    }
    await expectGone(
      `/employee-departments/${createdDepartmentId}`,
      `GET /employee-departments/${createdDepartmentId}`,
    );
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

console.log("All employee / department / title checks passed.");
