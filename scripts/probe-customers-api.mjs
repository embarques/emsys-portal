#!/usr/bin/env node
/**
 * Probe live EMSYS customer list + search responses.
 *
 * Usage:
 *   EMSYS_TOKEN=<firebase-jwt> EMSYS_COMPANY_ID=1 node scripts/probe-customers-api.mjs
 *
 * Optional:
 *   EMSYS_API_BASE_URL=https://api.embarqueros.com/v1
 *   EMSYS_SEARCH_TERM=Maria
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = process.env.EMSYS_TOKEN?.trim();
const companyId = process.env.EMSYS_COMPANY_ID?.trim() ?? "1";
const searchTerm = process.env.EMSYS_SEARCH_TERM?.trim() ?? "a";

if (!token) {
  console.error("Set EMSYS_TOKEN (Firebase JWT) to run this probe.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

const orFields = ["name", "email", "IDNumber", "phone1", "phone2", "address.address1"];

const orFilters = orFields.map((field) => ({
  field,
  operator: "contains",
  value: searchTerm,
}));

const searchBody = {
  sort: [{ field: "name", direction: "asc" }],
  filters: [
    {
      operator: "or",
      filters: orFilters,
    },
  ],
};

console.log("=== GET /customers?limit=1 ===");
const list = await request("GET", "/customers?page=1&limit=1&offset=0&sort=name:asc");
console.log("status:", list.status);
console.log(JSON.stringify(list.json, null, 2));

const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
if (sample) {
  console.log("\n=== Sample customer keys ===");
  console.log(Object.keys(sample));
  console.log("\n=== customerType value (0=sender, 1=receiver) ===", sample.customerType ?? sample.CustomerType);
  console.log("=== address shape ===", sample.address);
}

console.log("\n=== POST /customers/search (OR contains, filters-only body) ===");
const search = await request(
  "POST",
  `/customers/search?page=1&limit=3&offset=0`,
  searchBody,
);
console.log("status:", search.status);
console.log("request body:", JSON.stringify(searchBody, null, 2));
console.log(JSON.stringify(search.json, null, 2));
