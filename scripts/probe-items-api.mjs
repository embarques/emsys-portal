#!/usr/bin/env node
/**
 * Probe the items (invoice-descriptions) API: model shape, full CRUD, and which
 * fields/operators the search endpoint accepts.
 *
 * Creates a clearly-labeled test item and deletes it at the end.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-items-api.mjs
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

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
}

function dataOf(json) {
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

// ---- 1) Model shape ----
console.log("=== GET /invoice-descriptions?limit=1 ===");
const list = await req("GET", `${RESOURCE}?page=1&limit=1&offset=0&sort=name:asc`);
console.log("status:", list.status, "total:", list.json?.total);
const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
console.log("sample item:", JSON.stringify(sample, null, 2));
console.log("keys:", sample ? Object.keys(sample).join(", ") : "(none)");

// ---- 2) Search field/operator matrix ----
console.log("\n=== Search field × operator matrix (POST /invoice-descriptions/search) ===");
async function search(field, operator, value) {
  const body = {
    sort: [{ field: "name", direction: "asc" }],
    filters: [{ operator: "and", filters: [{ field, operator, value }] }],
  };
  const { status, json } = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, body);
  const ok = status >= 200 && status < 300 && json?.success !== false;
  const detail = ok
    ? `rows=${Array.isArray(json.data) ? json.data.length : 0} subtotal=${json.subtotal ?? "-"} total=${json.total ?? "-"}`
    : (json?.error ?? json?.message ?? JSON.stringify(json)).toString().slice(0, 70);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${field.padEnd(12)} ${operator.padEnd(9)} ${String(status).padEnd(4)} ${detail}`);
  return ok;
}

const TEXT = ["contains", "startsWith", "eq", "neq"];
const NUM = ["eq", "neq", "gte", "lte", "gt", "lt"];
const DATE = ["eq", "neq", "gte", "lte"];
const matrix = [
  ["name", TEXT, "a"],
  ["price", NUM, 1],
  ["id", ["eq", "neq", "gte", "lte"], 1],
  ["createdAt", DATE, "2020-01-01"],
  ["updatedAt", DATE, "2020-01-01"],
];
for (const [field, ops, value] of matrix) {
  for (const op of ops) await search(field, op, value);
}

// ---- 3) OR bar-search across all fields with contains ----
console.log("\n=== OR contains across all fields (bar search) ===");
const orBody = {
  sort: [{ field: "name", direction: "asc" }],
  filters: [
    {
      operator: "or",
      filters: [
        { field: "name", operator: "contains", value: "box" },
        { field: "price", operator: "contains", value: "box" },
        { field: "id", operator: "contains", value: "box" },
      ],
    },
  ],
};
const orRes = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, orBody);
console.log("status:", orRes.status, JSON.stringify(dataOf(orRes.json))?.slice?.(0, 120) ?? orRes.json);

// ---- 4) CRUD ----
console.log("\n=== CRUD ===");
const testName = `ZZ_PROBE_ITEM_${Date.now()}`;

const created = await req("POST", RESOURCE, { name: testName, price: 1.23 });
console.log(`[CREATE] status=${created.status}`, JSON.stringify(created.json)?.slice(0, 160));
let newId =
  (typeof dataOf(created.json) === "object" && dataOf(created.json)?.id) ||
  (typeof dataOf(created.json) === "number" ? dataOf(created.json) : null);

if (!newId) {
  const found = await req("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
    sort: [{ field: "name", direction: "asc" }],
    filters: [{ operator: "and", filters: [{ field: "name", operator: "eq", value: testName }] }],
  });
  newId = Array.isArray(found.json?.data) ? found.json.data[0]?.id : null;
  console.log("resolved new id via search:", newId);
}

if (newId) {
  const read = await req("GET", `${RESOURCE}/${newId}`);
  console.log(`[READ]   status=${read.status}`, JSON.stringify(dataOf(read.json))?.slice(0, 160));

  const updated = await req("PUT", `${RESOURCE}/${newId}`, { id: Number(newId), name: `${testName}_EDIT`, price: 9.99 });
  console.log(`[UPDATE] status=${updated.status}`, JSON.stringify(updated.json)?.slice(0, 160));

  const readBack = await req("GET", `${RESOURCE}/${newId}`);
  console.log(`[VERIFY] status=${readBack.status}`, JSON.stringify(dataOf(readBack.json))?.slice(0, 160));

  const deleted = await req("DELETE", `${RESOURCE}/${newId}`);
  console.log(`[DELETE] status=${deleted.status}`, JSON.stringify(deleted.json)?.slice(0, 160));

  const readGone = await req("GET", `${RESOURCE}/${newId}`);
  console.log(`[CONFIRM-GONE] status=${readGone.status}`, JSON.stringify(dataOf(readGone.json))?.slice(0, 120));
} else {
  console.log("Could not determine created item id; skipping read/update/delete.");
}
