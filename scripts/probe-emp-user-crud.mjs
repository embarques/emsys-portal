#!/usr/bin/env node
/** Confirm employees & users create with client id (maxId+1) + CRUD + cleanup. */
const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" };
const STAMP = Date.now();
async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, json };
}
async function maxId(path) {
  const r = await req("POST", `${path}/search?page=1&limit=1&offset=0`, { sort: [{ field: "id", direction: "desc" }], filters: [] });
  return Array.isArray(r.json?.data) ? Number(r.json.data[0]?.id) || 0 : 0;
}

// Employees
{
  const next = (await maxId("/employees")) + 1;
  console.log("employees next id:", next);
  const body = { id: next, name: `ZZ_PROBE_${STAMP}`, title: "Probe", department: "driver", active: true, branch: { id: 1, code: "NY" }, address: { city: "NEW YORK", state: "NY", zipcode: "10001" } };
  const c = await req("POST", "/employees", body);
  console.log("  CREATE:", c.status, JSON.stringify(c.json).slice(0, 90));
  if (c.status < 300) {
    console.log("  READ:", (await req("GET", `/employees/${next}`)).status);
    console.log("  UPDATE:", (await req("PUT", `/employees/${next}`, { ...body, title: "Probe EDIT" })).status);
    console.log("  DELETE:", (await req("DELETE", `/employees/${next}`)).status);
    console.log("  GONE:", (await req("GET", `/employees/${next}`)).status);
  }
}

// Users
{
  const next = (await maxId("/users")) + 1;
  const role = await req("GET", "/roles?limit=1");
  const r = Array.isArray(role.json?.data) ? role.json.data[0] : null;
  console.log("users next id:", next, "role:", r?.id);
  const body = { id: next, uid: `ZZPROBEUID${STAMP}`, email: `probe${STAMP}@example.com`, userName: `zzprobe${STAMP}`, fullName: `ZZ Probe`, active: true, branch: { id: 1, name: "Main", code: "NY" }, role: r ? { id: r.id, name: r.name, active: true } : { id: 1, name: "Administrador", active: true } };
  const c = await req("POST", "/users", body);
  console.log("  CREATE:", c.status, JSON.stringify(c.json).slice(0, 120));
  if (c.status < 300) {
    console.log("  READ:", (await req("GET", `/users/${next}`)).status);
    console.log("  UPDATE:", (await req("PUT", `/users/${next}`, { ...body, fullName: "ZZ Probe EDIT" })).status);
    console.log("  DELETE:", (await req("DELETE", `/users/${next}`)).status);
    console.log("  GONE:", (await req("GET", `/users/${next}`)).status);
  }
}
