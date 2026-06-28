#!/usr/bin/env node
/** CRUD probe for vehicles, route-assignments, users, employees. Throwaway ZZ_PROBE_* + cleanup. */
const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" };
const STAMP = Date.now();

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, json };
}
const ok = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
const dataOf = (j) => (j && typeof j === "object" && "data" in j ? j.data : j);
const errOf = (res) => (res.json?.error ?? res.json?.message ?? "").toString().slice(0, 90);
function extractId(json) {
  const d = dataOf(json);
  if (d && typeof d === "object" && !Array.isArray(d)) return d.id ?? null;
  if (typeof d === "number") return d;
  if (typeof d === "string" && d.trim()) return d.trim();
  return null;
}
function line(label, res, extra = "") {
  console.log(`  [${ok(res) ? "PASS" : "FAIL"}] ${label.padEnd(16)} ${String(res.status).padEnd(4)} ${ok(res) ? extra : errOf(res)}`);
  return ok(res);
}

async function runCrud(cfg) {
  console.log(`\n=== ${cfg.label} (${cfg.path}) ===`);
  let createdId = null;
  try {
    const list = await req("GET", `${cfg.path}?limit=1`);
    const sample = Array.isArray(list.json?.data) ? list.json.data[0] : null;
    line("LIST", list, `total=${list.json?.total}`);
    if (!ok(list)) return;
    if (sample?.id != null) line("READ(sample)", await req("GET", `${cfg.path}/${sample.id}`), `id=${sample.id}`);

    let body;
    try { body = await cfg.prepareCreate(sample); }
    catch (e) { console.log(`  [SKIP] CREATE          ${e.message}`); return; }
    const create = await req("POST", cfg.path, body);
    createdId = extractId(create.json);
    if (!line("CREATE", create, `id=${createdId ?? "?"}`) || createdId == null) return;

    line("READ(new)", await req("GET", `${cfg.path}/${createdId}`), `id=${createdId}`);
    try {
      const upd = cfg.makeUpdate(dataOf(await req("GET", `${cfg.path}/${createdId}`).then((r) => r.json)) ?? body, createdId);
      line("UPDATE", await req("PUT", `${cfg.path}/${createdId}`, upd));
    } catch (e) { console.log(`  [SKIP] UPDATE          ${e.message}`); }

    const del = await req("DELETE", `${cfg.path}/${createdId}`);
    if (line("DELETE", del, `id=${createdId}`)) {
      const gone = await req("GET", `${cfg.path}/${createdId}`);
      console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE     ${gone.status}`);
      createdId = null;
    }
  } finally {
    if (createdId != null) console.log(`  [cleanup] delete ${createdId}: ${(await req("DELETE", `${cfg.path}/${createdId}`)).status}`);
  }
}

const vehicles = {
  label: "VEHICLES", path: "/vehicles",
  prepareCreate: async () => ({ name: `ZZ_PROBE_${STAMP}`, vin: `VINPROBE${STAMP}`, year: 2022, fuelType: "diesel", vehicleId: `VEH-${STAMP}`, branch: "NY" }),
  makeUpdate: (c, id) => ({ id, name: c.name, vin: c.vin, year: 2023, fuelType: "gas" }),
};
const employees = {
  label: "EMPLOYEES", path: "/employees",
  prepareCreate: async () => ({ name: `ZZ_PROBE_${STAMP}`, title: "Probe", department: "driver", phone1: "555-2000", email: `probe${STAMP}@example.com`, active: true, branch: { id: 1, code: "NY" }, address: { city: "NEW YORK", state: "NY", zipcode: "10001" } }),
  makeUpdate: (c, id) => ({ id, name: c.name, title: "Probe EDIT", department: "driver", active: true, branch: { id: 1, code: "NY" } }),
};
const users = {
  label: "USERS", path: "/users",
  prepareCreate: async () => {
    const role = await req("GET", "/roles?limit=1");
    const r = Array.isArray(role.json?.data) ? role.json.data[0] : null;
    return { uid: `ZZPROBEUID${STAMP}`, email: `probe${STAMP}@example.com`, userName: `zzprobe${STAMP}`, fullName: `ZZ Probe ${STAMP}`, active: true, branch: { id: 1, name: "Main", code: "NY" }, role: r ? { id: r.id, name: r.name, active: true } : { id: 1, name: "Administrador", active: true } };
  },
  makeUpdate: (c, id) => ({ id, uid: c.uid, email: c.email, userName: c.userName, fullName: `${c.fullName} EDIT`, active: true, branch: c.branch, role: c.role }),
};
const routes = {
  label: "ROUTE-ASSIGNMENTS", path: "/routes",
  prepareCreate: async () => {
    const veh = await req("GET", "/vehicles?limit=1");
    const v = Array.isArray(veh.json?.data) ? veh.json.data[0] : null;
    const grp = await req("GET", "/employee-groups?limit=1");
    const g = Array.isArray(grp.json?.data) ? grp.json.data[0] : null;
    if (!v) throw new Error("no vehicle available (403/empty)");
    if (!g) throw new Error("no employee group available");
    return { routeAssignmentId: `RA-${STAMP}`, name: `ZZ_PROBE_${STAMP}`, date: "2026-06-10T08:00:00Z", vehicle: { id: v.id, name: v.name }, employeeGroup: { id: g.id, name: g.name } };
  },
  makeUpdate: (c, id) => ({ id, routeAssignmentId: c.routeAssignmentId, name: `${c.name} EDIT`, date: c.date, vehicle: c.vehicle, employeeGroup: c.employeeGroup }),
};

console.log(`Base: ${baseUrl}  Company: ${companyId}  Stamp: ${STAMP}`);
for (const cfg of [vehicles, employees, users, routes]) await runCrud(cfg);
console.log("\nDone.");
