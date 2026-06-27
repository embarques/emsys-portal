#!/usr/bin/env node
/**
 * Probe role model shape + which field × operator filter combos the backend
 * accepts (and matches) via POST /roles/search, the OR bar search, the
 * permissions catalog, and a self-cleaning CRUD pass.
 *
 * Usage:
 *   EMSYS_TOKEN=<jwt> EMSYS_COMPANY_ID=<id> node scripts/probe-roles-api.mjs
 */

const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
const RESOURCE = "/roles";

if (!token) {
  console.error("Set EMSYS_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "x-company-id": companyId,
  "Content-Type": "application/json",
};

async function req(method, path, body) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
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

const post = (path, body) => req("POST", path, body);

async function search(label, field, operator, value) {
  const { status, json } = await post(`${RESOURCE}/search?page=1&limit=1&offset=0`, {
    sort: [{ field: "id", direction: "desc" }],
    filters: [{ operator: "and", filters: [{ field, operator, value }] }],
  });
  const ok = status >= 200 && status < 300 && json?.success !== false;
  const matched = Array.isArray(json?.data) ? json.data.length : 0;
  const detail = ok
    ? `rows=${matched} subtotal=${json?.subtotal ?? "-"} total=${json?.total ?? "-"}`
    : (json?.error ?? json?.message ?? JSON.stringify(json)).toString().slice(0, 70);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label.padEnd(44)} ${String(status).padEnd(4)} ${detail}`);
  return { ok, matched };
}

// 1) Sample one role to inspect keys + realistic values.
const sampleRes = await fetch(`${baseUrl}${RESOURCE}?limit=1`, { headers });
const sampleJson = await sampleRes.json().catch(() => null);
const sample = Array.isArray(sampleJson?.data) ? sampleJson.data[0] : null;
console.log("=== GET /roles?limit=1 ===");
console.log("status:", sampleRes.status, "total:", sampleJson?.total);
console.log("sample:", JSON.stringify(sample, null, 2));
console.log("keys:", sample ? Object.keys(sample).join(", ") : "(none)");

const sub = (v) => (typeof v === "string" && v.length >= 2 ? v.slice(0, 2) : v != null ? String(v) : "a");
const createdByName =
  sample?.createdBy && typeof sample.createdBy === "object"
    ? sample.createdBy.name ?? sample.createdBy.fullName ?? sample.createdBy.userName
    : undefined;

const TEXT_OPS = ["contains", "startsWith", "eq", "neq"];
const NUM_OPS = ["eq", "neq", "gte", "lte", "gt", "lt"];
const DATE_OPS = ["eq", "neq", "gte", "lte"];

console.log("\n=== TEXT fields × ops ===");
await (async () => {
  const nameVal = sub(sample?.name);
  for (const op of TEXT_OPS) await search(`name ${op} "${nameVal}"`, "name", op, nameVal);
  const byVal = sub(createdByName ?? "a");
  for (const op of TEXT_OPS) await search(`createdBy.name ${op} "${byVal}"`, "createdBy.name", op, byVal);
  await search(`updatedBy.name contains "${byVal}"`, "updatedBy.name", "contains", byVal);
  await search(`permissions.name contains "a"`, "permissions.name", "contains", "a");
})();

console.log("\n=== NUMERIC id (number + string) ===");
for (const op of NUM_OPS) await search(`id ${op} 1 (number)`, "id", op, 1);
await search(`id eq "${sample?.id ?? 1}" (string)`, "id", "eq", String(sample?.id ?? 1));

console.log("\n=== BOOLEAN active (boolean + string) ===");
for (const op of ["eq", "neq"]) await search(`active ${op} true (boolean)`, "active", op, true);
await search(`active eq "true" (string)`, "active", "eq", "true");

console.log("\n=== DATE fields (string YYYY-MM-DD) ===");
for (const field of ["createdAt", "updatedAt"]) {
  for (const op of DATE_OPS) await search(`${field} ${op} "2024-01-01"`, field, op, "2024-01-01");
}

console.log("\n=== OR contains across bar fields ===");
{
  const barFields = ["name", "createdBy.name", "updatedBy.name", "id"];
  const term = sub(sample?.name);
  const { status, json } = await post(`${RESOURCE}/search?page=1&limit=1&offset=0`, {
    sort: [{ field: "id", direction: "desc" }],
    filters: [{ operator: "or", filters: barFields.map((field) => ({ field, operator: "contains", value: term })) }],
  });
  const ok = status >= 200 && status < 300 && json?.success !== false;
  console.log(
    `[${ok ? "PASS" : "FAIL"}] OR contains "${term}" across ${barFields.length} fields  ${status}  subtotal=${json?.subtotal ?? "-"} total=${json?.total ?? "-"}` +
      (ok ? "" : `  ${(json?.error ?? json?.message ?? "").toString().slice(0, 90)}`),
  );
  for (const field of barFields) {
    const res = await post(`${RESOURCE}/search?page=1&limit=1&offset=0`, {
      sort: [{ field: "id", direction: "desc" }],
      filters: [{ operator: "or", filters: [{ field, operator: "contains", value: term }] }],
    });
    const okf = res.status >= 200 && res.status < 300 && res.json?.success !== false;
    console.log(`   - contains on ${field}: ${okf ? "PASS" : "FAIL"} ${res.status}`);
  }
}

console.log("\n=== Permissions catalog (GET /permissions?limit=1) ===");
const permRes = await fetch(`${baseUrl}/permissions?limit=1`, { headers });
const permJson = await permRes.json().catch(() => null);
const permSample = Array.isArray(permJson?.data) ? permJson.data[0] : null;
console.log("status:", permRes.status, "total:", permJson?.total);
console.log("permission sample:", JSON.stringify(permSample, null, 2));

console.log("\n=== CRUD pass (create → retrieve → update → delete) ===");
{
  const permId = permSample?.id ?? permSample?._id;
  const name = `__probe_role_${Date.now()}`;

  const createBody = {
    name,
    active: true,
    permissions: permId != null ? [{ id: Number(permId) }] : [],
  };
  const created = await post(RESOURCE, createBody);
  const okCreate = created.status >= 200 && created.status < 300 && created.json?.success !== false;
  const createdId = created.json?.data?.id ?? created.json?.data?._id ?? created.json?.id;
  console.log(
    `[${okCreate ? "PASS" : "FAIL"}] CREATE ${created.status}  id=${createdId ?? "-"}` +
      (okCreate ? "" : `  ${(created.json?.error ?? created.json?.message ?? JSON.stringify(created.json)).toString().slice(0, 100)}`),
  );

  if (okCreate && createdId != null) {
    const got = await req("GET", `${RESOURCE}/${createdId}`);
    const okGet = got.status >= 200 && got.status < 300 && got.json?.success !== false;
    console.log(`[${okGet ? "PASS" : "FAIL"}] RETRIEVE ${got.status}  name=${got.json?.data?.name ?? got.json?.name ?? "-"}`);

    const upd = await req("PUT", `${RESOURCE}/${createdId}`, { ...createBody, name: `${name}_upd` });
    const okUpd = upd.status >= 200 && upd.status < 300 && upd.json?.success !== false;
    console.log(
      `[${okUpd ? "PASS" : "FAIL"}] UPDATE ${upd.status}` +
        (okUpd ? "" : `  ${(upd.json?.error ?? upd.json?.message ?? "").toString().slice(0, 100)}`),
    );

    const del = await req("DELETE", `${RESOURCE}/${createdId}`);
    const okDel = del.status >= 200 && del.status < 300 && del.json?.success !== false;
    console.log(
      `[${okDel ? "PASS" : "FAIL"}] DELETE ${del.status}` +
        (okDel ? "" : `  ${(del.json?.error ?? del.json?.message ?? "").toString().slice(0, 100)}`),
    );
  }
}

console.log("\nDone.");
