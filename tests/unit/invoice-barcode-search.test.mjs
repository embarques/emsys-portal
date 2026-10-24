import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(
  fs.readFileSync(new URL("../../src/lib/barcodes/invoice-search.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const loaded = { exports: {} };
new Function("exports", source)(loaded.exports);
const { buildInvoiceBarcodesHref, invoiceBarcodeFilterRows } = loaded.exports;

test("selected invoices become exact OR filters, preserving invoice numbers", () => {
  const href = buildInvoiceBarcodesHref([" 00123 ", "INV & 2", "00123", ""]);
  const rows = invoiceBarcodeFilterRows(new URL(href, "https://example.test").searchParams);
  assert.deepEqual(rows.map(({ field, operator, value, join }) => ({ field, operator, value, join })), [
    { field: "invoice.number", operator: "eq", value: "00123", join: "or" },
    { field: "invoice.number", operator: "eq", value: "INV & 2", join: "or" },
  ]);
  assert.equal(new Set(rows.map((row) => row.id)).size, 2);
});

test("ordinary barcode navigation has no invoice filters", () => {
  assert.deepEqual(invoiceBarcodeFilterRows(new URLSearchParams("tab=2")), []);
});
