#!/usr/bin/env node
/**
 * Confirm whether invoice search supports nested sender/receiver phone (array)
 * and address (single object) paths, using real values from the data model.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-invoices-diagnose.mjs
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

async function search(label, filterNode) {
  const group = "filters" in filterNode ? filterNode : { operator: "and", filters: [filterNode] };
  const body = { sort: [{ field: "number", direction: "desc" }], filters: [group] };
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
    : (json?.error ?? json?.message ?? JSON.stringify(json)).toString().slice(0, 90);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label.padEnd(58)} ${String(r.status).padEnd(4)} ${detail}`);
}

console.log("=== Phone array paths (real values: 917-716-7331 / 9177167331) ===");
for (const f of ["sender.phones.number", "sender.phones.displayNumber", "sender.phones", "sender.phone"]) {
  await search(`${f} eq "9177167331"`, { field: f, operator: "eq", value: "9177167331" });
  await search(`${f} eq "917-716-7331"`, { field: f, operator: "eq", value: "917-716-7331" });
  await search(`${f} contains "917"`, { field: f, operator: "contains", value: "917" });
}

console.log("\n=== Address single-object paths (real values: BRONX / NY) ===");
for (const [f, v] of [
  ["sender.address.city", "BRONX"],
  ["sender.address.state", "NY"],
  ["sender.address.country", "US"],
  ["sender.address.address1", "a"],
  ["sender.address.zipcode", "10001"],
]) {
  await search(`${f} eq "${v}"`, { field: f, operator: "eq", value: v });
}

console.log("\n=== Controls (known-good) ===");
await search('container.name eq "123-14"', { field: "container.name", operator: "eq", value: "123-14" });
await search('sender.name contains "PAPO"', { field: "sender.name", operator: "contains", value: "PAPO" });
