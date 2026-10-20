#!/usr/bin/env node
/**
 * Smoke-test the Reports catalog endpoint behind the Reports table (read-only).
 *
 * Covers:
 *   GET /reports — enabled report definitions for the tenant
 *
 * Validates every definition has the fields the portal catalog needs
 * (`key`, `name`; `type`/`filters`/`outputs` shapes) and that keys are unique.
 * Report generation endpoints (POST /reports/<kind>) produce documents and are
 * covered by the feature suites (invoices, pickups), not here.
 *
 * Usage:
 *   node scripts/test-reports-api.mjs '<jwt>'
 */
import { createApiSuite } from "./lib/api-suite.mjs";

const suite = createApiSuite({ title: "Reports catalog API smoke test (read-only)" });
const { pass, fail, note, rowsOf } = suite;

suite.banner();

console.log("=== Catalog ===");
const list = await suite.listOrExit("/reports");
const definitions = rowsOf(list);

if (definitions.length === 0) {
  note("GET /reports returned no definitions for this tenant.");
} else {
  const invalid = definitions.filter((entry) => !String(entry?.key ?? "").trim() || !String(entry?.name ?? "").trim());
  if (invalid.length === 0) pass("every definition has key + name", `${definitions.length} definitions`);
  else fail("every definition has key + name", 200, `${invalid.length} missing key/name: ${JSON.stringify(invalid.slice(0, 2)).slice(0, 160)}`);

  const keys = definitions.map((entry) => String(entry?.key ?? "").trim()).filter(Boolean);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length === 0) pass("report keys are unique");
  else fail("report keys are unique", 200, `duplicates: ${[...new Set(duplicates)].join(", ")}`);

  const badShapes = definitions.filter(
    (entry) => (entry.filters != null && !Array.isArray(entry.filters)) || (entry.outputs != null && !Array.isArray(entry.outputs)),
  );
  if (badShapes.length === 0) pass("filters/outputs are arrays when present");
  else fail("filters/outputs are arrays when present", 200, badShapes.map((entry) => entry.key).join(", "));

  const types = [...new Set(definitions.map((entry) => String(entry?.type ?? "").trim()).filter(Boolean))];
  note(`Report categories: ${types.join(", ") || "(none)"}`);
}

suite.finish("All report catalog checks passed.");
