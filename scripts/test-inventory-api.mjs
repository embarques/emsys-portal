#!/usr/bin/env node
/**
 * Smoke-test Inventory API endpoints used by the portal:
 *   receipts, dispatches, stock (read-only), suppliers
 *
 * Swagger: https://api.embarqueros.com/swagger/index.html#/inventory
 *
 * Only a temporary Firebase JWT is required. Company ID defaults to the
 * Embarqueros company used in local curl samples.
 *
 * Covers:
 *   /inventory/suppliers[+ /search /{id}]
 *   /inventory/stock[+ /search /{id}]          (read-only)
 *   /inventory/receipts[+ /search /{id}]
 *   /inventory/dispatches[+ /search /{id}]
 *
 * CRUD creates throwaway ZZ_PROBE_* records (plus a throwaway inventory item
 * so receipt/dispatch can run), then cleans them up in reverse dependency order.
 *
 * Usage:
 *   node scripts/test-inventory-api.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-inventory-api.mjs
 *
 * Optional:
 *   --company <id>                 override X-Company-ID
 *   --base-url <url>               default https://api.embarqueros.com/v1
 *   --bearer                       prefix Authorization with "Bearer "
 *   --skip-crud                    read/search only
 *   --skip-suppliers
 *   --skip-stock
 *   --skip-receipts
 *   --skip-dispatches
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1, EMSYS_SKIP_SUPPLIERS=1, EMSYS_SKIP_STOCK=1
 *   EMSYS_SKIP_RECEIPTS=1, EMSYS_SKIP_DISPATCHES=1
 */

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

const SUPPLIER_BAR_FIELDS = ["companyName", "contactNames", "emails"];
const STOCK_BAR_FIELDS = ["item.item"];
const RECEIPT_BAR_FIELDS = ["item.item", "supplier.companyName"];
const DISPATCH_BAR_FIELDS = ["item.item", "dispatchedTo.name"];

