import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const definitions = JSON.parse(fs.readFileSync(path.join(root, "api-docs.json"), "utf8")).definitions;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = (directory, suffix) => fs.readdirSync(path.join(root, directory), { recursive: true })
  .filter(file => file.endsWith(suffix)).map(file => `${directory}/${file}`);
const components = files("src/components", "workspace.tsx");
const modules = files("src/lib", ".ts");
const records = [];

for (const file of modules.filter(file => file.endsWith("/table-fields.ts"))) {
  const source = read(file);
  const definition = /definitions\["([^"]+)"\]/.exec(source)?.[1];
  assert.ok(definition && definitions[definition], `Unknown API definition in ${file}`);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let declaration;
  ast.forEachChild(node => {
    if (ts.isVariableStatement(node)) declaration = node.declarationList.declarations[0];
  });
  const symbol = declaration.name.getText(ast);
  let initializer = declaration.initializer;
  while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) initializer = initializer.expression;
  const fields = initializer.elements.map(element => Object.fromEntries(element.properties.map(prop => [prop.name.getText(ast), prop.initializer.text])));
  const expected = Object.keys(definitions[definition].properties).sort();
  assert.deepEqual(fields.map(field => field.field).sort(), expected, `${definition}: table contract drifted from API definitions`);
  const component = components.find(file => read(file).includes(`, ${symbol})`));
  assert.ok(component, `${symbol}: not connected to a table`);
  const adapter = modules.find(file => read(file).includes(`captureApiTableFields(raw, ${symbol})`) || read(file).includes(`captureApiTableFields(value, ${symbol})`));
  assert.ok(adapter, `${symbol}: API adapter discards display values`);
  const componentSource = read(component);
  const existing = new Set([...componentSource.matchAll(/\bid:\s*"([^"]+)"/g)].map(match => match[1]));
  const added = fields.filter(field => !existing.has(field.columnId ?? field.field)).map(field => field.field);
  records.push({ definition, component, fields: fields.length, added });
}

// Small lookup/catalog tables do not use the configurable directory component.
for (const [definition, component, fields] of [
  ["employeetitle.EmployeeTitle", "src/components/employee-titles/employee-titles-workspace.tsx", ["id", "name", "active", "createdAt", "updatedAt"]],
  ["employeedepartment.EmployeeDepartment", "src/components/employee-departments/employee-departments-workspace.tsx", ["id", "name", "active", "createdAt", "updatedAt"]],
  ["barcodestatus.BarcodeStatus", "src/components/barcodes/barcode-statuses-workspace.tsx", ["id", "name", "prevStatus"]],
  ["report.ReportDefinition", "src/components/reports/reports-workspace.tsx", ["id", "key", "type", "name", "description", "icon", "enabled", "sortOrder", "filters", "createdAt", "updatedAt"]],
]) {
  assert.deepEqual([...fields].sort(), Object.keys(definitions[definition].properties).sort(), `${definition}: review catalog columns`);
  const source = read(component);
  for (const field of fields) assert.ok(source.includes(`.${field}`), `${component}: missing ${field}`);
  records.push({ definition, component, fields: fields.length, added: [] });
}
records.sort((a, b) => a.definition.localeCompare(b.definition));
const total = records.reduce((sum, record) => sum + record.fields, 0);
console.log(`API table coverage: ${records.length} tables, ${total} documented top-level fields. All checks passed.`);

if (process.argv.includes("--write")) {
  const lines = [
    "# API table field coverage", "",
    "Source: `api-docs.json` → `definitions`. Regenerate and verify with `node scripts/audit-api-table-columns.mjs --write`.", "",
    `The ${records.length} directory and catalog tables below cover ${total} documented top-level response fields. Added columns are visible by default. Each configurable table starts a new saved layout; subsequent user visibility, order, and width choices persist.`, "",
    "Nested objects and arrays are displayed within their owning field column. Existing business columns retain their custom formatting. Missing API values display a dash; zero and false remain visible. Added response fields do not enable sorting unless the table already supports the field.", "",
    "| API definition | Table | Fields | Added API field columns |",
    "| --- | --- | ---: | --- |",
    ...records.map(record => `| \`${record.definition}\` | [${record.component.split("/").at(-1)}](../${record.component}) | ${record.fields} | ${record.added.map(field => `\`${field}\``).join(", ") || "See existing/catalog columns"} |`),
    "", "## Field aliases and scope", "",
    "- Feature-owned `table-fields.ts` files map API names to existing UI column IDs (for example, invoice `number` → `invoiceNumber`, `payment` → `amountPaid`).",
    "- Per APP_CONTEXT.md, invoice `receivedBy`, legacy `employee`, and legacy `route` share the existing **Received by** column; container `seal` and `sealNumber` share **Seal number**. These are intentional business aliases.",
    "- Employee title/department catalogs gained created/updated timestamps; barcode statuses gained ID; report definitions gained ID, key, icon, enabled, sort order, filters, and timestamps.",
    "- Loans have a table but no loan record definition in this API snapshot, so field completeness cannot be established from this file.",
    "- Request DTOs, response envelopes, nested references, analytics responses, lookup-only resources, card/form views, and contextual invoice/route detail tables are not separate directory tables. This audit does not create directories for them or expand compact detail tables.",
    "- Nested legacy credentials (`password`, `accessCode`, tokens, secrets) are excluded from captured display data.",
    "",
  ];
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/api-table-field-coverage.md"), lines.join("\n"));
}
