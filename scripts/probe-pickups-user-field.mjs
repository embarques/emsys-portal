#!/usr/bin/env node
/**
 * Verify the createdBy.name "Created by" filter on pickups (all operators) and
 * check whether invoices accept createdBy.name too.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-pickups-user-field.mjs
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

async function search(resource, label, field, operator, value, sortField) {
  const body = {
    operator: "and",
    filters: [{ field, operator, value }],
    pagination: { page: 1, limit: 1, offset: 0 },
    sort: [{ field: sortField, direction: "desc" }],
  };
  const r = await fetch(`${baseUrl}/${resource}/search?page=1&limit=1&offset=0`, {
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
    : (json?.error ?? json?.message ?? JSON.stringify(json)).toString().slice(0, 90);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label.padEnd(44)} ${String(r.status).padEnd(4)} ${detail}`);
}

console.log("=== Pickups: createdBy.name (all operators) ===");
for (const op of ["contains", "startsWith", "eq", "neq"]) {
  await search("pickups", `pickups createdBy.name ${op} 'a'`, "createdBy.name", op, "a", "date");
}
await search("pickups", "pickups createdBy.name neq '___none___'", "createdBy.name", "neq", "___none___", "date");

console.log("\n=== Invoices: createdBy.name (all operators) ===");
for (const op of ["contains", "startsWith", "eq", "neq"]) {
  await search("invoices", `invoices createdBy.name ${op} 'a'`, "createdBy.name", op, "a", "number");
}