function printHelp() {
  console.log(`Usage:
  node scripts/test-inventory-api.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-inventory-api.mjs

Options:
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete
  --skip-suppliers          Skip /inventory/suppliers
  --skip-stock              Skip /inventory/stock
  --skip-receipts           Skip /inventory/receipts
  --skip-dispatches         Skip /inventory/dispatches
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
    skipSuppliers: process.env.EMSYS_SKIP_SUPPLIERS === "1",
    skipStock: process.env.EMSYS_SKIP_STOCK === "1",
    skipReceipts: process.env.EMSYS_SKIP_RECEIPTS === "1",
    skipDispatches: process.env.EMSYS_SKIP_DISPATCHES === "1",
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
    } else if (arg === "--skip-suppliers") {
      opts.skipSuppliers = true;
    } else if (arg === "--skip-stock") {
      opts.skipStock = true;
    } else if (arg === "--skip-receipts") {
      opts.skipReceipts = true;
    } else if (arg === "--skip-dispatches") {
      opts.skipDispatches = true;
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

if (opts.skipSuppliers && opts.skipStock && opts.skipReceipts && opts.skipDispatches) {
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

async function search(path, filters, sortField, label) {
  const body = {
    filters,
    sort: [{ field: sortField, direction: "desc" }],
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

console.log("Inventory API smoke test (receipts / dispatches / stock / suppliers)");
console.log(`Swagger:    https://api.embarqueros.com/swagger/index.html#/inventory`);
console.log(`Base:       ${opts.baseUrl}`);
console.log(`Company:    ${opts.companyId}`);
console.log(`Auth:       ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:       ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Suppliers:  ${opts.skipSuppliers ? "skipped" : "enabled"}`);
console.log(`Stock:      ${opts.skipStock ? "skipped" : "enabled"}`);
console.log(`Receipts:   ${opts.skipReceipts ? "skipped" : "enabled"}`);
console.log(`Dispatches: ${opts.skipDispatches ? "skipped" : "enabled"}\n`);

let createdSupplierId = null;
let createdItemId = null;
let createdReceiptId = null;
let createdDispatchId = null;
let probeSupplierName = `ZZ_PROBE_SUPPLIER_${stamp}`;
let probeItemName = `ZZ_PROBE_ITEM_${stamp}`;

// Auth warm-up against a resource that should always exist for inventory users.
{
  const warm = await request("GET", "/inventory/stock?page=1&limit=1");
  if (!ok(warm) && warm.status === 401) {
    fail("GET /inventory/stock (auth check)", warm.status, errDetail(warm));
    console.log("\nAuth failed. Refresh the temporary token and try again.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
if (!opts.skipSuppliers) {
  console.log("=== Suppliers ===");
  const { sample } = await listAndRead(
    "/inventory/suppliers",
    "companyName:asc",
    (data) => data?.companyName ?? "",
  );

  await search(
    "/inventory/suppliers/search",
    [
      {
        operator: "or",
        filters: SUPPLIER_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: sample?.companyName?.slice(0, 2) || "a",
        })),
      },
    ],
    "companyName",
    "POST /inventory/suppliers/search bar OR",
  );

  if (sample?.companyName) {
    await search(
      "/inventory/suppliers/search",
      [{ field: "companyName", operator: "eq", value: sample.companyName }],
      "companyName",
      `search companyName eq ${sample.companyName}`,
    );
  }

  if (!opts.skipCrud) {
    const create = await request("POST", "/inventory/suppliers", {
      companyName: probeSupplierName,
      contactNames: ["Probe Contact"],
      addresses: ["1 Probe St"],
      phones: [{ number: "555-0100", type: "mobile", isPrimary: true }],
      emails: [`probe-${stamp}@example.com`],
    });
    createdSupplierId = extractId(create.json);
    if (ok(create) && createdSupplierId != null) {
      pass("POST /inventory/suppliers", `id=${createdSupplierId}`);

      const update = await request("PUT", `/inventory/suppliers/${createdSupplierId}`, {
        companyName: `${probeSupplierName}_UPD`,
        contactNames: ["Probe Contact Updated"],
        addresses: ["2 Probe Ave"],
        phones: [{ number: "555-0199", type: "mobile", isPrimary: true }],
        emails: [`probe-${stamp}-upd@example.com`],
      });
      if (ok(update)) {
        probeSupplierName = `${probeSupplierName}_UPD`;
        pass(`PUT /inventory/suppliers/${createdSupplierId}`, probeSupplierName);
      } else {
        fail(`PUT /inventory/suppliers/${createdSupplierId}`, update.status, errDetail(update));
      }
    } else {
      fail("POST /inventory/suppliers", create.status, errDetail(create));
    }
  }
}

// ---------------------------------------------------------------------------
// Stock (read-only)
// ---------------------------------------------------------------------------
if (!opts.skipStock) {
  console.log("\n=== Stock (read-only) ===");
  const { sample } = await listAndRead(
    "/inventory/stock",
    "item.item:asc",
    (data) =>
      `item=${data?.item?.item ?? "?"} qty=${data?.quantity ?? "?"} avg=${data?.averageCost ?? "?"}`,
  );

  await search(
    "/inventory/stock/search",
    [
      {
        operator: "or",
        filters: STOCK_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: sample?.item?.item?.slice(0, 2) || "a",
        })),
      },
    ],
    "item.item",
    "POST /inventory/stock/search bar OR",
  );

  if (sample?.item?.item) {
    await search(
      "/inventory/stock/search",
      [{ field: "item.item", operator: "contains", value: sample.item.item }],
      "item.item",
      `search item.item contains ${sample.item.item}`,
    );
  }

  if (sample?.itemId || sample?.item?.id) {
    const itemId = sample.itemId ?? sample.item.id;
    await search(
      "/inventory/stock/search",
      [{ field: "itemId", operator: "eq", value: String(itemId) }],
      "item.item",
      `search itemId eq ${itemId}`,
    );
  }

  // Stock has no POST/PUT/DELETE in the API.
  const createAttempt = await request("POST", "/inventory/stock", { quantity: 1 });
  if (createAttempt.status === 404 || createAttempt.status === 405 || createAttempt.status === 403) {
    pass("POST /inventory/stock rejected", `HTTP ${createAttempt.status} as expected (read-only)`);
  } else if (ok(createAttempt)) {
    fail("POST /inventory/stock rejected", createAttempt.status, "expected reject; stock is read-only");
  } else {
    note(`POST /inventory/stock returned HTTP ${createAttempt.status} (treated as non-writable).`);
  }
}

// ---------------------------------------------------------------------------
// Receipts + Dispatches CRUD prerequisites (throwaway item)
// ---------------------------------------------------------------------------
const needMovementCrud =
  !opts.skipCrud && (!opts.skipReceipts || !opts.skipDispatches);

