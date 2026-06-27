#!/usr/bin/env node
/**
 * Definitive searchable-field map for the invoice.Invoice model. Tests each
 * model field (and nested object sub-paths) against POST /invoices/search to
 * reveal exactly what the backend search validator whitelists.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-invoices-model.mjs
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();

if (!token) {
  console.error("Set EMSYS_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

async function search(field, operator, value) {
  const body = {
    sort: [{ field: "number", direction: "desc" }],
    filters: [{ operator: "and", filters: [{ field, operator, value }] }],
  };
  const r = await fetch(`${baseUrl}/invoices/search?page=1&limit=1&offset=0`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  const ok = r.status >= 200 && r.status < 300 && json?.success !== false;
  const detail = ok
    ? `rows=${Array.isArray(json.data) ? json.data.length : 0} subtotal=${json.subtotal ?? "-"} total=${json.total ?? "-"}`
    : (json?.error ?? json?.message ?? JSON.stringify(json)).toString().slice(0, 70);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${field.padEnd(24)} ${operator.padEnd(9)} ${String(r.status).padEnd(4)} ${detail}`);
  return ok;
}

// [field, operator, value]
const TESTS = [
  // top-level scalars
  ["number", "contains", "4"],
  ["oldID", "eq", 1],
  ["date", "gte", "2026-01-01"],
  ["createdAt", "gte", "2026-01-01"],
  ["updatedAt", "gte", "2026-01-01"],
  ["paidRegion", "eq", "NY"],
  ["paidStatus", "eq", "OPEN"],
  ["isArchive", "eq", true],
  ["isVoid", "eq", false],
  ["registration", "eq", "a"],
  // money
  ["cost", "gte", 0],
  ["discount", "gte", 0],
  ["payment", "gte", 0],
  ["balance", "gte", 0],
  ["surcharge", "gte", 0],
  // core.User: createdBy / updatedBy / employee
  ["createdBy.name", "contains", "a"],
  ["createdBy.id", "eq", "1"],
  ["updatedBy.name", "contains", "a"],
  ["updatedBy.id", "eq", "1"],
  ["employee.name", "contains", "a"],
  ["employee.id", "eq", 1],
  // core.BranchDTO
  ["branch.id", "eq", 1],
  ["branch.name", "contains", "a"],
  ["branch.code", "eq", "NY"],
  // core.Container
  ["container.id", "eq", 1],
  ["container.name", "contains", "a"],
  // customer.Customer
  ["sender.id", "eq", "1"],
  ["sender.name", "contains", "a"],
  ["sender.oldID", "eq", 1],
  ["receiver.id", "eq", "1"],
  ["receiver.name", "contains", "a"],
  // pickup.Pickup
  ["pickup.id", "eq", 1],
  // invoiceDetails (array)
  ["invoiceDetails.name", "contains", "a"],
  ["invoiceDetails.description", "contains", "a"],
  ["invoiceDetails.barcode", "contains", "a"],
];

const results = [];
for (const [field, op, value] of TESTS) {
  const ok = await search(field, op, value);
  results.push({ field, op, ok });
}

console.log("\n=== SEARCHABLE (PASS) ===");
console.log(results.filter((r) => r.ok).map((r) => r.field).join(", ") || "(none)");
console.log("\n=== NOT SEARCHABLE (FAIL) ===");
console.log(results.filter((r) => !r.ok).map((r) => r.field).join(", ") || "(none)");
