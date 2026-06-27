#!/usr/bin/env node
/**
 * Filter-matrix probe for vehicles, route-assignments, users, employees.
 * For each resource: sample a record, then test field × operator combos via
 * POST /<resource>/search, plus an OR-contains "bar search" across text fields.
 *
 * Usage: EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-filters-batch2.mjs
 */
const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" };

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, json };
}
const ok = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const errOf = (res) => (res.json?.error ?? res.json?.message ?? "").toString().slice(0, 70);

const TEXT_OPS = ["contains", "startsWith", "eq", "neq"];
const NUM_OPS = ["eq", "neq", "gte", "lte", "gt", "lt"];
const DATE_OPS = ["eq", "neq", "gte", "lte"];
const BOOL_OPS = ["eq", "neq"];

async function search(path, field, operator, value) {
  const res = await req("POST", `${path}/search?page=1&limit=1&offset=0`, {
    filters: [{ operator: "and", filters: [{ field, operator, value }] }],
  });
  const matched = Array.isArray(res.json?.data) ? res.json.data.length : 0;
  const detail = ok(res)
    ? `rows=${matched} subtotal=${res.json?.subtotal ?? "-"} total=${res.json?.total ?? "-"}`
    : errOf(res);
  console.log(`  [${ok(res) ? "PASS" : "FAIL"}] ${field.padEnd(22)} ${operator.padEnd(10)} ${String(res.status).padEnd(4)} ${detail}`);
}

function valueFor(type, sample, field) {
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (type === "bool") return true;
  if (type === "date") return "2024-01-01";
  if (type === "num") return 1;
  const v = get(sample, field);
  if (typeof v === "string" && v.length >= 2) return v.slice(0, 2);
  if (v != null && typeof v !== "object") return String(v);
  return "a";
}

async function probeResource(label, path, fields, barTextFields) {
  console.log(`\n========== ${label} (${path}) ==========`);
  const list = await req("GET", `${path}?limit=1`);
  const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
  console.log("LIST status:", list.status, "total:", list.json?.total);
  console.log("sample keys:", sample ? Object.keys(sample).join(", ") : "(none)");
  if (sample) console.log("sample:", JSON.stringify(sample).slice(0, 300));

  for (const { field, type } of fields) {
    const ops = type === "num" ? NUM_OPS : type === "date" ? DATE_OPS : type === "bool" ? BOOL_OPS : TEXT_OPS;
    for (const op of ops) await search(path, field, op, valueFor(type, sample, field));
  }

  // OR bar search across text fields
  const term = valueFor("text", sample, barTextFields[0]);
  const res = await req("POST", `${path}/search?page=1&limit=1&offset=0`, {
    filters: [{ operator: "or", filters: barTextFields.map((f) => ({ field: f, operator: "contains", value: term })) }],
  });
  console.log(`  [${ok(res) ? "PASS" : "FAIL"}] OR bar (${barTextFields.length} fields) "${term}"   ${res.status}  subtotal=${res.json?.subtotal ?? "-"} ${ok(res) ? "" : errOf(res)}`);
}

await probeResource("VEHICLES", "/vehicles", [
  { field: "vehicleId", type: "text" }, { field: "name", type: "text" }, { field: "vin", type: "text" },
  { field: "fuelType", type: "text" }, { field: "branch", type: "text" },
  { field: "createdBy", type: "text" }, { field: "createdBy.name", type: "text" },
  { field: "year", type: "num" }, { field: "id", type: "text" },
], ["vehicleId", "name", "vin", "fuelType", "branch"]);

await probeResource("ROUTE-ASSIGNMENTS", "/route-assignments", [
  { field: "routeAssignmentId", type: "text" }, { field: "name", type: "text" }, { field: "date", type: "date" },
  { field: "vehicle.name", type: "text" }, { field: "vehicle.id", type: "text" },
  { field: "employeeGroup.name", type: "text" }, { field: "employeeGroup.id", type: "text" },
  { field: "createdBy.name", type: "text" }, { field: "id", type: "text" },
], ["routeAssignmentId", "name", "vehicle.name", "employeeGroup.name"]);

await probeResource("USERS", "/users", [
  { field: "userName", type: "text" }, { field: "fullName", type: "text" }, { field: "email", type: "text" },
  { field: "uid", type: "text" }, { field: "type", type: "text" }, { field: "role.name", type: "text" },
  { field: "branch.name", type: "text" }, { field: "branch.code", type: "text" },
  { field: "active", type: "bool" }, { field: "accessCode", type: "num" },
  { field: "id", type: "num" }, { field: "branch.id", type: "num" }, { field: "role.id", type: "num" },
  { field: "createdAt", type: "date" },
], ["userName", "fullName", "email", "uid", "type", "role.name"]);

await probeResource("EMPLOYEES", "/employees", [
  { field: "name", type: "text" }, { field: "title", type: "text" }, { field: "department", type: "text" },
  { field: "email", type: "text" }, { field: "phones.number", type: "text" },
  { field: "address.address1", type: "text" }, { field: "address.city", type: "text" },
  { field: "address.state", type: "text" }, { field: "address.country", type: "text" }, { field: "address.zipcode", type: "text" },
  { field: "branch.code", type: "text" }, { field: "active", type: "bool" }, { field: "cost", type: "num" },
  { field: "branch.id", type: "num" }, { field: "id", type: "num" }, { field: "createdAt", type: "date" },
], ["name", "title", "department", "email", "phones.number", "address.address1", "address.city"]);

console.log("\nDone.");
