#!/usr/bin/env node
/**
 * Probe every invoices advanced-filter field × operator combo against
 * POST /invoices/search to see which the EMSYS API accepts and which fail.
 *
 * Mirrors how the UI builds the invoice search body (filter-fields.ts +
 * invoice-filters.ts + invoices-api.ts): Stripe-style body with URL pagination,
 * `sort` + `filters` (array of groups) in the body. Phone/address fields expand
 * to OR groups across queryFields; range fields expand to gte/lte AND groups;
 * paidRegion maps usa/dr; isArchive/isVoid map to booleans.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-invoices-filters.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readEnvFallback(key) {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(new RegExp(`^${key}=(.*)$`));
      if (match) return match[1].trim();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? readEnvFallback("NEXT_PUBLIC_DEV_ID_TOKEN") ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();

if (!token) {
  console.error("Set EMSYS_TOKEN or NEXT_PUBLIC_DEV_ID_TOKEN in .env.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

const TEXT = ["startsWith", "contains", "eq", "neq"];
const DATE = ["eq", "neq", "gte", "lte"];
const NUMERIC = ["eq", "neq", "gte", "lte", "gt", "lt"];
const PHONE = ["startsWith", "contains", "eq", "neq"];

const SENDER_ADDR = [
  "sender.address.address1",
  "sender.address.address2",
  "sender.address.city",
  "sender.address.state",
  "sender.address.zipcode",
];
const RECEIVER_ADDR = [
  "receiver.address.address1",
  "receiver.address.address2",
  "receiver.address.city",
  "receiver.address.state",
  "receiver.address.zipcode",
];

const FIELDS = [
  { field: "number", ops: TEXT, sample: "4" },
  { field: "numberRange", ops: ["eq"], sample: "488800 to 488900", expand: "range:number" },
  { field: "date", ops: DATE, sample: "2026-01-01" },
  { field: "dateRange", ops: ["eq"], sample: "2026-01-01 to 2026-06-30", expand: "range:date" },
  { field: "paidRegion", ops: ["eq", "neq"], sample: "NY" },
  { field: "paidStatus", ops: ["eq", "neq"], sample: "OPEN" },
  { field: "cost", ops: NUMERIC, sample: "10" },
  { field: "discount", ops: NUMERIC, sample: "10" },
  { field: "payment", ops: NUMERIC, sample: "10" },
  { field: "balance", ops: NUMERIC, sample: "10" },
  { field: "container.name", ops: TEXT, sample: "a" },
  { field: "sender.name", ops: TEXT, sample: "a" },
  { field: "sender.id", ops: ["eq", "neq", "in", "notIn"], sample: "123" },
  { field: "sender.phone", ops: PHONE, sample: "8095551234", queryFields: ["sender.phones.number", "sender.phone1"] },
  { field: "sender.address", ops: TEXT, sample: "a", queryFields: SENDER_ADDR },
  { field: "receiver.name", ops: TEXT, sample: "a" },
  { field: "receiver.id", ops: ["eq", "neq", "in", "notIn"], sample: "123" },
  { field: "receiver.phone", ops: PHONE, sample: "8095551234", queryFields: ["receiver.phones.number", "receiver.phone1"] },
  { field: "receiver.address", ops: TEXT, sample: "a", queryFields: RECEIVER_ADDR },
  { field: "user.name", ops: ["eq", "neq", "contains", "startsWith"], sample: "a" },
  { field: "employee.id", ops: ["eq", "neq"], sample: "1" },
  { field: "employee.name", ops: TEXT, sample: "a" },
  { field: "isArchive", ops: ["eq", "neq"], sample: "false", expand: "bool" },
  { field: "isVoid", ops: ["eq", "neq"], sample: "false", expand: "bool" },
  { field: "createdAt", ops: DATE, sample: "2026-01-01" },
  { field: "createdAtRange", ops: ["eq"], sample: "2026-01-01 to 2026-06-30", expand: "range:createdAt" },
  { field: "updatedAt", ops: DATE, sample: "2026-01-01" },
  { field: "updatedAtRange", ops: ["eq"], sample: "2026-01-01 to 2026-06-30", expand: "range:updatedAt" },
];

function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function parseRange(raw) {
  const trimmed = raw.trim();
  for (const sep of [" to ", "..", "–", "—"]) {
    if (trimmed.includes(sep)) {
      const [start, end] = trimmed.split(sep).map((p) => p.trim());
      if (start && end) return { start, end };
    }
  }
  const dash = trimmed.match(/^(\S+)\s*-\s*(\S+)$/);
  if (dash) return { start: dash[1], end: dash[2] };
  return null;
}

function buildNode(entry, op) {
  if (entry.expand?.startsWith("range:")) {
    const target = entry.expand.split(":")[1];
    const r = parseRange(entry.sample);
    return {
      operator: "and",
      filters: [
        { field: target, operator: "gte", value: r.start },
        { field: target, operator: "lte", value: r.end },
      ],
    };
  }
  if (entry.expand === "bool") {
    return { field: entry.field, operator: op, value: entry.sample === "true" };
  }
  if (entry.queryFields?.length) {
    const isPhone = entry.field.endsWith(".phone");
    const filters = entry.queryFields.map((field) => ({
      field,
      operator: op,
      value: isPhone ? normalizePhone(entry.sample) : entry.sample,
    }));
    return filters.length === 1 ? filters[0] : { operator: "or", filters };
  }
  return { field: entry.field, operator: op, value: entry.sample };
}

/** Stripe-style invoice body: URL pagination, sort + filters(group array) in body. */
function buildBody(node) {
  const sort = [{ field: "number", direction: "desc" }];
  const group = "filters" in node ? node : { operator: "and", filters: [node] };
  return { sort, filters: [group] };
}

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

function summarize(json) {
  if (json && typeof json === "object") {
    if (json.error) return String(json.error).slice(0, 120);
    if (json.message && json.success === false) return String(json.message).slice(0, 120);
    const count = Array.isArray(json.data) ? json.data.length : 0;
    return `rows=${count} subtotal=${json.subtotal ?? "-"} total=${json.total ?? "-"}`;
  }
  return String(json).slice(0, 120);
}

console.log(`Base URL : ${baseUrl}`);
console.log(`Company  : ${companyId}`);
console.log(`Endpoint : POST /invoices/search?page=1&limit=1&offset=0\n`);

const results = [];

for (const entry of FIELDS) {
  for (const op of entry.ops) {
    const body = buildBody(buildNode(entry, op));
    let row;
    try {
      const { status, json } = await request("/invoices/search?page=1&limit=1&offset=0", body);
      const ok = status >= 200 && status < 300 && !(json && json.success === false);
      row = { field: entry.field, op, status, ok, detail: summarize(json) };
    } catch (error) {
      row = { field: entry.field, op, status: 0, ok: false, detail: `network: ${error.message}` };
    }
    results.push(row);
    console.log(
      `[${row.ok ? "PASS" : "FAIL"}] ${entry.field.padEnd(22)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} ${row.detail}`,
    );
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== SUMMARY ===`);
console.log(`Total combos : ${results.length}`);
console.log(`Passed       : ${results.length - failed.length}`);
console.log(`Failed       : ${failed.length}`);

if (failed.length) {
  console.log(`\nFailing combos:`);
  for (const r of failed) {
    console.log(`  - ${r.field} ${r.op} -> ${r.status} ${r.detail}`);
  }
}

if (results.every((r) => r.status === 401)) {
  console.log(`\nAll requests returned 401 — the token is expired/invalid. Re-run with a fresh EMSYS_TOKEN.`);
}
