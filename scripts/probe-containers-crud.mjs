#!/usr/bin/env node
/** Confirm containers create requires a client id (maxId+1), then full CRUD + cleanup. */
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

const top = await req("POST", "/containers/search?page=1&limit=1&offset=0", {
  sort: [{ field: "id", direction: "desc" }], filters: [],
});
const maxId = Array.isArray(top.json?.data) ? Number(top.json.data[0]?.id) || 0 : 0;
const nextId = maxId + 1;
console.log("max container id:", maxId, "-> next:", nextId);

const body = { id: nextId, name: `ZZ_PROBE_${STAMP}`, booking: `BK-${STAMP}`, cost: 50 };
const create = await req("POST", "/containers", body);
console.log("CREATE with id:", create.status, JSON.stringify(create.json).slice(0, 120));

if (create.status >= 200 && create.status < 300) {
  const read = await req("GET", `/containers/${nextId}`);
  console.log("READ:", read.status);
  const upd = await req("PUT", `/containers/${nextId}`, { id: nextId, name: body.name, booking: body.booking, cost: 99 });
  console.log("UPDATE:", upd.status);
  const del = await req("DELETE", `/containers/${nextId}`);
  console.log("DELETE:", del.status);
  const gone = await req("GET", `/containers/${nextId}`);
  console.log("VERIFY GONE:", gone.status);
}
