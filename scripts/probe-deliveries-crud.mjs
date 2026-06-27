#!/usr/bin/env node
/** Seed a temp employee-group, then run DELIVERIES CRUD, then clean up the group. */
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
const errOf = (res) => (res.json?.error ?? res.json?.message ?? "").toString().slice(0, 110);
const extractId = (j) => { const d = dataOf(j); if (d && typeof d === "object") return d.id ?? d._id ?? null; if (typeof d === "number") return d; if (typeof d === "string" && d.trim()) return d.trim(); return null; };
const line = (label, res, extra = "") => { console.log(`  [${ok(res) ? "PASS" : "FAIL"}] ${label.padEnd(16)} ${String(res.status).padEnd(4)} ${ok(res) ? extra : errOf(res)}`); return ok(res); };

const firstOne = async (path) => { const r = await req("GET", `${path}?limit=2`); return (Array.isArray(r.json?.data) ? r.json.data : [])[0] ?? null; };

console.log(`Base: ${baseUrl}  Company: ${companyId}  Stamp: ${STAMP}`);

// Seed temp employee group.
const empA = await firstOne("/employees");
const group = await req("POST", "/employee-groups", {
  employeeGroupId: `EG-${STAMP}`,
  name: `ZZ_PROBE_GRP_${STAMP}`,
  branch: "NYC",
  employees: empA ? [{ id: empA.id, name: empA.name }] : [],
});
const groupId = extractId(group.json);
line("SEED GROUP", group, `id=${groupId ?? "?"}`);

let deliveryId = null;
try {
  const container = await firstOne("/containers");
  if (!container) { console.log("  no container available — abort"); }
  else if (groupId) {
    console.log("\n=== DELIVERIES (/deliveries) ===");
    const createBody = {
      name: `ZZ_PROBE_${STAMP}`,
      date: "2026-06-10T08:00:00Z",
      container: { id: container.id, name: container.name, containerNumber: container.containerNumber },
      employeeGroup: { id: groupId, name: `ZZ_PROBE_GRP_${STAMP}` },
    };
    const create = await req("POST", "/deliveries", createBody);
    deliveryId = extractId(create.json);
    if (line("CREATE", create, `id=${deliveryId ?? "?"}`) && deliveryId != null) {
      line("READ(new)", await req("GET", `/deliveries/${deliveryId}`), `id=${deliveryId}`);
      line("UPDATE", await req("PUT", `/deliveries/${deliveryId}`, { ...createBody, id: deliveryId, name: `${createBody.name}_EDIT` }));
      const del = await req("DELETE", `/deliveries/${deliveryId}`);
      if (line("DELETE", del, `id=${deliveryId}`)) { const gone = await req("GET", `/deliveries/${deliveryId}`); console.log(`  [${gone.status === 404 ? "PASS" : "WARN"}] VERIFY GONE      ${gone.status}`); deliveryId = null; }
    }
  }
} finally {
  if (deliveryId != null) console.log(`  [cleanup] delete delivery ${deliveryId}: ${(await req("DELETE", `/deliveries/${deliveryId}`)).status}`);
  if (groupId != null) console.log(`  [cleanup] delete group ${groupId}: ${(await req("DELETE", `/employee-groups/${groupId}`)).status}`);
}
console.log("\nDone.");
