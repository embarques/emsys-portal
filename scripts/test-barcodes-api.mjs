#!/usr/bin/env node
/**
 * Smoke-test Barcodes + Barcode statuses API endpoints used by the portal.
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   /barcodes, /barcodes/search, /barcodes/status-options, /barcodes/{id}
 *   /barcode-statuses, /barcode-statuses/search, /barcode-statuses/{id}
 *
 * Usage:
 *   node scripts/test-barcodes-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-barcodes-api.mjs
 *
 * Optional:
 *   --company <id>                 override X-Company-ID
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer                       prefix Authorization with "Bearer "
 *   --skip-crud                    read/search only (no create/update/delete)
 *   --skip-barcodes                skip /barcodes section
 *   --skip-statuses                skip /barcode-statuses section
 *   --skip-report                  skip POST /reports/labels
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_BARCODES=1, EMSYS_SKIP_STATUSES=1
 *   EMSYS_SKIP_REPORT=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

/** Portal barcode directory bar search fields. */
const BARCODE_BAR_FIELDS = [
  "number",
  "description",
  "invoice.number",
  "invoiceNumber",
  "container.name",
  "status.name",
  "route.name",
  "id",
  "scanDate",
  "createdAt",
  "updatedAt",
  "createdBy.name",
  "updatedBy.name",
];