if (needMovementCrud) {
  console.log("\n=== Movement prerequisites (throwaway item) ===");
  const itemCreate = await request("POST", "/inventory/items", {
    item: probeItemName,
    reorderThreshold: 1,
  });
  createdItemId = extractId(itemCreate.json);
  if (ok(itemCreate) && createdItemId != null) {
    pass("POST /inventory/items (prereq)", `id=${createdItemId} item=${probeItemName}`);
  } else {
    fail("POST /inventory/items (prereq)", itemCreate.status, errDetail(itemCreate));
  }

  // Receipt CRUD needs a supplier; create one if the suppliers section skipped it.
  if (!createdSupplierId && !opts.skipReceipts) {
    const supplierCreate = await request("POST", "/inventory/suppliers", {
      companyName: probeSupplierName,
      contactNames: [],
      addresses: [],
      phones: [],
      emails: [],
    });
    createdSupplierId = extractId(supplierCreate.json);
    if (ok(supplierCreate) && createdSupplierId != null) {
      pass("POST /inventory/suppliers (prereq)", `id=${createdSupplierId}`);
    } else {
      fail("POST /inventory/suppliers (prereq)", supplierCreate.status, errDetail(supplierCreate));
    }
  }
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------
if (!opts.skipReceipts) {
  console.log("\n=== Receipts ===");
  const { sample } = await listAndRead(
    "/inventory/receipts",
    "receivedAt:desc",
    (data) =>
      `item=${data?.item?.item ?? "?"} qty=${data?.quantity ?? "?"} supplier=${data?.supplier?.companyName ?? "?"}`,
  );

  await search(
    "/inventory/receipts/search",
    [
      {
        operator: "or",
        filters: RECEIPT_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: sample?.item?.item?.slice(0, 2) || sample?.supplier?.companyName?.slice(0, 2) || "a",
        })),
      },
    ],
    "receivedAt",
    "POST /inventory/receipts/search bar OR",
  );

  if (sample?.item?.item) {
    await search(
      "/inventory/receipts/search",
      [{ field: "item.item", operator: "contains", value: sample.item.item }],
      "receivedAt",
      `search item.item contains ${sample.item.item}`,
    );
  }

  if (!opts.skipCrud && createdItemId && createdSupplierId) {
    const createBody = {
      itemId: String(createdItemId),
      quantity: 10,
      averageCost: 5.5,
      supplierId: String(createdSupplierId),
      receivedAt: today,
    };
    const create = await request("POST", "/inventory/receipts", createBody);
    createdReceiptId = extractId(create.json);
    if (ok(create) && createdReceiptId != null) {
      pass("POST /inventory/receipts", `id=${createdReceiptId} qty=10`);

      const update = await request("PUT", `/inventory/receipts/${createdReceiptId}`, {
        ...createBody,
        quantity: 12,
        averageCost: 6,
      });
      if (ok(update)) pass(`PUT /inventory/receipts/${createdReceiptId}`, "qty=12");
      else fail(`PUT /inventory/receipts/${createdReceiptId}`, update.status, errDetail(update));

      // Stock should now reflect the probe item.
      if (!opts.skipStock) {
        const stockSearch = await search(
          "/inventory/stock/search",
          [{ field: "itemId", operator: "eq", value: String(createdItemId) }],
          "item.item",
          "stock after receipt (itemId)",
        );
        const stockRow = firstOf(stockSearch);
        if (stockRow) {
          pass(
            "stock reflects receipt",
            `qty=${stockRow.quantity ?? "?"} avg=${stockRow.averageCost ?? "?"}`,
          );
        } else {
          note("Stock row for probe item not found on first search page.");
        }
      }
    } else {
      fail("POST /inventory/receipts", create.status, errDetail(create));
    }
  } else if (!opts.skipCrud) {
    note("Skipping receipt CRUD (need created item + supplier).");
  }
}

