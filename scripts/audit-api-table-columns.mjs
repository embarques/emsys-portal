import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { API_REFERENCE_SPEC, readApiReferenceSpec } from "./lib/api-reference.mjs";
import { compareTableFieldCoverage } from "./lib/table-field-coverage.mjs";

const root = path.resolve(import.meta.dirname, "..");
const api = readApiReferenceSpec(root);
const definitions = api.components?.schemas ?? api.definitions;
assert.ok(definitions, `${API_REFERENCE_SPEC} must contain OpenAPI 3 components.schemas or Swagger 2 definitions`);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = (directory, suffix) => fs.readdirSync(path.join(root, directory), { recursive: true })
  .filter(file => file.endsWith(suffix)).map(file => `${directory}/${file}`);
const components = files("src/components", ".tsx").map(file => ({ file, source: read(file) }));
const modules = files("src/lib", ".ts");
const records = [];
const drift = [];
// Exact, reviewed exceptions only. These do not make arbitrary response fields acceptable.
const compatibilityFields = {
  "check.Check": { checkNumber: "Paper check compatibility alias; distinct from internal refNumber." },
  "journal.Journal": { checkNumber: "Existing paper check renderer/adapter compatibility alias." },
  "pickup.Pickup": { routeNumber: "Legacy route sequence; do not substitute the distinct orderNumber." },
  "route.Route": { vehicle: "Retired crew field is deliberately column:false for historical compatibility." },
};
function checkFields(definition, fields) {
  const { missing, extra, duplicates } = compareTableFieldCoverage(definitions[definition], fields, compatibilityFields[definition]);
  if (missing.length || extra.length || duplicates.length) {
    drift.push(`${definition}: missing [${missing.join(", ")}], extra [${extra.join(", ")}], duplicates [${duplicates.join(", ")}]`);
  }
}

