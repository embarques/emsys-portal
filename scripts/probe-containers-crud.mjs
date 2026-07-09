#!/usr/bin/env node
/** Confirm containers full CRUD + cleanup (server assigns id on create). */
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

const body = {
  name: `ZZ_PROBE_${STAMP}`,
  booking: `BK-${STAMP}`,
  containerNumber: "PROBE1234567",
  cost: 50,
};
const create = await req("POST", "/containers", body);
console.log("CREATE:", create.status, JSON.stringify(create.json).slice(0, 160));

const createdId =
  create.json?.data?.id ??
  (typeof create.json?.data === "number" ? create.json.data : null);

if (create.status >= 200 && create.status < 300 && createdId) {
  const read = await req("GET", `/containers/${createdId}`);
  console.log("READ:", read.status);
  const upd = await req("PUT", `/containers/${createdId}`, {
    id: createdId,
    name: body.name,
    booking: body.booking,
    cost: 99,
  });
  console.log("UPDATE:", upd.status);
  const del = await req("DELETE", `/containers/${createdId}`);
  console.log("DELETE:", del.status);
  const gone = await req("GET", `/containers/${createdId}`);
  console.log("VERIFY GONE:", gone.status);
}