// ---------------------------------------------------------------------------
// Dispatches
// ---------------------------------------------------------------------------
if (!opts.skipDispatches) {
  console.log("\n=== Dispatches ===");
  const { sample } = await listAndRead(
    "/inventory/dispatches",
    "dispatchedAt:desc",
    (data) =>
      `item=${data?.item?.item ?? "?"} qty=${data?.quantity ?? "?"} to=${data?.dispatchedTo?.name ?? "?"}`,
  );

  await search(
    "/inventory/dispatches/search",
    [
      {
        operator: "or",
        filters: DISPATCH_BAR_FIELDS.map((field) => ({
          field,
          operator: "contains",
          value: sample?.item?.item?.slice(0, 2) || sample?.dispatchedTo?.name?.slice(0, 2) || "a",
        })),
      },
    ],
    "dispatchedAt",
    "POST /inventory/dispatches/search bar OR",
  );

  if (sample?.dispatchedTo?.name) {
    await search(
      "/inventory/dispatches/search",
      [{ field: "dispatchedTo.name", operator: "contains", value: sample.dispatchedTo.name }],
      "dispatchedAt",
      `search dispatchedTo.name contains ${sample.dispatchedTo.name}`,
    );
  }

  if (!opts.skipCrud && createdItemId && createdReceiptId) {
    const employees = await request("GET", "/employees?page=1&limit=1&sort=id:desc");
    const employee = firstOf(employees);
    if (!ok(employees) || !employee) {
      fail("GET /employees (dispatch prereq)", employees.status, errDetail(employees) || "no employee");
    } else {
      pass("GET /employees (dispatch prereq)", `id=${employee.id} name=${employee.name ?? ""}`);

      const createBody = {
        itemId: String(createdItemId),
        quantity: 2,
        incomeGained: 20,
        dispatchedAt: today,
        dispatchedTo: {
          id: Number(employee.id),
          name: employee.name ?? "Probe Employee",
        },
      };
      const create = await request("POST", "/inventory/dispatches", createBody);
      createdDispatchId = extractId(create.json);
      if (ok(create) && createdDispatchId != null) {
        pass("POST /inventory/dispatches", `id=${createdDispatchId} qty=2`);

        const update = await request("PUT", `/inventory/dispatches/${createdDispatchId}`, {
          ...createBody,
          quantity: 3,
          incomeGained: 30,
        });
        if (ok(update)) pass(`PUT /inventory/dispatches/${createdDispatchId}`, "qty=3");
        else {
          fail(
            `PUT /inventory/dispatches/${createdDispatchId}`,
            update.status,
            errDetail(update),
          );
        }
      } else {
        fail("POST /inventory/dispatches", create.status, errDetail(create));
      }
    }
  } else if (!opts.skipCrud) {
    note("Skipping dispatch CRUD (need created item + receipt stock).");
  }
}

// ---------------------------------------------------------------------------
// Cleanup (dispatch → receipt → supplier → item)
// ---------------------------------------------------------------------------
if (createdDispatchId || createdReceiptId || createdSupplierId || createdItemId) {
  console.log("\n=== Cleanup ===");
}

if (createdDispatchId != null) {
  const del = await request("DELETE", `/inventory/dispatches/${createdDispatchId}`);
  if (ok(del)) pass(`DELETE /inventory/dispatches/${createdDispatchId}`);
  else fail(`DELETE /inventory/dispatches/${createdDispatchId}`, del.status, errDetail(del));
  await expectGone(`/inventory/dispatches/${createdDispatchId}`, `GET /inventory/dispatches/${createdDispatchId}`);
}

if (createdReceiptId != null) {
  const del = await request("DELETE", `/inventory/receipts/${createdReceiptId}`);
  if (ok(del)) pass(`DELETE /inventory/receipts/${createdReceiptId}`);
  else fail(`DELETE /inventory/receipts/${createdReceiptId}`, del.status, errDetail(del));
  await expectGone(`/inventory/receipts/${createdReceiptId}`, `GET /inventory/receipts/${createdReceiptId}`);
}

if (createdSupplierId != null) {
  const del = await request("DELETE", `/inventory/suppliers/${createdSupplierId}`);
  if (ok(del)) pass(`DELETE /inventory/suppliers/${createdSupplierId}`);
  else fail(`DELETE /inventory/suppliers/${createdSupplierId}`, del.status, errDetail(del));
  await expectGone(`/inventory/suppliers/${createdSupplierId}`, `GET /inventory/suppliers/${createdSupplierId}`);
}

if (createdItemId != null) {
  const del = await request("DELETE", `/inventory/items/${createdItemId}`);
  if (ok(del)) pass(`DELETE /inventory/items/${createdItemId}`);
  else fail(`DELETE /inventory/items/${createdItemId}`, del.status, errDetail(del));
  await expectGone(`/inventory/items/${createdItemId}`, `GET /inventory/items/${createdItemId}`);
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

console.log("All inventory (receipts / dispatches / stock / suppliers) checks passed.");
