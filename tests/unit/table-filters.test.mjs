import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Compile feature modules with only the central HTTP boundary replaced.
function createLoader(apiClient = {}) {
  const cache = new Map();
  return function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (filename.endsWith(".json")) {
      loadedModule.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      return loadedModule.exports;
    }
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        const resolved = [target, `${target}.ts`, path.join(target, "index.ts")].find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        return load(resolved);
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
}

function createRecordingClient() {
  const calls = [];
  const client = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method, async (...args) => {
    calls.push([method, ...args]);
    return { success: true, data: [], total: 0 };
  }]));
  return { calls, client };
}

function searchLeaves(calls) {
  const post = calls.find(([method, url]) => method === "post" && url.includes("/search"));
  assert.ok(post, "expected a POST to a /search endpoint");
  const leaves = [];
  (function walk(node) {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      if (typeof node.field === "string" && "operator" in node && !Array.isArray(node.filters)) leaves.push(node);
      Object.entries(node).forEach(([key, value]) => key !== "sort" && walk(value));
    }
  })(post[2]);
  return leaves;
}

const row = (field, operator, value, join = "and") => ({ id: `${field}-${operator}`, join, field, operator, value });

test("inventory directories send typed filter rows and resolve bar search names to reference ids", async () => {
  const receipts = createRecordingClient();
  await createLoader(receipts.client)("src/lib/inventory/api/inventory-api.ts").fetchInventoryReceipts({
    page: 1,
    limit: 20,
    search: { value: "acme" },
    searchReferenceMatches: [{ field: "supplierId", ids: ["sup-1", "sup-2"] }],
    filterRows: [row("receivedAtRange", "eq", "2026-01-01 to 2026-02-01"), row("toHolderId", "eq", "wh-1")],
  });
  const leaves = searchLeaves(receipts.calls).map((leaf) => [leaf.field, leaf.operator, leaf.value]);
  assert.deepEqual(leaves, [
    ["status", "contains", "acme"],
    ["supplierId", "eq", "sup-1"],
    ["supplierId", "eq", "sup-2"],
    ["receivedAt", "gte", "2026-01-01"],
    ["receivedAt", "lte", "2026-02-01"],
    ["toHolderId", "eq", "wh-1"],
  ]);
  assert.ok(!leaves.some(([field]) => field === "notes"), "notes is not in the receipts search allow-list");

  const items = createRecordingClient();
  await createLoader(items.client)("src/lib/inventory/api/inventory-api.ts").fetchInventoryItems({
    filterRows: [row("isActive", "eq", "false"), row("reorderThreshold", "gte", "3")],
  });
  assert.deepEqual(
    searchLeaves(items.calls).map((leaf) => [leaf.field, leaf.value]),
    [["isActive", false], ["reorderThreshold", 3]],
  );
});

test("catalog pages list via GET when idle and search via POST with typed filters", async () => {
  const idle = createRecordingClient();
  await createLoader(idle.client)("src/lib/employee-titles/api/employee-titles-api.ts").fetchEmployeeTitlesPage({
    page: 2,
    limit: 20,
    sort: "name:asc",
  });
  assert.equal(idle.calls[0][0], "get");
  assert.match(idle.calls[0][1], /^\/employee-titles\?page=2&limit=20&offset=20&sort=name/);

  const searched = createRecordingClient();
  await createLoader(searched.client)("src/lib/invoice-policies/api/invoice-policies-api.ts").fetchInvoicePoliciesPage({
    page: 1,
    limit: 20,
    sort: "sortOrder:asc,title:asc",
    query: "damage",
    filterRows: [row("active", "eq", "true"), row("sortOrder", "lte", "5")],
  });
  assert.deepEqual(
    searchLeaves(searched.calls).map((leaf) => [leaf.field, leaf.operator, leaf.value]),
    [["title", "contains", "damage"], ["body", "contains", "damage"], ["active", "eq", true], ["sortOrder", "lte", 5]],
  );
});

