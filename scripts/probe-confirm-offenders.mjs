#!/usr/bin/env node
/** Confirm genuine filter offenders using the exact StripeStyle body the portal sends. */
const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" };

async function s(path, field, operator, value) {
  const r = await fetch(`${baseUrl}${path}/search?page=1&limit=1&offset=0`, {
    method: "POST", headers,
    body: JSON.stringify({ operator: "and", filters: [{ field, operator, value }], sort: [] }),
  });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  const ok = r.status >= 200 && r.status < 300 && j?.success !== false;
  return `${r.status}${ok ? " ok" : " FAIL " + (j?.error ?? j?.message ?? "").toString().slice(0, 40)}`;
}

const cases = [
  ["/invoices", "cost", "gte", 1], ["/invoices", "createdBy.name", "contains", "a"],
  ["/invoices", "employee.name", "contains", "a"], ["/invoices", "sender.address.city", "contains", "a"],
  ["/employees", "address.address1", "contains", "a"], ["/employees", "branch.code", "contains", "a"],
  ["/employees", "address.city", "contains", "a"],
  ["/users", "branch.code", "contains", "a"], ["/users", "accessCode", "gte", 1],
  ["/users", "branch.name", "contains", "a"],
  ["/deliveries", "updatedBy.name", "eq", "a"], ["/deliveries", "updatedBy.name", "contains", "a"],
  ["/roles", "updatedBy.name", "eq", "a"], ["/roles", "updatedBy.name", "contains", "a"],
];
for (const [p, f, op, v] of cases) {
  console.log(`${(p + " " + f + " " + op).padEnd(42)} -> ${await s(p, f, op, v)}`);
}
console.log("Done.");
