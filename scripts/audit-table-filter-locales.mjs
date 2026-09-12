#!/usr/bin/env node
/**
 * Audit table column + filter locale keys: en/es parity and runtime lookups.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkFiles(dir, predicate, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

function flatten(tree, prefix = "") {
  const out = {};
  if (!tree || typeof tree !== "object" || Array.isArray(tree)) return out;
  for (const [key, value] of Object.entries(tree)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[next] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, next));
    }
  }
  return out;
}

function readPath(node, segments) {
  if (segments.length === 0) return typeof node === "string" ? node : undefined;
  if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
  for (let take = 1; take <= segments.length; take += 1) {
    const literal = segments.slice(0, take).join(".");
    if (!(literal in node)) continue;
    const found = readPath(node[literal], segments.slice(take));
    if (found !== undefined) return found;
  }
  return undefined;
}

function readNested(tree, key) {
  return readPath(tree, key.split("."));
}

function loadLocales(lang) {
  const dir = join(root, "src/locales", lang);
  const catalogs = {};
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    const ns = file.replace(/\.json$/, "");
    catalogs[ns] = JSON.parse(readFileSync(join(dir, file), "utf8"));
  }
  return catalogs;
}

const en = loadLocales("en");
const es = loadLocales("es");
const enFlat = flatten(en);
const esFlat = flatten(es);

const FILTER_SPECS = [
  {
    file: "src/lib/orders/filter-fields.ts",
    ns: "orders",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/customers/filter-fields.ts",
    ns: "customers",
    remap: (field) =>
      field.startsWith("addresses.") ? `address.${field.slice("addresses.".length)}` : field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/invoices/filter-fields.ts",
    ns: "invoices",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/barcodes/filter-fields.ts",
    ns: "barcodes",
    remap: (field) => field,
    alwaysPlaceholder: true,
  },
  {
    file: "src/lib/containers/filter-fields.ts",
    ns: "containers",
    remap: (field) => field,
    alwaysPlaceholder: true,
  },
  {
    file: "src/lib/items/filter-fields.ts",
    ns: "items",
    remap: (field) => field,
    alwaysPlaceholder: true,
  },
  {
    file: "src/lib/branches/filter-fields.ts",
    ns: "branches",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/roles/filter-fields.ts",
    ns: "roles",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/users/filter-fields.ts",
    ns: "users",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/vehicles/filter-fields.ts",
    ns: "vehicles",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/employees/filter-fields.ts",
    ns: "employees",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/pickup-delivery-routes/filter-fields.ts",
    ns: "routes",
    remap: (field) => field,
    alwaysPlaceholder: false,
  },
  {
    file: "src/lib/memo-pads/filter-fields.ts",
    ns: null,
    remap: (field) => field,
    alwaysPlaceholder: false,
    hardcoded: true,
  },
];

function parseFilterFields(filePath) {
  const source = readFileSync(join(root, filePath), "utf8");
  const fields = [];
  const objectRe = /\{\s*field:\s*"([^"]+)"([\s\S]*?)\n\s*\},/g;
  let match;
  while ((match = objectRe.exec(source))) {
    const field = match[1];
    const body = match[2];
    fields.push({
      field,
      hasPlaceholder: /placeholder:/.test(body),
    });
  }
  return fields;
}

const missingEn = [];
const missingEs = [];
const hardcodedFilters = [];

for (const spec of FILTER_SPECS) {
  const fields = parseFilterFields(spec.file);
  if (spec.hardcoded || !spec.ns) {
    hardcodedFilters.push({
      file: spec.file,
      ns: spec.ns,
      fields: fields.map((entry) => entry.field),
    });
    continue;
  }

  for (const entry of fields) {
    const localeField = spec.remap(entry.field);
    const labelKey = `${spec.ns}.filters.fields.${localeField}.label`;
    const needPlaceholder = spec.alwaysPlaceholder || entry.hasPlaceholder;
    const placeholderKey = `${spec.ns}.filters.fields.${localeField}.placeholder`;

    if (!readNested(en, labelKey)) missingEn.push(labelKey);
    if (!readNested(es, labelKey)) missingEs.push(labelKey);

    if (needPlaceholder) {
      if (!readNested(en, placeholderKey)) missingEn.push(placeholderKey);
      if (!readNested(es, placeholderKey)) missingEs.push(placeholderKey);
    }
  }
}

const srcFiles = walkFiles(join(root, "src"), (file) =>
  file.endsWith(".ts") || file.endsWith(".tsx"),
);

const usedKeys = new Set();
const tRe = /\bt\(\s*[`'"]([^`'"]+)[`'"]/g;
for (const file of srcFiles) {
  const source = readFileSync(file, "utf8");
  let match;
  while ((match = tRe.exec(source))) {
    const key = match[1];
    if (key.includes("${")) continue;
    if (
      key.includes(".columns.") ||
      key.includes(".filters.fields.") ||
      /\.filters\.[a-zA-Z]/.test(key)
    ) {
      usedKeys.add(key);
    }
  }
}

const usedMissingEn = [];
const usedMissingEs = [];
for (const key of [...usedKeys].sort()) {
  if (!readNested(en, key)) usedMissingEn.push(key);
  if (!readNested(es, key)) usedMissingEs.push(key);
}

const enOnly = Object.keys(enFlat)
  .filter((key) => !(key in esFlat))
  .sort();
const esOnly = Object.keys(esFlat)
  .filter((key) => !(key in enFlat))
  .sort();

const hardcodedColumnLabels = [];
const tableColumnRe =
  /(?:id:\s*"[^"]+",\s*)?label:\s*"([^"]+)"/g;
for (const file of srcFiles.filter((path) => path.includes("-workspace.tsx"))) {
  const source = readFileSync(file, "utf8");
  const rel = relative(root, file);
  if (!source.includes("tableColumns") && !source.includes("DataTableColumn")) continue;
  let match;
  while ((match = tableColumnRe.exec(source))) {
    const label = match[1];
    const around = source.slice(Math.max(0, match.index - 80), match.index + 40);
    if (!around.includes("id:") && !around.includes("sortField")) continue;
    hardcodedColumnLabels.push({ file: rel, label });
  }
}

function uniq(list) {
  return [...new Set(list)];
}

const report = {
  filters: {
    missingEn: uniq(missingEn),
    missingEs: uniq(missingEs),
    hardcoded: hardcodedFilters,
  },
  usedColumnAndFilterKeys: {
    total: usedKeys.size,
    missingEn: usedMissingEn,
    missingEs: usedMissingEs,
  },
  catalogParity: {
    enOnlyCount: enOnly.length,
    esOnlyCount: esOnly.length,
    enOnly: enOnly,
    esOnly: esOnly,
  },
  hardcodedTableColumnLabels: hardcodedColumnLabels,
};

console.log(JSON.stringify(report, null, 2));
console.log(
  [
    "",
    `Filter locale gaps: en=${report.filters.missingEn.length} es=${report.filters.missingEs.length}`,
    `Used column/filter t() gaps: en=${usedMissingEn.length} es=${usedMissingEs.length}`,
    `Catalog parity: en-only=${enOnly.length} es-only=${esOnly.length}`,
    `Hardcoded filter field sets: ${hardcodedFilters.length}`,
    `Hardcoded table column labels: ${hardcodedColumnLabels.length}`,
  ].join("\n"),
);
