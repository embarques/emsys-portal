#!/usr/bin/env node
/**
 * Full CRUD probe across every directory resource the portal manages:
 *   customers, orders (pickups), invoices, deliveries, items (invoice-descriptions),
 *   containers, routes (pickups/route), route-assignments, vehicles, employees,
 *   users, employee-groups.
 *
 * For each resource:
 *   LIST -> READ(sample) -> CREATE -> READ(new) -> UPDATE -> DELETE -> VERIFY GONE
 * Every created record is a throwaway (ZZ_PROBE_*) and is always cleaned up.
 * Aligned with the current API contract: no client-supplied `id` on create;
 * numbers/booleans sent as real JSON types.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-crud-full.mjs
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

const STAMP = Date.now();

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

const ok = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const dataOf = (json) => (json && typeof json === "object" && "data" in json ? json.data : json);
const errOf = (res) =>
  (res.json?.error ?? res.json?.message ?? JSON.stringify(res.json) ?? "").toString().slice(0, 100);

function extractId(json) {
  const d = dataOf(json);
  if (d && typeof d === "object" && !Array.isArray(d)) return d.id ?? d._id ?? null;
  if (typeof d === "number") return d;
  if (typeof d === "string" && d.trim()) return d.trim();
  return null;
}

function line(label, res, extra = "") {
  const tag = ok(res) ? "PASS" : "FAIL";
  const detail = ok(res) ? extra : errOf(res);
  console.log(`  [${tag}] ${label.padEnd(16)} ${String(res.status).padEnd(4)} ${detail}`);
  return ok(res);
}

// Cached reference lookups (first record from a list endpoint).
const _cache = new Map();
async function first(path) {
  if (_cache.has(path)) return _cache.get(path);
  const res = await req("GET", `${path}?limit=2`);
  const arr = Array.isArray(res.json?.data) ? res.json.data : [];
  _cache.set(path, arr);
  return arr;
}
async function firstOne(path) {
  return (await first(path))[0] ?? null;
}

async function runCrud(cfg) {
  console.log(`\n=== ${cfg.label} (${cfg.path}) ===`);
  let createdId = null;
  try {
    const list = await req("GET", `${cfg.path}?limit=1`);
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${list.json?.total ?? "-"}`);
    if (!ok(list)) return;

    if (sample?.id != null) {
      line("READ(sample)", await req("GET", `${cfg.path}/${sample.id}`), `id=${sample.id}`);
    } else {
      console.log("  [SKIP] READ(sample)      no sample id");
    }

    let createBody;
    try {
      createBody = await cfg.prepareCreate(sample);
    } catch (e) {
      console.log(`  [SKIP] CREATE            cannot build payload: ${e.message}`);
      return;
    }

    const create = await req("POST", cfg.path, createBody);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`) || createdId == null) return;

    line("READ(new)", await req("GET", `${cfg.path}/${createdId}`), `id=${createdId}`);

    if (cfg.makeUpdate) {
      try {
        const readBack = dataOf((await req("GET", `${cfg.path}/${createdId}`)).json) ?? createBody;
        const updateBody = cfg.makeUpdate(readBack, createdId, createBody);
        line("UPDATE", await req("PUT", `${cfg.path}/${createdId}`, updateBody));
      } catch (e) {
        console.log(`  [SKIP] UPDATE            ${e.message}`);
      }
    }

    const del = await req("DELETE", `${cfg.path}/${createdId}`);
    if (line("DELETE", del, `id=${createdId}`)) {
      const gone = await req("GET", `${cfg.path}/${createdId}`);
      console.log(
        `  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE      ${gone.status} ${gone.status === 404 ? "(404 as expected)" : "(still present?)"}`,
      );
      createdId = null;
    }
  } finally {
    if (createdId != null) {
      console.log(`  [cleanup] delete ${createdId}: ${(await req("DELETE", `${cfg.path}/${createdId}`)).status}`);
    }
  }
}

// ---- Resource configs ----

const branchRef = async () => {
  const b = await firstOne("/branches");
  return b ? { id: b.id, code: b.code, name: b.name } : { id: 1, code: "NYC", name: "Main" };
};

const customers = {
  label: "CUSTOMERS",
  path: "/customers",
  prepareCreate: async () => ({
    name: `ZZ_PROBE_${STAMP}`,
    customerType: 1,
    phone1: "555-0100",
    active: true,
    branch: await branchRef(),
    address: { address1: "123 Probe St", city: "Miami", state: "FL", zipcode: "33101", country: "US" },
  }),
  makeUpdate: (c, id, body) => ({ ...body, name: c.name ?? body.name, phone1: "555-9999", notes: "probe update" }),
};

const orders = {
  label: "ORDERS (pickups)",
  path: "/pickups",
  prepareCreate: async () => ({
    date: "2026-06-10",
    branch: await branchRef(),
    sender: {
      name: `ZZ_PROBE_SENDER_${STAMP}`,
      customerType: 1,
      phone1: "555-3000",
      address: { address1: "10 Oak Ave", city: "Bronx", state: "NY", zipcode: "10451" },
    },
    receiver: {
      name: `ZZ_PROBE_RECEIVER_${STAMP}`,
      customerType: 2,
      phone1: "555-4000",
      address: { city: "Miami", state: "FL", zipcode: "33101" },
    },
    purpose: "Probe pickup",
  }),
  makeUpdate: (c, id, body) => ({ ...body, id, purpose: "Probe pickup EDIT" }),
};

const invoices = {
  label: "INVOICES",
  path: "/invoices",
  prepareCreate: async () => {
    const container = await firstOne("/containers");
    const employee = await firstOne("/employees");
    if (!container) throw new Error("no container available");
    return {
      number: `ZZ-PROBE-${STAMP}`,
      date: "2026-06-10",
      branch: await branchRef(),
      cost: 120,
      payment: 20,
      balance: 100,
      discount: 0,
      surcharge: 0,
      paidStatus: "PARTIAL",
      employee: employee
        ? { id: employee.id, name: employee.name ?? "Probe", userName: employee.userName, fullName: employee.fullName }
        : { id: 1, name: "Probe Tasador" },
      container: { id: container.id, name: container.name },
      sender: { name: `ZZ_PROBE_SENDER_${STAMP}`, customerType: 1, phone1: "555-1000" },
      receiver: { name: `ZZ_PROBE_RECEIVER_${STAMP}`, customerType: 2, phone1: "555-2000" },
      invoiceDetails: [{ name: "Probe line", quantity: 2, labels: 2, price: 50, total: 100 }],
    };
  },
  makeUpdate: (c, id, body) => ({
    id,
    number: body.number,
    cost: 150,
    payment: 50,
    balance: 100,
    isVoid: false,
    sender: body.sender,
    container: body.container,
  }),
};

const deliveries = {
  label: "DELIVERIES",
  path: "/deliveries",
  prepareCreate: async () => {
    const container = await firstOne("/containers");
    const group = await firstOne("/employee-groups");
    if (!container) throw new Error("no container available");
    if (!group) throw new Error("no employee group available");
    return {
      name: `ZZ_PROBE_${STAMP}`,
      date: "2026-06-10T08:00:00Z",
      container: { id: container.id, name: container.name, containerNumber: container.containerNumber },
      employeeGroup: { id: group.id, name: group.name },
    };
  },
  makeUpdate: (c, id, body) => ({ ...body, id, name: `${body.name}_EDIT` }),
};

const items = {
  label: "ITEMS (invoice-descriptions)",
  path: "/invoice-descriptions",
  prepareCreate: async () => ({ name: `ZZ_PROBE_${STAMP}`, price: 1.23 }),
  makeUpdate: (c, id) => ({ id, name: `ZZ_PROBE_${STAMP}_EDIT`, price: 9.99 }),
};

const containers = {
  label: "CONTAINERS",
  path: "/containers",
  prepareCreate: async () => ({
    name: `ZZ_PROBE_${STAMP}`,
    booking: `BK-${STAMP}`,
    containerNumber: "PROBE1234567",
    sealNumber: "SEAL-PROBE",
    broker: "Probe Broker",
    company: "Probe Co",
    cost: 1234.56,
    departureDate: "2026-06-01T00:00:00Z",
    arrivalDate: "2026-06-15T00:00:00Z",
  }),
  makeUpdate: (c, id, body) => ({ id, name: body.name, booking: body.booking, cost: 9999.99 }),
};

const routes = {
  label: "ROUTES (pickups/route)",
  path: "/pickups/route",
  prepareCreate: async () => ({
    name: `ZZ_PROBE_${STAMP}`,
    states: ["NY"],
    cities: [{ cityName: "Bronx", stateCode: "NY" }],
    zipCodes: ["10451", "10452"],
    zipRanges: [{ start: "10400", end: "10499" }],
  }),
  makeUpdate: (c, id, body) => ({ ...body, name: `${body.name}_EDIT` }),
};

const routeAssignments = {
  label: "ROUTE-ASSIGNMENTS",
  path: "/routes",
  prepareCreate: async () => {
    const vehicle = await firstOne("/vehicles");
    const group = await firstOne("/employee-groups");
    if (!vehicle) throw new Error("no vehicle available (403/empty)");
    if (!group) throw new Error("no employee group available");
    return {
      routeAssignmentId: `RA-${STAMP}`,
      name: `ZZ_PROBE_${STAMP}`,
      date: "2026-06-10T08:00:00Z",
      vehicle: { id: vehicle.id, name: vehicle.name },
      employeeGroup: { id: group.id, name: group.name },
    };
  },
  makeUpdate: (c, id, body) => ({ ...body, name: `${body.name}_EDIT` }),
};

const vehicles = {
  label: "VEHICLES",
  path: "/vehicles",
  prepareCreate: async () => ({
    vehicleId: `VEH-${STAMP}`,
    name: `ZZ_PROBE_${STAMP}`,
    vin: `VINPROBE${STAMP}`,
    year: 2022,
    fuelType: "diesel",
    branch: "NYC",
  }),
  makeUpdate: (c, id, body) => ({ ...body, year: 2023, fuelType: "gas" }),
};

const employees = {
  label: "EMPLOYEES",
  path: "/employees",
  prepareCreate: async () => ({
    name: `ZZ_PROBE_${STAMP}`,
    title: "Probe",
    department: "driver",
    phone1: "555-2000",
    email: `probe${STAMP}@example.com`,
    active: true,
    branch: await branchRef(),
    address: { city: "NEW YORK", state: "NY", zipcode: "10001" },
  }),
  makeUpdate: (c, id, body) => ({ ...body, id, title: "Probe EDIT" }),
};

const users = {
  label: "USERS",
  path: "/users",
  prepareCreate: async () => {
    const role = await firstOne("/roles");
    return {
      uid: `ZZPROBEUID${STAMP}`,
      email: `probe${STAMP}@example.com`,
      userName: `zzprobe${STAMP}`,
      fullName: `ZZ Probe ${STAMP}`,
      active: true,
      branch: await branchRef(),
      role: role ? { id: role.id, name: role.name, active: true } : { id: 1, name: "Administrador", active: true },
    };
  },
  makeUpdate: (c, id, body) => ({ ...body, id, fullName: `${body.fullName} EDIT` }),
};

const employeeGroups = {
  label: "EMPLOYEE-GROUPS",
  path: "/employee-groups",
  prepareCreate: async () => {
    const emps = await first("/employees");
    return {
      employeeGroupId: `EG-${STAMP}`,
      name: `ZZ_PROBE_${STAMP}`,
      branch: "NYC",
      employees: emps.slice(0, 2).map((e) => ({ id: e.id, name: e.name })),
    };
  },
  makeUpdate: (c, id, body) => ({ ...body, name: `${body.name}_EDIT` }),
};

console.log(`Base: ${baseUrl}  Company: ${companyId}  Stamp: ${STAMP}`);
const order = [
  customers,
  orders,
  invoices,
  deliveries,
  items,
  containers,
  routes,
  routeAssignments,
  vehicles,
  employees,
  users,
  employeeGroups,
];
for (const cfg of order) await runCrud(cfg);
console.log("\nDone.");
