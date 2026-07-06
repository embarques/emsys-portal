#!/usr/bin/env node
/**
 * Advanced-filter + bar-search + filter-preset verification across every
 * directory resource. For each resource it tests every advanced filter field ×
 * operator the portal exposes (applying the same numeric/boolean/array coercion
 * the UI applies), then the OR bar search, then runs a full filter-presets CRUD.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-filters-all.mjs
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" };

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, json };
}
const okRes = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const errOf = (res) => (res.json?.error ?? res.json?.message ?? "").toString().slice(0, 60);

const TEXT = ["startsWith", "contains", "eq", "neq"];
const NUM = ["eq", "neq", "gte", "lte", "gt", "lt"];
const NUMID = ["eq", "neq", "gte", "lte"];
const DATE = ["eq", "neq", "gte", "lte"];
const EQ2 = ["eq", "neq"];
const BYNAME = ["eq", "neq", "contains", "startsWith"];

const isDateField = (f) => f === "date" || /At$/.test(f) || /Date$/.test(f);

function valueFor(field, op, cfg) {
  if (op === "in" || op === "notIn") return cfg.numeric?.has(field) ? [1, 2] : ["a", "b"];
  if (cfg.numeric?.has(field)) return 1;
  if (cfg.boolean?.has(field)) return true;
  if (isDateField(field)) return "2024-01-01";
  return "a";
}

async function searchOne(path, field, op, value) {
  const res = await req("POST", `${path}/search?page=1&limit=1&offset=0`, {
    filters: [{ operator: "and", filters: [{ field, operator: op, value }] }],
  });
  return res;
}

async function probeResource(cfg) {
  console.log(`\n=== ${cfg.label} (${cfg.path}) ===`);
  // confirm endpoint reachable
  const list = await req("GET", `${cfg.path}?limit=1`);
  if (!okRes(list)) {
    console.log(`  [FAIL] LIST ${list.status} ${errOf(list)} — skipping field probes`);
    return;
  }
  console.log(`  LIST total=${list.json?.total ?? "-"}`);

  let fieldFails = 0;
  for (const [field, ops] of cfg.fields ?? []) {
    const parts = [];
    for (const op of ops) {
      const res = await searchOne(cfg.path, field, op, valueFor(field, op, cfg));
      if (okRes(res)) parts.push(`${op}:ok`);
      else { parts.push(`${op}:FAIL${res.status}`); fieldFails += 1; }
    }
    const allOk = parts.every((p) => p.endsWith(":ok"));
    console.log(`  [${allOk ? "PASS" : "FAIL"}] ${field.padEnd(28)} ${parts.join(" ")}`);
  }

  // Bar OR search.
  if (cfg.bar?.length) {
    const res = await req("POST", `${cfg.path}/search?page=1&limit=1&offset=0`, {
      filters: [{ operator: "or", filters: cfg.bar.map((f) => ({ field: f, operator: "contains", value: "a" })) }],
    });
    console.log(`  [${okRes(res) ? "PASS" : "FAIL"}] BAR OR (${cfg.bar.length} fields)         ${okRes(res) ? "ok" : res.status + " " + errOf(res)}`);
    if (!okRes(res)) {
      for (const f of cfg.bar) {
        const r = await req("POST", `${cfg.path}/search?page=1&limit=1&offset=0`, {
          filters: [{ operator: "or", filters: [{ field: f, operator: "contains", value: "a" }] }],
        });
        if (!okRes(r)) console.log(`     - offender ${f}: FAIL ${r.status}`);
      }
    }
  }
  if (fieldFails === 0) console.log("  → all advanced filter fields/operators accepted");
}

// ---------------- resource configs ----------------
const customers = {
  label: "CUSTOMERS", path: "/customers",
  numeric: new Set(["customerType", "branch.id"]),
  fields: [
    ["name", TEXT], ["email", TEXT], ["IDNumber", TEXT], ["id", TEXT], ["address.address1", TEXT],
    ["address.address2", TEXT], ["address.city", TEXT], ["address.state", TEXT], ["address.zipcode", TEXT],
    ["address.country", EQ2], ["phones.number", TEXT], ["customerType", EQ2], ["branch.id", EQ2],
  ],
  bar: ["name", "phones.number", "phone1", "phone2", "address.address1", "addresses.address1", "address.city", "addresses.city", "address.state", "addresses.state", "address.zipcode", "addresses.zipcode"],
};
const orders = {
  label: "ORDERS (pickups)", path: "/pickups",
  boolean: new Set(["completed"]),
  fields: [
    ["sender.name", TEXT], ["sender.phones.number", TEXT], ["sender.phone1", TEXT],
    ["sender.address.address1", TEXT], ["sender.address.address2", TEXT], ["sender.address.city", TEXT],
    ["sender.address.state", TEXT], ["sender.address.zipcode", [...TEXT, "gte", "lte"]],
    ["purpose", TEXT], ["receiver.name", TEXT], ["receiver.phones.number", TEXT], ["receiver.phone1", TEXT],
    ["receiver.address.address1", TEXT], ["receiver.address.city", TEXT], ["receiver.address.state", TEXT],
    ["receiver.address.zipcode", [...TEXT, "gte", "lte"]],
    ["createdBy.name", BYNAME], ["completed", EQ2], ["date", DATE], ["createdAt", DATE],
  ],
  bar: ["sender.name", "sender.phone1", "sender.address.address1", "sender.address.city", "sender.address.state", "sender.address.zipcode", "receiver.name", "receiver.phone1", "receiver.address.address1"],
};
const invoices = {
  label: "INVOICES", path: "/invoices",
  numeric: new Set(["cost", "discount", "payment", "balance", "surcharge", "employee.id", "sender.id", "receiver.id"]),
  boolean: new Set(["isArchive", "isVoid"]),
  fields: [
    ["number", TEXT], ["date", DATE], ["paidRegion", EQ2], ["paidStatus", EQ2],
    ["cost", NUM], ["discount", NUM], ["payment", NUM], ["balance", NUM],
    ["container.name", TEXT], ["sender.name", TEXT], ["sender.id", ["eq", "neq", "in", "notIn"]],
    ["sender.phones.number", TEXT], ["sender.phone1", TEXT],
    ["sender.address.address1", TEXT], ["sender.address.city", TEXT], ["sender.address.state", TEXT], ["sender.address.zipcode", TEXT],
    ["receiver.name", TEXT], ["receiver.id", ["eq", "neq", "in", "notIn"]],
    ["receiver.phones.number", TEXT], ["receiver.phone1", TEXT],
    ["receiver.address.address1", TEXT], ["receiver.address.city", TEXT], ["receiver.address.state", TEXT], ["receiver.address.zipcode", TEXT],
    ["createdBy.name", BYNAME], ["employee.id", EQ2], ["employee.name", TEXT],
    ["isArchive", EQ2], ["isVoid", EQ2], ["createdAt", DATE], ["updatedAt", DATE],
  ],
  bar: ["number", "sender.name", "receiver.name", "container.name", "container.containerNumber"],
};
const deliveries = {
  label: "DELIVERIES", path: "/deliveries",
  numeric: new Set(["id"]),
  fields: [
    ["id", NUM], ["name", TEXT], ["container.name", TEXT], ["container.containerNumber", TEXT],
    ["employeeGroup.name", TEXT], ["employeeGroup.id", EQ2], ["createdBy.name", TEXT], ["updatedBy.name", TEXT],
    ["date", DATE], ["createdAt", DATE], ["updatedAt", DATE],
  ],
  bar: ["name", "container.name", "container.containerNumber", "employeeGroup.name"],
};
const items = {
  label: "ITEMS (invoice-descriptions)", path: "/invoice-descriptions",
  numeric: new Set(["id", "price"]),
  fields: [["id", NUMID], ["name", TEXT], ["price", NUM], ["createdAt", DATE], ["updatedAt", DATE]],
  bar: ["name", "id", "price"],
};
const containers = {
  label: "CONTAINERS", path: "/containers",
  numeric: new Set(["id", "cost"]),
  fields: [
    ["id", NUMID], ["name", TEXT], ["containerNumber", TEXT], ["booking", TEXT], ["sealNumber", TEXT],
    ["seal", TEXT], ["broker", TEXT], ["company", TEXT], ["cost", NUM], ["departureDate", DATE], ["arrivalDate", DATE],
  ],
  bar: ["name", "containerNumber", "booking", "sealNumber", "seal", "broker", "company", "id", "cost", "departureDate", "arrivalDate"],
};
const routes = {
  label: "ROUTES (pickups/route)", path: "/pickups/route",
  fields: [["name", TEXT]],
  bar: ["name"],
};
const routeAssignments = {
  label: "ROUTE-ASSIGNMENTS", path: "/routes",
  fields: [["name", TEXT]],
  bar: ["name"],
};
const vehicles = {
  label: "VEHICLES", path: "/vehicles",
  numeric: new Set(["year"]),
  // `id` is a Mongo ObjectId here, so it can't be exercised with a synthetic
  // value; the match-verified scripts/probe-vehicles.mjs covers id eq/neq.
  fields: [
    ["vehicleId", TEXT], ["name", TEXT], ["vin", TEXT], ["createdBy.name", BYNAME],
    ["fuelType", EQ2], ["branch", BYNAME], ["year", EQ2],
  ],
  bar: ["vehicleId", "name", "vin", "fuelType", "branch", "createdBy.name"],
};
const employees = {
  label: "EMPLOYEES", path: "/employees",
  numeric: new Set(["id", "branch.id", "cost"]),
  boolean: new Set(["active"]),
  fields: [
    ["id", NUMID], ["name", TEXT], ["title", TEXT], ["email", TEXT], ["phones.number", TEXT],
    ["address.address1", TEXT], ["address.address2", TEXT], ["address.apartment", TEXT], ["address.city", TEXT],
    ["address.state", TEXT], ["address.zipcode", TEXT], ["address.country", TEXT],
    ["department", EQ2], ["active", EQ2], ["branch.id", EQ2], ["branch.code", TEXT], ["cost", NUM], ["createdAt", DATE],
  ],
  bar: ["name", "title", "department", "email", "phones.number", "address.address1", "address.address2", "address.apartment", "address.city", "address.state", "address.zipcode", "address.country", "branch.code"],
};
const users = {
  label: "USERS", path: "/users",
  numeric: new Set(["id", "branch.id", "role.id", "accessCode"]),
  boolean: new Set(["active"]),
  fields: [
    ["id", NUMID], ["userName", TEXT], ["fullName", TEXT], ["email", TEXT], ["uid", TEXT], ["type", TEXT],
    ["role.name", TEXT], ["branch.name", TEXT], ["branch.code", TEXT], ["accessCode", NUM],
    ["active", EQ2], ["branch.id", EQ2], ["role.id", EQ2], ["createdAt", DATE],
  ],
  bar: ["userName", "fullName", "email", "uid", "type", "role.name", "branch.name", "branch.code"],
};
const roles = {
  label: "ROLES", path: "/roles",
  numeric: new Set(["id"]),
  fields: [["id", NUMID], ["name", TEXT], ["createdBy.name", TEXT], ["updatedBy.name", TEXT], ["createdAt", DATE], ["updatedAt", DATE]],
  bar: ["name", "createdBy.name", "updatedBy.name", "id"],
};
const employeeGroups = {
  label: "EMPLOYEE-GROUPS", path: "/employee-groups",
  fields: [["name", TEXT]],
  bar: ["name"],
};

async function probeFilterPresets() {
  console.log(`\n=== FILTER PRESETS (/filter-presets) ===`);
  const list = await req("GET", "/filter-presets");
  console.log(`  [${okRes(list) ? "PASS" : "FAIL"}] LIST            ${list.status} ${okRes(list) ? "" : errOf(list)}`);

  const body = {
    scope: "__probe__",
    name: `ZZ_PROBE_${Date.now()}`,
    rows: [{ id: "r1", join: "and", field: "name", operator: "contains", value: "x" }],
  };
  const create = await req("POST", "/filter-presets", body);
  const id = create.json?.data?.id ?? create.json?.id;
  console.log(`  [${okRes(create) ? "PASS" : "FAIL"}] CREATE          ${create.status} ${okRes(create) ? `id=${id}` : errOf(create)}`);
  if (!okRes(create) || !id) return;

  try {
    console.log(`  [${okRes(await req("GET", `/filter-presets/${id}`)) ? "PASS" : "FAIL"}] RETRIEVE        (id=${id})`);
    const upd = await req("PUT", `/filter-presets/${id}`, { ...body, name: `${body.name}_EDIT` });
    console.log(`  [${okRes(upd) ? "PASS" : "FAIL"}] UPDATE          ${upd.status} ${okRes(upd) ? "" : errOf(upd)}`);
    const scoped = await req("GET", "/filter-presets?scope=__probe__");
    const found = Array.isArray(scoped.json?.data) && scoped.json.data.some((p) => (p.id ?? p._id) == id);
    console.log(`  [${okRes(scoped) ? "PASS" : "FAIL"}] LIST ?scope     ${scoped.status} found=${found}`);
  } finally {
    const del = await req("DELETE", `/filter-presets/${id}`);
    console.log(`  [${okRes(del) ? "PASS" : "FAIL"}] DELETE          ${del.status}`);
    const gone = await req("GET", `/filter-presets/${id}`);
    console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE     ${gone.status}`);
  }
}

console.log(`Base: ${baseUrl}  Company: ${companyId}`);
for (const cfg of [customers, orders, invoices, deliveries, items, containers, routes, routeAssignments, vehicles, employees, users, roles, employeeGroups]) {
  await probeResource(cfg);
}
await probeFilterPresets();
console.log("\nDone.");
