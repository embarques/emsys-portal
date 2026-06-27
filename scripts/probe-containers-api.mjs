#!/usr/bin/env node
/**
 * Probe container model shape + which field × operator filter combos the backend
 * accepts (and matches) via POST /containers/search, plus the OR bar search.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-containers-api.mjs
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
const RESOURCE = "/containers";

if (!token) {
  console.error("Set EMSYS_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

async function post(path, body) {
  const r = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
}

async function search(label, field, operator, value) {
  const { status, json } = await post(`${RESOURCE}/search?page=1&limit=1&offset=0`, {
    sort: [{ field: "id", direction: "desc" }],
    filters: [{ operator: "and", filters: [{ field, operator, value }] }],
  });
  const ok = status >= 200 && status < 300 && json?.success !== false;
  const matched = Array.isArray(json?.data) ? json.data.length : 0;
  const detail = ok
    ? `rows=${matched} subtotal=${json?.subtotal ?? "-"} total=${json?.total ?? "-"}`
    : (json?.error ?? json?.message ?? JSON.stringify(json)).toString().slice(0, 70);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label.padEnd(40)} ${String(status).padEnd(4)} ${detail}`);
}

// 1) Sample one container to inspect keys + realistic values.
const sampleRes = await fetch(`${baseUrl}${RESOURCE}?limit=1`, { headers });
const sampleJson = await sampleRes.json().catch(() => null);
const sample = Array.isArray(sampleJson?.data) ? sampleJson.data[0] : null;
console.log("=== GET /containers?limit=1 ===");
console.log("status:", sampleRes.status, "total:", sampleJson?.total);
console.log("sample:", JSON.stringify(sample, null, 2));
console.log("keys:", sample ? Object.keys(sample).join(", ") : "(none)");

const sub = (v) => (typeof v === "string" && v.length >= 2 ? v.slice(0, 2) : v != null ? String(v) : "a");

const textFields = ["name", "containerNumber", "booking", "sealNumber", "seal", "broker", "company"];
const TEXT_OPS = ["contains", "startsWith", "eq", "neq"];
const NUM_OPS = ["eq", "neq", "gte", "lte", "gt", "lt"];
const DATE_OPS = ["eq", "neq", "gte", "lte"];

console.log("\n=== TEXT fields × ops ===");
for (const field of textFields) {
  const value = sub(sample?.[field]);
  for (const op of TEXT_OPS) await search(`${field} ${op} "${value}"`, field, op, value);
}

console.log("\n=== NUMERIC fields (number values) ===");
for (const field of ["id", "cost"]) {
  for (const op of NUM_OPS) await search(`${field} ${op} 1 (number)`, field, op, 1);
}

console.log("\n=== NUMERIC fields (string values, as UI sends) ===");
for (const field of ["id", "cost"]) {
  await search(`${field} gte "1" (string)`, field, "gte", "1");
  await search(`${field} eq "${sample?.[field] ?? 1}" (string)`, field, "eq", String(sample?.[field] ?? 1));
}

console.log("\n=== DATE fields (string YYYY-MM-DD) ===");
for (const field of ["departureDate", "arrivalDate"]) {
  for (const op of DATE_OPS) await search(`${field} ${op} "2024-01-01"`, field, op, "2024-01-01");
}

console.log("\n=== OR contains across ALL fields (bar search) ===");
{
  const allFields = [...textFields, "id", "cost", "departureDate", "arrivalDate"];
  const term = sub(sample?.name);
  const { status, json } = await post(`${RESOURCE}/search?page=1&limit=1&offset=0`, {
    sort: [{ field: "id", direction: "desc" }],
    filters: [
      { operator: "or", filters: allFields.map((field) => ({ field, operator: "contains", value: term })) },
    ],
  });
  const ok = status >= 200 && status < 300 && json?.success !== false;
  console.log(
    `[${ok ? "PASS" : "FAIL"}] OR contains "${term}" across ${allFields.length} fields  ${status}  subtotal=${json?.subtotal ?? "-"} total=${json?.total ?? "-"}` +
      (ok ? "" : `  ${(json?.error ?? json?.message ?? "").toString().slice(0, 80)}`),
  );

  // Also probe the OR group per added field to isolate any offender.
  for (const field of ["id", "cost", "departureDate", "arrivalDate"]) {
    const res = await post(`${RESOURCE}/search?page=1&limit=1&offset=0`, {
      sort: [{ field: "id", direction: "desc" }],
      filters: [{ operator: "or", filters: [{ field, operator: "contains", value: term }] }],
    });
    const okf = res.status >= 200 && res.status < 300 && res.json?.success !== false;
    console.log(`   - contains on ${field}: ${okf ? "PASS" : "FAIL"} ${res.status}`);
  }
}
