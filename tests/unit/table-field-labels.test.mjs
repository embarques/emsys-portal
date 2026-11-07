import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function createLoader() {
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
      if (specifier === "@/lib/api/client") return { apiClient: {} };
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

const load = createLoader();
const { translate } = load("src/lib/i18n/catalog.ts");
const labels = load("src/lib/table/translate-field-label.ts");
const { formatTableColumnLabel } = load("src/lib/table/column-labels.ts");
const en = (key, params) => translate("en", key, params);
const es = (key, params) => translate("es", key, params);

const FILTER_FIELD_EXPORTS = [
  ["src/lib/accounting/daily-income/filter-fields.ts", "DAILY_INCOME_TABLE_FILTER_FIELDS"],
  ["src/lib/accounting/pending-transactions/search.ts", "PENDING_TRANSACTION_FILTER_FIELDS"],
  ["src/lib/accounting/clearable-payments/filter-fields.ts", "CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS"],
  ["src/lib/accounting/checks/filter-fields.ts", "CHECK_TABLE_FILTER_FIELDS"],
  ["src/lib/accounting/chart-accounts/filter-fields.ts", "CHART_ACCOUNT_TABLE_FILTER_FIELDS"],
  ["src/lib/accounting/loans/filter-fields.ts", "LOAN_TABLE_FILTER_FIELDS"],
  ["src/lib/route-manager/filter-fields.ts", "ROUTE_TABLE_FILTER_FIELDS"],
  ["src/lib/pickup-delivery-routes/filter-fields.ts", "ACTIVE_ROUTE_TABLE_FILTER_FIELDS"],
  ["src/lib/deliveries/filter-fields.ts", "ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS"],
  ["src/lib/predefined-routes/filter-fields.ts", "PREDEFINED_ROUTE_TABLE_FILTER_FIELDS"],
  ["src/lib/orders/filter-fields.ts", "ORDER_TABLE_FILTER_FIELDS"],
  ["src/lib/user-activities/filter-fields.ts", "USER_ACTIVITY_TABLE_FILTER_FIELDS"],
  ["src/lib/invoice-policies/filter-fields.ts", "INVOICE_POLICY_TABLE_FILTER_FIELDS"],
  ["src/lib/inventory/filter-fields.ts", "INVENTORY_ITEM_TABLE_FILTER_FIELDS"],
  ["src/lib/inventory/filter-fields.ts", "INVENTORY_RECEIPT_TABLE_FILTER_FIELDS"],
  ["src/lib/inventory/filter-fields.ts", "INVENTORY_DISPATCH_TABLE_FILTER_FIELDS"],
  ["src/lib/inventory/filter-fields.ts", "INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS"],
  ["src/lib/employees/filter-fields.ts", "EMPLOYEE_TABLE_FILTER_FIELDS"],
  ["src/lib/invoices/filter-fields.ts", "INVOICE_TABLE_FILTER_FIELDS"],
  ["src/lib/barcodes/filter-fields.ts", "BARCODE_TABLE_FILTER_FIELDS"],
  ["src/lib/barcodes/barcode-status-filter-fields.ts", "BARCODE_STATUS_TABLE_FILTER_FIELDS"],
  ["src/lib/containers/filter-fields.ts", "CONTAINER_TABLE_FILTER_FIELDS"],
  ["src/lib/users/filter-fields.ts", "USER_TABLE_FILTER_FIELDS"],
  ["src/lib/roles/filter-fields.ts", "ROLE_TABLE_FILTER_FIELDS"],
  ["src/lib/items/filter-fields.ts", "ITEM_TABLE_FILTER_FIELDS"],
  ["src/lib/customers/filter-fields.ts", "CUSTOMER_TABLE_FILTER_FIELDS"],
  ["src/lib/vehicles/filter-fields.ts", "VEHICLE_TABLE_FILTER_FIELDS"],
  ["src/lib/memo-pads/filter-fields.ts", "MEMO_PAD_TABLE_FILTER_FIELDS"],
  ["src/lib/branches/filter-fields.ts", "BRANCH_TABLE_FILTER_FIELDS"],
  ["src/lib/table/named-catalog-filter-fields.ts", "NAMED_CATALOG_TABLE_FILTER_FIELDS"],
];

function allFilterFields() {
  return FILTER_FIELD_EXPORTS.flatMap(([file, exportName]) => {
    const fields = load(file)[exportName];
    assert.ok(Array.isArray(fields), `${file} should export ${exportName}`);
    return fields;
  });
}

function keyPaths(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" ? keyPaths(value, `${prefix}${key}/`) : [`${prefix}${key}`],
  );
}

test("table-fields catalogs have matching English and Spanish keys", () => {
  const enCatalog = load("src/locales/en/table-fields.json");
  const esCatalog = load("src/locales/es/table-fields.json");
  assert.deepEqual(keyPaths(esCatalog).sort(), keyPaths(enCatalog).sort());
});

