#!/usr/bin/env node
/**
 * Smoke-test Invoice (merchandise shipment) API endpoints used by the portal.
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Usage:
 *   node scripts/test-invoices-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-invoices-api.mjs
 *
 * Optional:
 *   --company <id>                 override X-Company-ID
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer                       prefix Authorization with "Bearer "
 *   --skip-crud                    read/search only (no create/update/delete)
 *   --skip-route                   skip barcode → daily-route assign
 *   --skip-report                  skip POST /reports/invoices
 *   --run-legacy-preview           also hit GET /invoices/legacy-sync/preview
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_ROUTE=1, EMSYS_SKIP_REPORT=1
 *   EMSYS_RUN_LEGACY_PREVIEW=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

function printHelp() {
  console.log(`Usage:
  node scripts/test-invoices-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-invoices-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-route              Skip barcode route assign
  --skip-report             Skip invoice PDF report
  --run-legacy-preview      Hit legacy sync preview (permission-gated)
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
    skipRoute: process.env.EMSYS_SKIP_ROUTE === "1",
    skipReport: process.env.EMSYS_SKIP_REPORT === "1",
    runLegacyPreview: process.env.EMSYS_RUN_LEGACY_PREVIEW === "1",
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
    } else if (arg === "--skip-route") {
      opts.skipRoute = true;
    } else if (arg === "--skip-report") {
      opts.skipReport = true;
    } else if (arg === "--run-legacy-preview") {
      opts.runLegacyPreview = true;
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
const today = new Date().toISOString().slice(0, 10);
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

function listEmbeddedBarcodes(invoice) {
  const details = Array.isArray(invoice?.invoiceDetails) ? invoice.invoiceDetails : [];
  return details.flatMap((detail) => {
    if (Array.isArray(detail?.barcodes)) return detail.barcodes;
    if (detail?.barcode) return [detail.barcode];
    return [];
  });
}

/** Portal invoice search: pagination in URL; filters + sort in body. */
async function search(filters, label) {
  const body = {
    filters,
    sort: [{ field: "number", direction: "desc" }],
  };
  const res = await request("POST", "/invoices/search?page=1&limit=5&offset=0", body);
  if (ok(res)) pass(label, summarizeList(res));
  else fail(label, res.status, errDetail(res));
  return res;
}