test("date posted and activity date ranges expand to gte/lte pairs", async () => {
  const deposits = createRecordingClient();
  await createLoader(deposits.client)("src/lib/accounting/clearable-payments/api.ts").fetchClearablePayments("/deposits", {
    filterRows: [row("datePostedRange", "eq", "2026-10-01 to 2026-10-31")],
  });
  assert.deepEqual(
    searchLeaves(deposits.calls).map((leaf) => [leaf.field, leaf.operator, leaf.value]),
    [["datePosted", "gte", "2026-10-01"], ["datePosted", "lte", "2026-10-31"]],
  );

  const activity = createRecordingClient();
  await createLoader(activity.client)("src/lib/user-activities/api/user-activities-api.ts").fetchUserActivities({
    filterRows: [row("timestampRange", "eq", "2026-10-01 to 2026-10-02")],
  });
  assert.deepEqual(
    searchLeaves(activity.calls).map((leaf) => [leaf.field, leaf.operator]),
    [["timestamp", "gte"], ["timestamp", "lte"]],
  );
});

test("typed filter expander coerces numbers/booleans and expands ranges", () => {
  const { createTypedFilterExpander } = createLoader()("src/lib/table/typed-filter-expander.ts");
  const expand = createTypedFilterExpander({
    numericFields: ["amount"],
    booleanFields: ["active"],
    rangeFields: { createdAtRange: "createdAt" },
  });
  assert.deepEqual(
    expand({
      operator: "and",
      filters: [
        { field: "amount", operator: "gte", value: "10.5" },
        { field: "active", operator: "eq", value: "false" },
        { field: "createdAtRange", operator: "eq", value: "2026-01-01 to 2026-02-01" },
        { field: "name", operator: "contains", value: "x" },
      ],
    }),
    {
      operator: "and",
      filters: [
        { field: "amount", operator: "gte", value: 10.5 },
        { field: "active", operator: "eq", value: false },
        {
          operator: "and",
          filters: [
            { field: "createdAt", operator: "gte", value: "2026-01-01" },
            { field: "createdAt", operator: "lte", value: "2026-02-01" },
          ],
        },
        { field: "name", operator: "contains", value: "x" },
      ],
    },
  );
  assert.equal(expand({ field: "amount", operator: "eq", value: "abc" }), null, "non-numeric amounts are dropped");
});

test("checks advanced filters send API-typed values and expand ranges", async () => {
  const { calls, client } = createRecordingClient();
  const api = createLoader(client)("src/lib/accounting/checks/api/checks-api.ts");
  await api.fetchChecks({
    page: 1,
    limit: 40,
    filterRows: [
      row("paymentAmount", "gte", "25"),
      row("status", "eq", "CLEARED"),
      row("clearedAtRange", "eq", "2026-10-01 to 2026-10-31"),
    ],
  });
  const leaves = searchLeaves(calls);
  assert.deepEqual(leaves.find((leaf) => leaf.field === "paymentAmount"), { field: "paymentAmount", operator: "gte", value: 25 });
  assert.equal(leaves.find((leaf) => leaf.field === "status")?.value, "CLEARED");
  assert.deepEqual(
    leaves.filter((leaf) => leaf.field === "clearedAt").map((leaf) => [leaf.operator, leaf.value]),
    [["gte", "2026-10-01"], ["lte", "2026-10-31"]],
  );
});

test("clearable payments, user activity and chart of accounts send their filter rows", async () => {
  const clearable = createRecordingClient();
  await createLoader(clearable.client)("src/lib/accounting/clearable-payments/api.ts").fetchClearablePayments("/deposits", {
    filterRows: [row("paymentAmount", "eq", "10")],
  });
  assert.deepEqual(searchLeaves(clearable.calls), [{ field: "paymentAmount", operator: "eq", value: 10 }]);
  assert.ok(clearable.calls[0][1].startsWith("/deposits/search"));

  const activity = createRecordingClient();
  await createLoader(activity.client)("src/lib/user-activities/api/user-activities-api.ts").fetchUserActivities({
    filterRows: [row("severity", "eq", "rare"), row("user.id", "eq", "73")],
  });
  assert.deepEqual(
    searchLeaves(activity.calls).map((leaf) => [leaf.field, leaf.value]),
    [["severity", "rare"], ["user.id", "73"]],
    "user ids stay strings on the activity wire",
  );

  const chart = createRecordingClient();
  await createLoader(chart.client)("src/lib/accounting/chart-accounts/api/chart-accounts-api.ts").fetchChartAccounts({
    type: "BANK",
    filterRows: [row("id", "gte", "3"), row("branch.code", "eq", "NY")],
  });
  const chartLeaves = searchLeaves(chart.calls).map((leaf) => [leaf.field, leaf.operator, leaf.value]);
  assert.deepEqual(chartLeaves, [["type", "eq", "BANK"], ["id", "gte", 3], ["branch.code", "eq", "NY"]]);
});

