#!/usr/bin/env node
/**
 * Full CRUD probe across containers, items (invoice-descriptions), customers,
 * orders (pickups), and invoices. For each resource it runs:
 *   LIST -> READ(sample) -> CREATE -> READ(new) -> UPDATE -> DELETE -> VERIFY GONE
 * Every created record is a throwaway (ZZ_PROBE_*) and is always cleaned up.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-crud-all.mjs
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
  (res.json?.error ?? res.json?.message ?? JSON.stringify(res.json) ?? "").toString().slice(0, 90);

function extractId(json) {
  const d = dataOf(json);
  if (d && typeof d === "object" && !Array.isArray(d)) return d.id ?? null;
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

/**
 * Generic CRUD runner.
 * cfg: { label, path, prepareCreate(): Promise<body>, makeUpdate(created): body }
 */
async function runCrud(cfg) {
  console.log(`\n=== ${cfg.label} (${cfg.path}) ===`);
  let createdId = null;

  try {
    // LIST
    const list = await req("GET", `${cfg.path}?limit=1`);
    const total = list.json?.total;
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${total}`);

    // READ sample
    if (sample?.id != null) {
      const read = await req("GET", `${cfg.path}/${sample.id}`);
      line("READ(sample)", read, `id=${sample.id}`);
    } else {
      console.log("  [SKIP] READ(sample)      no sample id");
    }

    // CREATE
    let createBody;
    try {
      createBody = await cfg.prepareCreate(sample);
    } catch (e) {
      console.log(`  [SKIP] CREATE            cannot build payload: ${e.message}`);
      return;
    }
    const create = await req("POST", cfg.path, createBody);
    const createPassed = line("CREATE", create, `id=${extractId(create.json) ?? "?"}`);
    createdId = extractId(create.json);

    if (!createPassed || createdId == null) {
      console.log("  (no created id — skipping read/update/delete)");
      return;
    }

    // READ created
    const readNew = await req("GET", `${cfg.path}/${createdId}`);
    line("READ(new)", readNew, `id=${createdId}`);

    // UPDATE
    try {
      const updateBody = cfg.makeUpdate(dataOf(readNew.json) ?? createBody, createdId);
      const update = await req("PUT", `${cfg.path}/${createdId}`, updateBody);
      line("UPDATE", update);
    } catch (e) {
      console.log(`  [SKIP] UPDATE            ${e.message}`);
    }

    // DELETE
    const del = await req("DELETE", `${cfg.path}/${createdId}`);
    const deletePassed = line("DELETE", del, `id=${createdId}`);
    if (deletePassed) createdId = null;

    // VERIFY GONE
    const gone = await req("GET", `${cfg.path}/${createdId ?? extractId(create.json)}`);
    console.log(
      `  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE      ${gone.status} ${gone.status === 404 ? "(404 as expected)" : "(still present?)"}`,
    );
  } finally {
    if (createdId != null) {
      const cleanup = await req("DELETE", `${cfg.path}/${createdId}`);
      console.log(`  [cleanup] delete ${createdId}: ${cleanup.status}`);
    }
  }
}

// ---- Resource configs ----

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
  makeUpdate: (created, id) => ({
    id,
    name: created.name,
    booking: created.booking,
    cost: 9999.99,
  }),
};

const items = {
  label: "ITEMS (invoice-descriptions)",
  path: "/invoice-descriptions",
  prepareCreate: async () => {
    const top = await req("POST", "/invoice-descriptions/search?page=1&limit=1&offset=0", {
      sort: [{ field: "id", direction: "desc" }],
      filters: [],
    });
    const maxId = Array.isArray(top.json?.data) ? Number(top.json.data[0]?.id) || 0 : 0;
    return { id: maxId + 1, name: `ZZ_PROBE_${STAMP}`, price: 1.23 };
  },
  makeUpdate: (created, id) => ({ id, name: `${created.name}_EDIT`, price: 9.99 }),
};

const customers = {
  label: "CUSTOMERS",
  path: "/customers",
  prepareCreate: async () => ({
    name: `ZZ_PROBE_${STAMP}`,
    customerType: 1,
    phone1: "555-0100",
    active: true,
    branch: { id: 1, code: "NYC", name: "New York" },
    address: { address1: "123 Probe St", city: "Miami", state: "FL", zipcode: "33101", country: "US" },
  }),
  makeUpdate: (created) => ({
    name: created.name,
    customerType: 1,
    phone1: "555-9999",
    active: true,
    branch: { id: 1, code: "NYC", name: "New York" },
    notes: "probe update",
  }),
};

const orders = {
  label: "ORDERS (pickups)",
  path: "/pickups",
  prepareCreate: async () => ({
    date: "2026-06-10",
    branch: { id: 1, code: "NYC" },
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
  makeUpdate: (created, id) => ({
    id,
    date: "2026-06-11",
    branch: { id: 1, code: "NYC" },
    sender: { name: `ZZ_PROBE_SENDER_${STAMP}`, customerType: 1, phone1: "555-3000" },
    purpose: "Probe pickup EDIT",
  }),
};

const invoices = {
  label: "INVOICES",
  path: "/invoices",
  prepareCreate: async () => {
    const cont = await req("GET", "/containers?limit=1");
    const container = Array.isArray(cont.json?.data) ? cont.json.data[0] : null;
    const emp = await req("GET", "/employees?limit=1");
    const employee = Array.isArray(emp.json?.data) ? emp.json.data[0] : null;
    if (!container) throw new Error("no container available for invoice");
    return {
      number: `ZZ-PROBE-${STAMP}`,
      date: "2026-06-10",
      branch: { id: 1, code: "NYC" },
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
  makeUpdate: (created, id) => ({
    id,
    number: created.number,
    cost: 150,
    payment: 50,
    balance: 100,
    isVoid: false,
    sender: created.sender ?? { name: `ZZ_PROBE_SENDER_${STAMP}`, customerType: 1 },
    container: created.container,
  }),
};

console.log(`Base: ${baseUrl}  Company: ${companyId}  Stamp: ${STAMP}`);
for (const cfg of [containers, items, customers, orders, invoices]) {
  await runCrud(cfg);
}
console.log("\nDone.");