function printHelp() {
  console.log(`Usage:
  node scripts/test-barcodes-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-barcodes-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-barcodes           Skip /barcodes checks
  --skip-statuses           Skip /barcode-statuses checks
  --skip-report             Skip labels PDF report
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
    skipBarcodes: process.env.EMSYS_SKIP_BARCODES === "1",
    skipStatuses: process.env.EMSYS_SKIP_STATUSES === "1",
    skipReport: process.env.EMSYS_SKIP_REPORT === "1",
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
    } else if (arg === "--skip-barcodes") {
      opts.skipBarcodes = true;
    } else if (arg === "--skip-statuses") {
      opts.skipStatuses = true;
    } else if (arg === "--skip-report") {
      opts.skipReport = true;
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

if (opts.skipBarcodes && opts.skipStatuses) {
  console.error("Nothing to run: both --skip-barcodes and --skip-statuses were set.");
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

function listOf(res) {
  return Array.isArray(res.json?.data) ? res.json.data : [];
}

/** Portal search: pagination in URL; filters + sort in body. */
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

console.log("Barcodes + barcode-statuses API smoke test");
console.log(`Base:       ${opts.baseUrl}`);
console.log(`Company:    ${opts.companyId}`);
console.log(`Auth:       ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:       ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Barcodes:   ${opts.skipBarcodes ? "skipped" : "enabled"}`);
console.log(`Statuses:   ${opts.skipStatuses ? "skipped" : "enabled"}`);
console.log(`Report:     ${opts.skipReport ? "skipped" : "enabled"}\n`);

let statusOptions = [];
let sampleBarcode = null;
let createdBarcodeId = null;
let createdStatusId = null;
let reportBarcodeId = null;

// ---------------------------------------------------------------------------
// Barcode statuses catalog (/barcode-statuses)
// ---------------------------------------------------------------------------
if (!opts.skipStatuses) {
  console.log("=== Barcode statuses: list / read ===");
  const statusList = await request(
    "GET",
    "/barcode-statuses?page=1&offset=0&limit=40&sort=id:asc",
  );
  if (!ok(statusList)) {
    fail("GET /barcode-statuses (auth check)", statusList.status, errDetail(statusList));
    if (opts.skipBarcodes) {
      console.log("\nAuth failed. Refresh the temporary token and try again.");
      process.exit(1);
    }
    note("Continuing without barcode-statuses CRUD (list failed).");
  } else {
    pass("GET /barcode-statuses", summarizeList(statusList));
    const sampleStatus = firstOf(statusList);
    if (sampleStatus?.id != null) {
      const read = await request("GET", `/barcode-statuses/${sampleStatus.id}`);
      if (ok(read)) {
        pass(
          `GET /barcode-statuses/${sampleStatus.id}`,
          read.json?.data?.name ?? sampleStatus.name ?? "",
        );
      } else {
        fail(`GET /barcode-statuses/${sampleStatus.id}`, read.status, errDetail(read));
      }
    }

    console.log("\n=== Barcode statuses: search ===");
    await search(
      "/barcode-statuses/search",
      [
        {
          operator: "or",
          filters: [
            { field: "name", operator: "contains", value: "A" },
            { field: "prevStatus", operator: "contains", value: "A" },
          ],
        },
      ],
      "id",
      "POST /barcode-statuses/search bar OR",
    );
    if (sampleStatus?.name) {
      await search(
        "/barcode-statuses/search",
        [{ field: "name", operator: "eq", value: sampleStatus.name }],
        "id",
        `search name eq ${sampleStatus.name}`,
      );
    }

    if (!opts.skipCrud) {
      console.log("\n=== Barcode statuses: CRUD ===");
      const createName = `ZZ_PROBE_STATUS_${stamp}`;
      const create = await request("POST", "/barcode-statuses", {
        name: createName,
        prevStatus: "",
      });
      createdStatusId = extractId(create.json);
      if (ok(create) && createdStatusId != null) {
        pass("POST /barcode-statuses", `id=${createdStatusId} name=${createName}`);

        const createdRead = await request("GET", `/barcode-statuses/${createdStatusId}`);
        if (ok(createdRead)) pass(`GET /barcode-statuses/${createdStatusId} after create`);
        else {
          fail(
            `GET /barcode-statuses/${createdStatusId} after create`,
            createdRead.status,
            errDetail(createdRead),
          );
        }

        const updatedName = `${createName}_UPD`;
        const update = await request("PUT", `/barcode-statuses/${createdStatusId}`, {
          name: updatedName,
          prevStatus: sampleStatus?.name ?? "ALM-NY",
        });
        if (ok(update)) pass(`PUT /barcode-statuses/${createdStatusId}`, updatedName);
        else {
          fail(
            `PUT /barcode-statuses/${createdStatusId}`,
            update.status,
            errDetail(update),
          );
        }

        await search(
          "/barcode-statuses/search",
          [{ field: "name", operator: "eq", value: updatedName }],
          "id",
          `search finds ${updatedName}`,
        );
      } else {
        fail("POST /barcode-statuses", create.status, errDetail(create));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Status options (dropdown source for scanner / barcode forms)
// ---------------------------------------------------------------------------
if (!opts.skipBarcodes) {
  console.log("\n=== Barcodes: status-options ===");
  const optionsRes = await request("GET", "/barcodes/status-options");
  if (!ok(optionsRes)) {
    fail("GET /barcodes/status-options", optionsRes.status, errDetail(optionsRes));
  } else {
    statusOptions = listOf(optionsRes);
    pass("GET /barcodes/status-options", `count=${statusOptions.length}`);
    const almNy = statusOptions.find(
      (s) => String(s?.name ?? "").toUpperCase() === "ALM-NY",
    );
    if (almNy) pass("status-options includes ALM-NY", `id=${almNy.id}`);
    else note("ALM-NY not present in status-options (branch default may differ).");
  }

  // ---------------------------------------------------------------------------
  // Barcodes catalog (/barcodes)
  // ---------------------------------------------------------------------------
  console.log("\n=== Barcodes: list / read ===");
  const list = await request("GET", "/barcodes?page=1&offset=0&limit=40&sort=id:desc");
  if (!ok(list)) {
    fail("GET /barcodes (auth check)", list.status, errDetail(list));
    console.log("\nAuth failed. Refresh the temporary token and try again.");
    process.exit(1);
  }
  pass("GET /barcodes", summarizeList(list));

  sampleBarcode = firstOf(list);
  const sampleId = sampleBarcode?.id ?? null;
  reportBarcodeId = sampleId;

  if (sampleId != null) {
    const read = await request("GET", `/barcodes/${sampleId}`);
    if (ok(read)) {
      pass(
        `GET /barcodes/${sampleId}`,
        `number=${read.json?.data?.number ?? "?"} status=${read.json?.data?.status?.name ?? "?"}`,
      );
    } else {
      fail(`GET /barcodes/${sampleId}`, read.status, errDetail(read));
    }
  } else {
    note("No existing barcodes returned; read-by-id will run after create.");
  }

  console.log("\n=== Barcodes: search / filters ===");
  const barTerm =
    typeof sampleBarcode?.number === "string" && sampleBarcode.number.length >= 2
      ? sampleBarcode.number.slice(0, Math.min(4, sampleBarcode.number.length))
      : "1";

  await search(
    "/barcodes/search",
    [
      {
        operator: "or",
        filters: BARCODE_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: barTerm,
        })),
      },
    ],
    "id",
    `POST /barcodes/search bar OR ("${barTerm}")`,
  );

  if (sampleBarcode?.number) {
    await search(
      "/barcodes/search",
      [{ field: "number", operator: "eq", value: sampleBarcode.number }],
      "id",
      `search number eq ${sampleBarcode.number}`,
    );
  }

  if (sampleBarcode?.status?.name) {
    await search(
      "/barcodes/search",
      [{ field: "status.name", operator: "eq", value: sampleBarcode.status.name }],
      "id",
      `search status.name eq ${sampleBarcode.status.name}`,
    );
  }

  if (sampleBarcode?.container?.name) {
    await search(
      "/barcodes/search",
      [{ field: "container.name", operator: "contains", value: sampleBarcode.container.name }],
      "id",
      `search container.name contains ${sampleBarcode.container.name}`,
    );
  }

  if (sampleBarcode?.route?.id) {
    await search(
      "/barcodes/search",
      [{ field: "route.id", operator: "eq", value: sampleBarcode.route.id }],
      "id",
      `search route.id eq ${sampleBarcode.route.id}`,
    );
  }

  if (sampleId != null) {
    await search(
      "/barcodes/search",
      [{ field: "id", operator: "eq", value: Number(sampleId) }],
      "id",
      `search id eq ${sampleId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Barcodes CRUD (API supports it; portal directory is view/bulk-update only)
  // ---------------------------------------------------------------------------
  if (!opts.skipCrud) {
    console.log("\n=== Barcodes: CRUD ===");
    const containers = await request("GET", "/containers?page=1&limit=1&sort=id:desc");
    const container = firstOf(containers);
    if (ok(containers) && container) {
      pass("GET /containers (prereq)", `id=${container.id}`);
    } else {
      note("No container available; create will omit container.");
    }

    const defaultStatus =
      statusOptions.find((s) => String(s?.name ?? "").toUpperCase() === "ALM-NY") ??
      statusOptions[0] ??
      null;
    const altStatus =
      statusOptions.find((s) => Number(s?.id) !== Number(defaultStatus?.id)) ??
      defaultStatus;

    // Omit status on create to verify API defaults (expected ALM-NY).
    const createBody = {
      number: `ZZ_PROBE_BC_${stamp}`,
      ...(container
        ? { container: { id: container.id, name: container.name ?? String(container.id) } }
        : {}),
    };

    const create = await request("POST", "/barcodes", createBody);
    createdBarcodeId = extractId(create.json);
    if (ok(create) && createdBarcodeId != null) {
      const createdStatusName =
        create.json?.data?.status?.name ?? "(none)";
      pass(
        "POST /barcodes",
        `id=${createdBarcodeId} number=${createBody.number} status=${createdStatusName}`,
      );
      reportBarcodeId = createdBarcodeId;

      if (String(createdStatusName).toUpperCase() === "ALM-NY") {
        pass("create default status", "ALM-NY");
      } else if (!create.json?.data?.status) {
        note("Created barcode has no status; expected API default ALM-NY.");
      } else {
        note(`Created barcode status is ${createdStatusName} (expected ALM-NY when omitted).`);
      }

      const createdRead = await request("GET", `/barcodes/${createdBarcodeId}`);
      if (ok(createdRead)) pass(`GET /barcodes/${createdBarcodeId} after create`);
      else {
        fail(
          `GET /barcodes/${createdBarcodeId} after create`,
          createdRead.status,
          errDetail(createdRead),
        );
      }

      const updateStatus = altStatus
        ? { id: Number(altStatus.id), name: altStatus.name }
        : { id: 1, name: "ALM-NY" };

      const update = await request("PUT", `/barcodes/${createdBarcodeId}`, {
        number: `${createBody.number}-UPD`,
        status: updateStatus,
        ...(createBody.container ? { container: createBody.container } : {}),
      });
      if (ok(update)) {
        pass(
          `PUT /barcodes/${createdBarcodeId}`,
          `status=${update.json?.data?.status?.name ?? updateStatus.name}`,
        );
      } else {
        fail(`PUT /barcodes/${createdBarcodeId}`, update.status, errDetail(update));
      }

      await search(
        "/barcodes/search",
        [{ field: "number", operator: "eq", value: `${createBody.number}-UPD` }],
        "id",
        "search finds updated barcode number",
      );
    } else {
      fail("POST /barcodes", create.status, errDetail(create));
    }
  }
}

// ---------------------------------------------------------------------------
// Labels report (print selection)
// ---------------------------------------------------------------------------
if (!opts.skipReport && !opts.skipBarcodes && reportBarcodeId != null) {
  console.log("\n=== Report ===");
  // Prefer ObjectID barcodeId when present; fall back to numeric package id.
  const fresh =
    createdBarcodeId != null
      ? await request("GET", `/barcodes/${createdBarcodeId}`)
      : sampleBarcode
        ? { status: 200, json: { success: true, data: sampleBarcode } }
        : null;
  const record = ok(fresh) ? fresh.json?.data : null;
  const lookupValue =
    String(record?.barcodeId ?? record?.id ?? reportBarcodeId).trim();

  const report = await request("POST", "/reports/labels", {
    type: "label",
    collection: "barcodes",
    values: [lookupValue],
    lookup_field: "id",
    expiresInHours: 1,
  });
  if (ok(report)) {
    const url =
      report.json?.data?.url ??
      report.json?.data?.publicUrl ??
      report.json?.data?.downloadUrl ??
      "";
    pass("POST /reports/labels", url ? "url returned" : "ok");
  } else {
    fail("POST /reports/labels", report.status, errDetail(report));
  }
}

// ---------------------------------------------------------------------------
// Cleanup (statuses first if unused, then barcodes)
// ---------------------------------------------------------------------------
if (createdBarcodeId != null || createdStatusId != null) {
  console.log("\n=== Cleanup ===");
}

if (createdBarcodeId != null) {
  const del = await request("DELETE", `/barcodes/${createdBarcodeId}`);
  if (ok(del)) pass(`DELETE /barcodes/${createdBarcodeId}`);
  else fail(`DELETE /barcodes/${createdBarcodeId}`, del.status, errDetail(del));

  const gone = await request("GET", `/barcodes/${createdBarcodeId}`);
  if (gone.status === 404) pass(`GET /barcodes/${createdBarcodeId} after delete`, "404 as expected");
  else fail(`GET /barcodes/${createdBarcodeId} after delete`, gone.status, "expected 404");
}

if (createdStatusId != null) {
  const del = await request("DELETE", `/barcode-statuses/${createdStatusId}`);
  if (ok(del)) pass(`DELETE /barcode-statuses/${createdStatusId}`);
  else fail(`DELETE /barcode-statuses/${createdStatusId}`, del.status, errDetail(del));

  const gone = await request("GET", `/barcode-statuses/${createdStatusId}`);
  if (gone.status === 404) {
    pass(`GET /barcode-statuses/${createdStatusId} after delete`, "404 as expected");
  } else {
    fail(
      `GET /barcode-statuses/${createdStatusId} after delete`,
      gone.status,
      "expected 404",
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

console.log("All barcode / barcode-status checks passed.");
