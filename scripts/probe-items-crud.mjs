#!/usr/bin/env node
/**
 * Verify items filter value typing: the table UI sends string values, so confirm
 * price/id filters accept strings (not just numbers) and actually match.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-items-crud.mjs
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
const RESOURCE = "/invoice-descriptions";

if (!token) {
  console.error("Set EMSYS_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

async function search(label, field, operator, value) {
  const body = {
    sort: [{ field: "name", direction: "asc" }],
    filters: [{ operator: "and", filters: [{ field, operator, value }] }],
  };
  const r = await fetch(`${baseUrl}${RESOURCE}/search?page=1&limit=1&offset=0`, {
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
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label.padEnd(34)} ${String(r.status).padEnd(4)} ${detail}`);
}

console.log("=== price: number vs string ===");
await search("price gte 1 (number)", "price", "gte", 1);
await search('price gte "1" (string)', "price", "gte", "1");
await search('price lt "100" (string)', "price", "lt", "100");

console.log("\n=== id: number vs string ===");
await search("id gte 1 (number)", "id", "gte", 1);
await search('id gte "1" (string)', "id", "gte", "1");
await search('id eq "42" (string)', "id", "eq", "42");

console.log("\n=== date string (as UI sends) ===");
await search('createdAt gte "2024-01-01"', "createdAt", "gte", "2024-01-01");

console.log("\n=== OR contains across name+id+price with numeric query '5' ===");
{
  const body = {
    sort: [{ field: "name", direction: "asc" }],
    filters: [
      {
        operator: "or",
        filters: [
          { field: "name", operator: "contains", value: "5" },
          { field: "id", operator: "contains", value: "5" },
          { field: "price", operator: "contains", value: "5" },
        ],
      },
    ],
  };
  const r = await fetch(`${baseUrl}${RESOURCE}/search?page=1&limit=1&offset=0`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => null);
  console.log(`status=${r.status} subtotal=${json?.subtotal ?? "-"} total=${json?.total ?? "-"}`);
}
