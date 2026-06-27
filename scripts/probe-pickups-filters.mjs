#!/usr/bin/env node
/**
 * Probe every pickups (orders) advanced-filter field × operator combo against
 * POST /pickups/search to see which the EMSYS API accepts and which fail.
 *
 * Mirrors how the UI builds the search body (filter-fields.ts + order-filters.ts
 * + search-query.ts): phone fields expand to an OR group across queryFields,
 * range fields expand to gte/lte AND groups, and `completed` maps to a boolean.
 *
 * Usage (any of):
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=1 node scripts/probe-pickups-filters.mjs
 *   EMSYS_EMAIL=you@x.com EMSYS_PASSWORD=secret node scripts/probe-pickups-filters.mjs
 *
 * Token resolution order:
 *   1. EMSYS_TOKEN
 *   2. Firebase sign-in with EMSYS_EMAIL + EMSYS_PASSWORD (uses the public web
 *      API key from .env, NEXT_PUBLIC_FIREBASE_API_KEY)
 *   3. NEXT_PUBLIC_DEV_ID_TOKEN from .env (note: Firebase JWTs expire ~1 hour)
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
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
    // no .env — ignore
  }
  return undefined;
}

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();

async function signInWithFirebase(email, password) {
  const apiKey = readEnvFallback("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY missing from .env");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Firebase sign-in failed: ${json?.error?.message ?? response.status}`);
  }
  return json.idToken;
}

async function resolveToken() {
  if (process.env.EMSYS_TOKEN?.trim()) return process.env.EMSYS_TOKEN.trim();

  const email = process.env.EMSYS_EMAIL?.trim();
  const password = process.env.EMSYS_PASSWORD?.trim();
  if (email && password) {
    console.log(`Signing in to Firebase as ${email}…`);
    return signInWithFirebase(email, password);
  }

  return (readEnvFallback("NEXT_PUBLIC_DEV_ID_TOKEN") ?? "").trim();
}

const token = await resolveToken();

if (!token) {
  console.error(
    "No token. Set EMSYS_TOKEN, or EMSYS_EMAIL + EMSYS_PASSWORD, or NEXT_PUBLIC_DEV_ID_TOKEN in .env.",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

const TEXT = ["startsWith", "contains", "eq", "neq"];
const DATE = ["eq", "neq", "gte", "lte"];
const PHONE = ["startsWith", "contains", "eq", "neq"];

/** Each entry mirrors ORDER_TABLE_FILTER_FIELDS with a representative sample value. */
const FIELDS = [
  { field: "sender.name", ops: TEXT, sample: "a" },
  { field: "sender.phone", ops: PHONE, sample: "8095551234", queryFields: ["sender.phones.number", "sender.phone1"] },
  { field: "sender.address.address1", ops: TEXT, sample: "a" },
  { field: "sender.address.address2", ops: TEXT, sample: "a" },
  { field: "sender.address.city", ops: TEXT, sample: "a" },
  { field: "sender.address.state", ops: TEXT, sample: "NY" },
  { field: "sender.address.zipcode", ops: [...TEXT, "gte", "lte"], sample: "10001" },
  { field: "sender.zipRange", ops: ["eq"], sample: "10001-10282", expand: "zipRange" },
  { field: "purpose", ops: TEXT, sample: "a" },
  { field: "receiver.name", ops: TEXT, sample: "a" },
  { field: "receiver.phone", ops: PHONE, sample: "8095551234", queryFields: ["receiver.phones.number", "receiver.phone1"] },
  { field: "receiver.address.address1", ops: TEXT, sample: "a" },
  { field: "receiver.address.address2", ops: TEXT, sample: "a" },
  { field: "receiver.address.city", ops: TEXT, sample: "a" },
  { field: "receiver.address.state", ops: TEXT, sample: "NY" },
  { field: "receiver.address.zipcode", ops: [...TEXT, "gte", "lte"], sample: "10001" },
  { field: "user.name", ops: ["eq", "neq", "contains", "startsWith"], sample: "a" },
  { field: "completed", ops: ["eq", "neq"], sample: "true", expand: "completed" },
  { field: "date", ops: DATE, sample: "2026-01-01" },
  { field: "dateRange", ops: ["eq"], sample: "2026-01-01 to 2026-06-30", expand: "dateRange:date" },
  { field: "createdAt", ops: DATE, sample: "2026-01-01" },
  { field: "createdAtRange", ops: ["eq"], sample: "2026-01-01 to 2026-06-30", expand: "dateRange:createdAt" },
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

/** Build the filter node for a field+operator the same way the UI does. */
function buildNode(entry, op) {
  if (entry.expand === "zipRange") {
    const r = parseRange(entry.sample);
    return {
      operator: "and",
      filters: [
        { field: "sender.address.zipcode", operator: "gte", value: r.start },
        { field: "sender.address.zipcode", operator: "lte", value: r.end },
      ],
    };
  }
  if (entry.expand?.startsWith("dateRange:")) {
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
  if (entry.expand === "completed") {
    const wantsCompleted = entry.sample === "true";
    const value = op === "neq" ? !wantsCompleted : wantsCompleted;
    return { field: "completed", operator: "eq", value };
  }
  if (entry.queryFields?.length) {
    const filters = entry.queryFields.map((field) => ({
      field,
      operator: op,
      value: normalizePhone(entry.sample),
    }));
    return filters.length === 1 ? filters[0] : { operator: "or", filters };
  }
  return { field: entry.field, operator: op, value: entry.sample };
}

/** Wrap a node into the POST /search body, matching buildAdvancedSearchBody. */
function buildBody(node) {
  const pagination = { page: 1, limit: 1, offset: 0 };
  const sort = [{ field: "date", direction: "desc" }];

  if ("filters" in node) {
    return { operator: node.operator, filters: node.filters, pagination, sort };
  }
  return { operator: "and", filters: [node], pagination, sort };
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
console.log(`Endpoint : POST /pickups/search?page=1&limit=1\n`);

const results = [];

for (const entry of FIELDS) {
  for (const op of entry.ops) {
    const node = buildNode(entry, op);
    const body = buildBody(node);
    let row;
    try {
      const { status, json } = await request("/pickups/search?page=1&limit=1&offset=0", body);
      const ok = status >= 200 && status < 300 && !(json && json.success === false);
      row = { field: entry.field, op, status, ok, detail: summarize(json) };
    } catch (error) {
      row = { field: entry.field, op, status: 0, ok: false, detail: `network: ${error.message}` };
    }
    results.push(row);
    const mark = row.ok ? "PASS" : "FAIL";
    console.log(
      `[${mark}] ${entry.field.padEnd(26)} ${op.padEnd(11)} ${String(row.status).padEnd(4)} ${row.detail}`,
    );
  }
}

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);

console.log(`\n=== SUMMARY ===`);
console.log(`Total combos : ${results.length}`);
console.log(`Passed       : ${passed.length}`);
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