test("invoice customer ids stay ObjectID strings and customer audit ids are numeric", async () => {
  const invoices = createRecordingClient();
  await createLoader(invoices.client)("src/lib/invoices/api/invoices-api.ts").fetchInvoices({
    filterRows: [row("sender.id", "eq", "6ab7b1f881804186e92bfb15")],
  });
  assert.deepEqual(searchLeaves(invoices.calls).find((leaf) => leaf.field === "sender.id")?.value, "6ab7b1f881804186e92bfb15");

  const customers = createRecordingClient();
  await createLoader(customers.client)("src/lib/customers/api/customers-api.ts").fetchCustomers({
    filterRows: [row("createdBy.id", "eq", "73")],
  });
  assert.equal(searchLeaves(customers.calls).find((leaf) => leaf.field === "createdBy.id")?.value, 73);
});

test("every new filter field has English and Spanish labels and placeholders", () => {
  const load = createLoader();
  const catalogs = (lang) => ({
    accounting: load(`src/locales/${lang}/accounting.json`),
    userActivities: load(`src/locales/${lang}/user-activities.json`),
    inventory: load(`src/locales/${lang}/inventory.json`),
    barcodeStatuses: load(`src/locales/${lang}/barcode-statuses.json`),
    invoicePolicies: load(`src/locales/${lang}/invoice-policies.json`),
    employeeTitles: load(`src/locales/${lang}/employee-titles.json`),
    employeeDepartments: load(`src/locales/${lang}/employee-departments.json`),
  });
  const read = (tree, key) => key.split(".").reduce((node, segment) => node?.[segment], tree);
  const specs = [
    ["src/lib/accounting/checks/filter-fields.ts", "CHECK_TABLE_FILTER_FIELDS", "accounting.checks.filters.fields"],
    ["src/lib/accounting/clearable-payments/filter-fields.ts", "CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS", "accounting.clearablePayments.filters.fields"],
    ["src/lib/accounting/chart-accounts/filter-fields.ts", "CHART_ACCOUNT_TABLE_FILTER_FIELDS", "accounting.chartOfAccounts.filters.fields"],
    ["src/lib/user-activities/filter-fields.ts", "USER_ACTIVITY_TABLE_FILTER_FIELDS", "userActivities.filters.fields"],
    ["src/lib/inventory/filter-fields.ts", "INVENTORY_ITEM_TABLE_FILTER_FIELDS", "inventory.filters.items.fields"],
    ["src/lib/inventory/filter-fields.ts", "INVENTORY_RECEIPT_TABLE_FILTER_FIELDS", "inventory.filters.receipts.fields"],
    ["src/lib/inventory/filter-fields.ts", "INVENTORY_DISPATCH_TABLE_FILTER_FIELDS", "inventory.filters.dispatches.fields"],
    ["src/lib/inventory/filter-fields.ts", "INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS", "inventory.filters.suppliers.fields"],
    ["src/lib/barcodes/barcode-status-filter-fields.ts", "BARCODE_STATUS_TABLE_FILTER_FIELDS", "barcodeStatuses.filters.fields"],
    ["src/lib/invoice-policies/filter-fields.ts", "INVOICE_POLICY_TABLE_FILTER_FIELDS", "invoicePolicies.filters.fields"],
    ["src/lib/table/named-catalog-filter-fields.ts", "NAMED_CATALOG_TABLE_FILTER_FIELDS", "employeeTitles.filters.fields"],
    ["src/lib/table/named-catalog-filter-fields.ts", "NAMED_CATALOG_TABLE_FILTER_FIELDS", "employeeDepartments.filters.fields"],
  ];
  for (const lang of ["en", "es"]) {
    const tree = catalogs(lang);
    for (const [file, exportName, prefix] of specs) {
      for (const definition of load(file)[exportName]) {
        const key = `${prefix}.${definition.field}`;
        assert.equal(typeof read(tree, `${key}.label`), "string", `${lang}: missing ${key}.label`);
        if (definition.placeholder) {
          assert.equal(typeof read(tree, `${key}.placeholder`), "string", `${lang}: missing ${key}.placeholder`);
        }
      }
    }
  }
});