for (const file of modules.filter(file => file.endsWith("/table-fields.ts"))) {
  const source = read(file);
  const schemaNames = [...source.matchAll(/definitions\["([^"]+)"\]/g)].map(match => match[1]);
  const absentSchemas = schemaNames.filter(name => !definitions[name]);
  if (!schemaNames.length || absentSchemas.length) {
    drift.push(`${file}: missing ${absentSchemas.length ? `API schema ${absentSchemas.join(", ")}` : "API schema reference"}`);
    continue;
  }
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let declaration;
  ast.forEachChild(node => {
    if (ts.isVariableStatement(node)) declaration = node.declarationList.declarations[0];
  });
  const symbol = declaration.name.getText(ast);
  let initializer = declaration.initializer;
  while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) initializer = initializer.expression;
  const fields = initializer.elements.map(element => Object.fromEntries(element.properties.map(prop => [
    prop.name.getText(ast),
    prop.initializer.kind === ts.SyntaxKind.FalseKeyword ? false : prop.initializer.text,
  ])));
  for (const definition of schemaNames) checkFields(definition, fields.map(field => field.field));
  const tableUse = new RegExp(String.raw`\buseApiTableColumns\s*\([^;]*?\b${symbol}\b`, "s");
  const component = components.find(entry => tableUse.test(entry.source));
  if (!component) {
    drift.push(`${symbol}: not connected to a table`);
    continue;
  }
  const adapter = modules.find(file => read(file).includes(`captureApiTableFields(raw, ${symbol})`) || read(file).includes(`captureApiTableFields(value, ${symbol})`));
  if (!adapter) drift.push(`${symbol}: API adapter discards display values`);
  const componentSource = component.source;
  const existing = new Set([...componentSource.matchAll(/\bid:\s*"([^"]+)"/g)].map(match => match[1]));
  const added = fields
    .filter(field => field.column !== false && !existing.has(field.columnId ?? field.field))
    .map(field => field.field);
  records.push({ definition: schemaNames.join(", "), component: component.file, fields: fields.length,
    hidden: fields.filter(field => field.column === false).map(field => field.field), added });
}

// Small lookup/catalog tables do not use the configurable directory component.
for (const [definition, component, fields, intentionallyNotColumns] of [
  ["employeetitle.EmployeeTitle", "src/components/employee-titles/employee-titles-workspace.tsx", ["id", "name", "active", "createdAt", "updatedAt"],
    { translations: "Canonical API name is displayed; the seed translation map is not a raw directory column." }],
  ["employeedepartment.EmployeeDepartment", "src/components/employee-departments/employee-departments-workspace.tsx", ["id", "name", "active", "createdAt", "updatedAt"],
    { translations: "Canonical API name is displayed; the seed translation map is not a raw directory column." }],
  ["barcodestatus.BarcodeStatus", "src/components/barcodes/barcode-statuses-workspace.tsx", ["id", "name", "prevStatus"], {}],
  ["report.ReportDefinition", "src/components/reports/reports-workspace.tsx", ["id", "key", "type", "name", "description", "icon", "filters", "outputs"],
    { enabled: "Catalog administration metadata retained by the adapter, not a saved-report column.",
      sortOrder: "Catalog administration metadata retained by the adapter, not a saved-report column.",
      createdAt: "Catalog administration timestamp retained by the adapter, not a generated report timestamp.",
      updatedAt: "Catalog administration timestamp retained by the adapter, not a generated report timestamp." }],
]) {
  const hidden = Object.keys(intentionallyNotColumns);
  checkFields(definition, [...fields, ...hidden]);
  const source = read(component);
  for (const field of fields) {
    if (!source.includes(`.${field}`)) drift.push(`${component}: missing ${field}`);
  }
  records.push({ definition, component, fields: fields.length + hidden.length, hidden, added: [] });
}
if (drift.length) {
  console.error(`API table contract drift:\n${drift.join("\n")}`);
  process.exit(1);
}
records.sort((a, b) => a.definition.localeCompare(b.definition));
const total = records.reduce((sum, record) => sum + record.fields, 0);
console.log(`API table coverage: ${records.length} table/catalog surfaces, ${total} schema/compatibility fields. All checks passed.`);

if (process.argv.includes("--write")) {
  const lines = [
    "# API table field coverage", "",
    `Source: \`${API_REFERENCE_SPEC}\` (emsys-api reference clone) → \`definitions\` (Swagger 2) or \`components.schemas\` (OpenAPI 3). Regenerate and verify with \`node scripts/audit-api-table-columns.mjs --write\`.`, "",
    `The ${records.length} table/catalog surfaces below cover ${total} schema/compatibility fields. Metadata distinguishes existing columns, optional columns and intentionally omitted raw fields. Existing column layouts, storage keys and user preferences are preserved.`, "",
    "For fields with columns, nested values stay within their owning column and existing business renderers retain their formatting. Fields marked `column: false` are intentionally not copied into raw table display data; typed feature models/actions remain unchanged. Missing values display a dash; zero and false remain distinct. Response schema coverage never enables unsupported sorting.", "",
    "| API definition | Table/catalog surface | Fields | Generated field candidates | Intentionally not columns |",
    "| --- | --- | ---: | --- | --- |",
    ...records.map(record => `| \`${record.definition}\` | [${record.component.split("/").at(-1)}](../${record.component}) | ${record.fields} | ${record.added.map(field => `\`${field}\``).join(", ") || "See existing/catalog columns"} | ${record.hidden.map(field => `\`${field}\``).join(", ") || "—"} |`),
    "", "## Field aliases and scope", "",
    "- Feature-owned `table-fields.ts` files map API names to existing UI column IDs (for example, invoice `number` → `invoiceNumber`, `payment` → `amountPaid`).",
    "- Per APP_CONTEXT.md, invoice `receivedBy`, legacy `employee`, and legacy `route` share the existing **Received by** column; container `seal` and `sealNumber` share **Seal number**. These are intentional business aliases.",
    "- Version/permission/command fields and raw inventory workflow objects use `column: false`; their typed feature models/actions remain authoritative. This documents coverage without generating new raw columns or duplicating money/account renderers.",
    "- Employee title/department translation maps are deliberately not directory columns; the canonical API name is displayed.",
    "- Reports is a generation hub, not a saved-report directory. Output formats are consumed by its PDF/Excel controls. Catalog enabled/sort/timestamp metadata remains in the adapter, without adding raw report rows or changing the hub flow.",
    "- Shared clearable-payment metadata is checked against Deposit, ZellePayment and CreditCardPayment independently, rather than assuming check.Check is interchangeable.",
    ...Object.entries(compatibilityFields).flatMap(([definition, fields]) => Object.entries(fields).map(([field, reason]) => `- Compatibility field \`${definition}.${field}\`: ${reason}`)),
    definitions["loan.Loan"]
      ? "- The Loans table is not yet connected to schema coverage; the reference `loan.Loan` definition is available for that follow-up."
      : "- Loans have a table but no loan record definition in the API reference, so field completeness cannot be established from this file.",
    "- Request DTOs, response envelopes, nested references, analytics responses, lookup-only resources, card/form views, and contextual invoice/route detail tables are not separate directory tables. This audit does not create directories for them or expand compact detail tables.",
    "- Nested legacy credentials (`password`, `accessCode`, tokens, secrets) are excluded from captured display data.",
    "",
  ];
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/api-table-field-coverage.md"), lines.join("\n"));
}