console.log("Invoice (merchandise) API smoke test");
console.log(`Base:     ${opts.baseUrl}`);
console.log(`Company:  ${opts.companyId}`);
console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Route:    ${opts.skipRoute ? "skipped" : "enabled"}`);
console.log(`Report:   ${opts.skipReport ? "skipped" : "enabled"}\n`);

// ---------------------------------------------------------------------------
// Auth + list / read
// ---------------------------------------------------------------------------
console.log("=== List / read ===");
const list = await request("GET", "/invoices?page=1&offset=0&limit=40&sort=number:desc");
if (!ok(list)) {
  fail("GET /invoices (auth check)", list.status, errDetail(list));
  console.log("\nAuth failed. Refresh the temporary token and try again.");
  process.exit(1);
}
pass("GET /invoices", summarizeList(list));

const sampleInvoice = firstOf(list);
const sampleId = sampleInvoice?.id ?? null;
if (sampleId != null) {
  const read = await request("GET", `/invoices/${sampleId}`);
  if (ok(read)) {
    pass(
      `GET /invoices/${sampleId}`,
      `number=${read.json?.data?.number ?? "?"} sender=${read.json?.data?.sender?.name ?? ""}`,
    );
  } else {
    fail(`GET /invoices/${sampleId}`, read.status, errDetail(read));
  }
} else {
  note("No existing invoices returned; read-by-id will run after create.");
}

// ---------------------------------------------------------------------------
// Search / filters (portal Invoices directory)
// ---------------------------------------------------------------------------
console.log("\n=== Search / filters ===");
await search(
  [
    {
      operator: "or",
      filters: [
        "number",
        "sender.name",
        "receiver.name",
        "container.name",
        "container.containerNumber",
      ].map((field) => ({ field, operator: "contains", value: "1" })),
    },
  ],
  "POST /invoices/search bar OR",
);
await search([{ field: "paidStatus", operator: "eq", value: "UNPAID" }], "search paidStatus=UNPAID");
await search([{ field: "paidStatus", operator: "eq", value: "PARTIAL" }], "search paidStatus=PARTIAL");
await search([{ field: "paidRegion", operator: "eq", value: "NY" }], "search paidRegion=NY");
await search([{ field: "isVoid", operator: "eq", value: false }], "search isVoid=false");
await search(
  [
    {
      operator: "and",
      filters: [
        { field: "date", operator: "gte", value: today },
        { field: "date", operator: "lte", value: today },
      ],
    },
  ],
  "search date = today",
);

if (sampleInvoice?.sender?.id) {
  const bySender = await request(
    "GET",
    `/invoices?field=sender.id&operator=eq&value=${encodeURIComponent(sampleInvoice.sender.id)}&sort=number:desc&page=1&limit=5`,
  );
  if (ok(bySender)) pass("GET sender.id history", summarizeList(bySender));
  else fail("GET sender.id history", bySender.status, errDetail(bySender));
}

if (sampleInvoice?.container?.id != null) {
  await search(
    [{ field: "container.id", operator: "eq", value: sampleInvoice.container.id }],
    `search container.id eq ${sampleInvoice.container.id}`,
  );
}

// ---------------------------------------------------------------------------
// Legacy preview (optional; permission-gated)
// ---------------------------------------------------------------------------
if (opts.runLegacyPreview) {
  console.log("\n=== Legacy sync preview ===");
  const preview = await request("GET", "/invoices/legacy-sync/preview");
  if (ok(preview)) {
    pass("GET /invoices/legacy-sync/preview", `total=${preview.json?.data?.total ?? "?"}`);
  } else if (preview.status === 403) {
    note("legacy-sync/preview returned 403 (missing canSyncLegacyInvoices).");
  } else {
    fail("GET /invoices/legacy-sync/preview", preview.status, errDetail(preview));
  }
}

// ---------------------------------------------------------------------------
// CRUD lifecycle (throwaway ZZ_PROBE_* record, always cleaned up)
// ---------------------------------------------------------------------------
let createdId = null;
let createdNumber = null;
let createdBarcodes = [];

if (!opts.skipCrud) {
  console.log("\n=== CRUD prerequisites ===");
  const containers = await request("GET", "/containers?page=1&limit=5&sort=id:desc");
  const employees = await request("GET", "/employees?page=1&limit=5&sort=id:desc");
  const customers = await request("GET", "/customers?page=1&limit=1&sort=id:desc");
  const incomeStatements = await request(
    "GET",
    "/income-statements?page=1&limit=20&sort=id:desc",
  );

  const container = firstOf(containers);
  const employee = firstOf(employees);
  const customer = firstOf(customers);
  const openIncome = Array.isArray(incomeStatements.json?.data)
    ? incomeStatements.json.data.find((row) => String(row?.status ?? "").toLowerCase() === "open")
    : null;

  if (!ok(containers) || !container) {
    fail("GET /containers (prereq)", containers.status, errDetail(containers) || "no container");
  } else {
    pass("GET /containers", `id=${container.id} name=${container.name ?? ""}`);
  }

  if (!ok(employees) || !employee) {
    fail("GET /employees (prereq)", employees.status, errDetail(employees) || "no employee");
  } else {
    pass("GET /employees", `id=${employee.id} name=${employee.name ?? ""}`);
  }

  if (ok(customers) && customer) {
    pass("GET /customers", `id=${customer.id}`);
  } else {
    note("No customer found; create will use inline sender name only.");
  }

  if (ok(incomeStatements) && openIncome) {
    pass("GET /income-statements", `open id=${openIncome.id}`);
  } else {
    note("No open income statement; create will omit incomeStatement.");
  }

  if (container && employee) {
    console.log("\n=== CRUD ===");
    const branch =
      openIncome?.branch ??
      employee.branch ??
      container.branch ??
      { id: 1, name: "USA", code: "NY" };

    const senderPhone =
      customer?.phones?.[0]?.number ??
      customer?.phone1 ??
      "555-1000";

    const createBody = {
      number: `ZZ-PROBE-${stamp}`,
      date: openIncome?.date ?? today,
      ...(openIncome?.id != null ? { incomeStatement: { id: openIncome.id } } : {}),
      branch: {
        id: Number(branch.id) || 1,
        name: branch.name ?? "USA",
        code: branch.code ?? "NY",
      },
      cost: 100,
      payment: 0,
      balance: 100,
      discount: 0,
      surcharge: 0,
      paidRegion: "NY",
      paidStatus: "UNPAID",
      employee: {
        id: Number(employee.id),
        name: employee.name ?? "Probe Employee",
        ...(employee.userName ? { userName: employee.userName } : {}),
        ...(employee.fullName ? { fullName: employee.fullName } : {}),
      },
      receivedBy: {
        id: Number(employee.id),
        name: employee.name ?? "Probe Employee",
      },
      container: {
        id: container.id,
        name: container.name ?? String(container.id),
      },
      sender: customer
        ? {
            id: customer.id,
            name: customer.name ?? `ZZ_PROBE_SENDER_${stamp}`,
            customerType: customer.customerType ?? 1,
            phone1: senderPhone,
          }
        : {
            name: `ZZ_PROBE_SENDER_${stamp}`,
            customerType: 1,
            phone1: "555-1000",
            address: {
              address1: "1 Probe St",
              city: "Bronx",
              state: "NY",
              zipcode: "10451",
            },
          },
      receiver: {
        name: `ZZ_PROBE_RECEIVER_${stamp}`,
        customerType: 2,
        phone1: "555-2000",
        address: {
          address1: "2 Probe Ave",
          city: "Santo Domingo",
          state: "DN",
          zipcode: "10101",
          country: "DO",
        },
      },
      invoiceDetails: [
        {
          name: `Probe box ${stamp}`,
          quantity: 2,
          labels: 2,
          price: 50,
          total: 100,
        },
      ],
    };

    createdNumber = createBody.number;
    const create = await request("POST", "/invoices", createBody);
    createdId = extractId(create.json);
    if (ok(create) && createdId != null) {
      pass("POST /invoices", `id=${createdId} number=${createdNumber}`);

      const createdRead = await request("GET", `/invoices/${createdId}`);
      if (ok(createdRead)) {
        pass(`GET /invoices/${createdId} after create`);
        createdBarcodes = listEmbeddedBarcodes(createdRead.json?.data);
        if (createdBarcodes.length > 0) {
          pass(
            "invoice embedded barcodes",
            `count=${createdBarcodes.length} ids=${createdBarcodes
              .map((b) => b?.id ?? b?.barcodeId ?? "?")
              .join(",")}`,
          );
        } else {
          note("Created invoice has no embedded barcodes yet.");
        }
      } else {
        fail(`GET /invoices/${createdId} after create`, createdRead.status, errDetail(createdRead));
      }

      const updateBody = {
        ...createBody,
        cost: 120,
        payment: 20,
        balance: 100,
        paidStatus: "PARTIAL",
        invoiceDetails: [
          {
            name: `Probe box ${stamp} UPD`,
            quantity: 2,
            labels: 2,
            price: 60,
            total: 120,
          },
        ],
      };
      const update = await request("PUT", `/invoices/${createdId}`, updateBody);
      if (ok(update)) pass(`PUT /invoices/${createdId}`);
      else fail(`PUT /invoices/${createdId}`, update.status, errDetail(update));

      const voidOn = await request("PUT", `/invoices/${createdId}`, {
        ...updateBody,
        isVoid: true,
      });
      if (ok(voidOn)) pass(`PUT /invoices/${createdId} isVoid=true`);
      else fail(`PUT /invoices/${createdId} isVoid=true`, voidOn.status, errDetail(voidOn));

      const voidOff = await request("PUT", `/invoices/${createdId}`, {
        ...updateBody,
        isVoid: false,
      });
      if (ok(voidOff)) pass(`PUT /invoices/${createdId} isVoid=false`);
      else fail(`PUT /invoices/${createdId} isVoid=false`, voidOff.status, errDetail(voidOff));

      if (createdNumber) {
        await search(
          [{ field: "number", operator: "eq", value: createdNumber }],
          `search number eq ${createdNumber}`,
        );
      }
    } else {
      fail("POST /invoices", create.status, errDetail(create));
    }
  }
}

// ---------------------------------------------------------------------------
// Barcode → daily route assign (DR vehicle-route)
// ---------------------------------------------------------------------------
if (!opts.skipRoute && createdId != null) {
  console.log("\n=== Barcode route assign ===");
  const routeSearch = await request("POST", "/vehicle-routes/search", {
    operator: "and",
    filters: [{ field: "routeType", operator: "eq", value: "delivery" }],
    pagination: { page: 1, limit: 5, offset: 0 },
    sort: [{ field: "date", direction: "desc" }],
  });

  // Prefer a DR-branch daily route when present; otherwise first delivery route.
  const routes = Array.isArray(routeSearch.json?.data) ? routeSearch.json.data : [];
  const route =
    routes.find((row) => {
      const code = String(row?.branch?.code ?? "").toUpperCase();
      return code === "DR" || code === "RD" || code === "DO";
    }) ?? routes[0];

  if (!ok(routeSearch)) {
    fail("POST /vehicle-routes/search (delivery)", routeSearch.status, errDetail(routeSearch));
  } else if (!route?.id) {
    note("No delivery vehicle-route found; skipping barcode route assign.");
  } else {
    pass(
      "POST /vehicle-routes/search (delivery)",
      `routeId=${route.id} branch=${route.branch?.code ?? "?"}`,
    );

    // Refresh barcodes after updates (numeric package-sequence ids for assign).
    const fresh = await request("GET", `/invoices/${createdId}`);
    const barcodes = ok(fresh)
      ? listEmbeddedBarcodes(fresh.json?.data)
      : createdBarcodes;
    const barcodeIds = barcodes
      .map((b) => Number(b?.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (barcodeIds.length === 0) {
      note("No numeric barcode ids on created invoice; skipping assign.");
    } else {
      const assign = await request(
        "PUT",
        `/invoices/item/barcode/route/${route.id}`,
        { barcodeIds },
      );
      if (ok(assign)) {
        pass(
          `PUT /invoices/item/barcode/route/${route.id}`,
          `assigned=${assign.json?.data?.assignedCount ?? barcodeIds.length}`,
        );
      } else {
        fail(
          `PUT /invoices/item/barcode/route/${route.id}`,
          assign.status,
          errDetail(assign),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Invoice PDF report
// ---------------------------------------------------------------------------
const reportId = createdId ?? sampleId;
if (!opts.skipReport && reportId != null) {
  console.log("\n=== Report ===");
  const report = await request("POST", "/reports/invoices", {
    type: "invoice",
    collection: "invoices",
    values: [String(reportId)],
    lookup_field: "id",
    expiresInHours: 1,
  });
  if (ok(report)) {
    const url =
      report.json?.data?.url ??
      report.json?.data?.publicUrl ??
      report.json?.data?.downloadUrl ??
      "";
    pass("POST /reports/invoices", url ? "url returned" : "ok");
  } else {
    fail("POST /reports/invoices", report.status, errDetail(report));
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
if (createdId != null) {
  console.log("\n=== Cleanup ===");
  const del = await request("DELETE", `/invoices/${createdId}`);
  if (ok(del)) pass(`DELETE /invoices/${createdId}`);
  else fail(`DELETE /invoices/${createdId}`, del.status, errDetail(del));

  const gone = await request("GET", `/invoices/${createdId}`);
  if (gone.status === 404) pass(`GET /invoices/${createdId} after delete`, "404 as expected");
  else fail(`GET /invoices/${createdId} after delete`, gone.status, "expected 404");
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

console.log("All invoice checks passed.");