test("Spanish labels resolve for known fields and unknown fields fall back to English", () => {
  assert.equal(labels.translateTableFieldLabel("branch.code", "Branch", es), "Sucursal");
  assert.equal(labels.translateTableFieldLabel("branch.code", "Branch code", es), "Código de sucursal");
  assert.equal(labels.translateTableFieldLabel("id", "Employee ID", es), "ID de empleado");
  assert.equal(labels.translateTableFieldLabel("licensePlate", "licensePlate", es), "Placa");
  assert.equal(labels.translateTableFieldLabel("notAField", "Mystery", es), "Mystery");
  assert.equal(labels.translateTableFieldLabel("id", "Unlisted variant", es), "Unlisted variant");
  assert.equal(labels.translateTableFieldLabel("branch.code", "Sucursal", es), "Sucursal", "already-localized labels stay as-is");
  assert.equal(labels.translateTableFieldLabel("licensePlate", "licensePlate", en), "licensePlate");
});

test("filter definitions keep English copy identical and only change display fields in Spanish", () => {
  const fields = allFilterFields();
  assert.deepEqual(labels.localizeTableFilterFields(fields, en), fields, "English output must be unchanged");

  const localized = labels.localizeTableFilterFields(fields, es);
  localized.forEach((definition, index) => {
    const original = fields[index];
    assert.equal(definition.field, original.field);
    assert.deepEqual(definition.operators, original.operators);
    assert.equal(definition.valueType, original.valueType);
    assert.deepEqual(definition.queryFields, original.queryFields);
    assert.deepEqual(definition.options?.map((option) => option.value), original.options?.map((option) => option.value));
  });

  const sameInSpanish = new Set(["ID", "#", "SKU", "UID", "ITN", "VIN", "vin", "Sector"]);
  const untranslated = localized
    .filter((definition, index) => definition.label === fields[index].label && !sameInSpanish.has(definition.label))
    .map((definition) => `${definition.field}=${definition.label}`);
  assert.deepEqual(untranslated, [], "every filter field label has a Spanish translation");

  const untranslatedPlaceholders = localized
    .filter((definition, index) => definition.placeholder && definition.placeholder === fields[index].placeholder)
    .filter((definition) => /[a-z]/i.test(definition.placeholder))
    .map((definition) => `${definition.field}=${definition.placeholder}`);
  assert.deepEqual(untranslatedPlaceholders, [], "every worded placeholder has a Spanish translation");
});

test("placeholders and options localize from the catalog", () => {
  assert.equal(labels.translateTableFieldPlaceholder("Enter role ID…", "Role ID", "ID de rol", es), "Ingrese ID de rol…");
  assert.equal(labels.translateTableFieldPlaceholder("Enter purpose…", "Purpose", "Propósito", es), "Ingrese propósito…");
  assert.equal(labels.translateTableFieldPlaceholder("YYYY-MM-DD", "Date", "Fecha", es), "AAAA-MM-DD");
  assert.equal(labels.translateTableFieldPlaceholder("Enter purpose…", "Purpose", "Purpose", en), "Enter purpose…");
  assert.equal(labels.translateTableFieldOptionLabel("active", { value: "false", label: "Inactive" }, es), "Inactivo");
  assert.equal(labels.translateTableFieldOptionLabel("active", { value: "false", label: "Off" }, es), "Off");
  assert.equal(labels.translateTableFieldOptionLabel("unknown", { value: "x", label: "X" }, es), "X");
});

test("localized column labels match English output and translate known ids in Spanish", () => {
  const enCatalog = load("src/locales/en/table-fields.json").columns;
  const samples = [
    ...Object.keys(enCatalog.exact),
    ...Object.keys(enCatalog.parent).flatMap((parent) => [`${parent}.id`, `${parent}.name`, `${parent}.code`]),
    ...Object.keys(enCatalog.words),
    "branchId", "supplierId", "receiver.address.city", "pickupEmployee", "a.b.c.id", "Created at", "Nombre", "",
  ];
  for (const sample of samples) {
    assert.equal(formatTableColumnLabel(sample, en), formatTableColumnLabel(sample), `English parity for "${sample}"`);
  }

  assert.equal(formatTableColumnLabel("createdAt", es), "Creado el");
  assert.equal(formatTableColumnLabel("branch.id", es), "ID de sucursal");
  assert.equal(formatTableColumnLabel("branch.code", es), "Código de sucursal");
  assert.equal(formatTableColumnLabel("supplierId", es), "ID de proveedor");
  assert.equal(formatTableColumnLabel("receiver.address.city", es), "Ciudad de dirección de destinatario");
  assert.equal(formatTableColumnLabel("Nombre", es), "Nombre", "already-translated headers are not re-translated");
  assert.equal(formatTableColumnLabel("Created at", es), "Created at", "readable labels pass through");
});

test("query logic preview uses supplied operator and join labels", () => {
  const { formatTableFilterRowsLogic } = load("src/lib/table/filter-builder.ts");
  const { getFilterOperatorLabels } = load("src/lib/table/filter-labels.ts");
  const fields = [{ field: "name", label: "Name", operators: ["eq"], valueType: "text" }];
  const rows = [
    { id: "1", join: "and", field: "name", operator: "eq", value: "a" },
    { id: "2", join: "or", field: "name", operator: "eq", value: "b" },
  ];
  assert.equal(formatTableFilterRowsLogic(rows, fields), "Name equals “a” OR Name equals “b”");
  const spanish = labels.localizeTableFilterFields(fields, es);
  assert.equal(
    formatTableFilterRowsLogic(rows, spanish, {}, {
      operators: getFilterOperatorLabels(es),
      inRange: es("common.table.inRange"),
      and: es("common.filterOperators.and"),
      or: es("common.filterOperators.or"),
    }),
    "Nombre igual a “a” O Nombre igual a “b”",
  );
});
