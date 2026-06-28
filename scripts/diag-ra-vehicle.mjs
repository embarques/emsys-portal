#!/usr/bin/env node
/**
 * Diagnostic: why does route-assignment search match employeeGroup.id but not
 * vehicle.id? Creates one route-assignment with a known vehicle + group, reads
 * back exactly what the server stored, then runs id-pinned eq searches on both
 * refs. Cleans up the created record.
 *
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/diag-ra-vehicle.mjs
 */
const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim().replace(/^Bearer\s+/i, "");
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }

const headers = {
  accept: "application/json",
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};
async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, json };
}
const dataOf = (j) => (j && typeof j === "object" && "data" in j ? j.data : j);
const idOf = (j) => { const d = dataOf(j); return (d && (d.id ?? d._id)) ?? (typeof d === "string" ? d : null); };

async function pinnedEq(field, value, rid) {
  const { json } = await req("POST", "/route-assignments/search?page=1&limit=1&offset=0", {
    operator: "and",
    filters: [{ field, operator: "eq", value }, { field: "id", operator: "eq", value: rid }],
    sort: [{ field: "date", direction: "desc" }],
  });
  const total = typeof json?.total === "number" ? json.total : (Array.isArray(json?.data) ? json.data.length : 0);
  return total;
}

// Grab a real vehicle + employee group.
const veh = dataOf((await req("GET", "/vehicles?limit=1&page=1&offset=0")).json)?.[0]
  ?? (await req("GET", "/vehicles?limit=1&page=1&offset=0")).json?.data?.[0];
const vehicle = Array.isArray(veh) ? veh[0] : veh;
const grpRes = await req("GET", "/employee-groups?limit=1&page=1&offset=0");
const group = grpRes.json?.data?.[0];
const VID = vehicle?.id ?? vehicle?._id;
const GID = group?.id ?? group?._id;
console.log("Using vehicle.id =", VID, "  employeeGroup.id =", GID);

const create = await req("POST", "/route-assignments", {
  routeAssignmentId: `ZZDIAG-${Date.now()}`,
  name: "ZZ Diag",
  date: "2026-06-28T00:00:00Z",
  vehicle: { id: VID, name: "DIAGVEH" },
  employeeGroup: { id: GID, name: "DIAGGRP" },
});
const RID = idOf(create.json);
console.log("CREATE status", create.status, "id", RID);
if (!RID) { console.log("No id; aborting.", JSON.stringify(create.json).slice(0, 300)); process.exit(1); }

try {
  const rec = dataOf((await req("GET", `/route-assignments/${RID}`)).json);
  console.log("\nStored refs as returned by the API:");
  console.log(JSON.stringify({ vehicle: rec.vehicle, employeeGroup: rec.employeeGroup }, null, 2));

  console.log("\nid-pinned eq searches (1 = the seed matched, 0 = not matched):");
  console.log("  vehicle.id        eq sent-value   =>", await pinnedEq("vehicle.id", VID, RID));
  console.log("  vehicle.id        eq stored-value =>", await pinnedEq("vehicle.id", rec?.vehicle?.id ?? VID, RID));
  console.log("  vehicle.name      eq stored-value =>", await pinnedEq("vehicle.name", rec?.vehicle?.name ?? "DIAGVEH", RID));
  console.log("  employeeGroup.id  eq sent-value   =>", await pinnedEq("employeeGroup.id", GID, RID));
  console.log("  employeeGroup.id  eq stored-value =>", await pinnedEq("employeeGroup.id", rec?.employeeGroup?.id ?? GID, RID));
} finally {
  const del = await req("DELETE", `/route-assignments/${RID}`);
  console.log("\ncleanup delete", RID, "->", del.status);
}
