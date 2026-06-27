#!/usr/bin/env node
/**
 * Re-probe pickups advanced filters + bar search using the EXACT body shape the
 * portal sends (buildAdvancedSearchBody): { operator, filters, pagination, sort }.
 */
const baseUrl = (process.env.EMSYS_API_BASE_URL ?? "https://api.embarqueros.com/v1").replace(/\/$/, "");
const token = (process.env.EMSYS_TOKEN ?? "").trim();
const companyId = (process.env.EMSYS_COMPANY_ID ?? "1").trim();
if (!token) { console.error("Set EMSYS_TOKEN."); process.exit(1); }
const headers = { Authorization: `Bearer ${token}`, "x-company-id": companyId, "Content-Type": "application/json" };
const pagination = { page: 1, limit: 1, offset: 0 };

async function search(node) {
  const r = await fetch(`${baseUrl}/pickups/search`, {
    method: "POST", headers,
    body: JSON.stringify({ ...node, pagination, sort: [] }),
  });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, ok: r.status >= 200 && r.status < 300 && j?.success !== false, err: (j?.error ?? j?.message ?? "").toString().slice(0, 50) };
}
const leaf = (field, operator, value) => ({ operator: "and", filters: [{ field, operator, value }] });

const TEXT = ["startsWith", "contains", "eq", "neq"];
const DATE = ["eq", "neq", "gte", "lte"];
const isDate = (f) => f === "date" || /At$/.test(f);
const valFor = (f, op) => (f === "completed" ? true : isDate(f) ? "2024-01-01" : "a");

const fields = [
  ["sender.name", TEXT], ["sender.phones.number", TEXT], ["sender.phone1", TEXT],
  ["sender.address.address1", TEXT], ["sender.address.address2", TEXT], ["sender.address.city", TEXT],
  ["sender.address.state", TEXT], ["sender.address.zipcode", [...TEXT, "gte", "lte"]],
  ["purpose", TEXT], ["receiver.name", TEXT], ["receiver.phones.number", TEXT], ["receiver.phone1", TEXT],
  ["receiver.address.address1", TEXT], ["receiver.address.city", TEXT], ["receiver.address.state", TEXT],
  ["receiver.address.zipcode", [...TEXT, "gte", "lte"]],
  ["createdBy.name", ["eq", "neq", "contains", "startsWith"]],
  ["completed", ["eq", "neq"]], ["date", DATE], ["createdAt", DATE],
];
const bar = ["sender.name", "sender.phone1", "sender.address.address1", "sender.address.city", "sender.address.state", "sender.address.zipcode", "receiver.name", "receiver.phone1", "receiver.address.address1"];

console.log(`pickups recheck (correct body)  Base ${baseUrl}`);
for (const [f, ops] of fields) {
  const parts = [];
  for (const op of ops) {
    const res = await search(leaf(f, op, valFor(f, op)));
    parts.push(res.ok ? `${op}:ok` : `${op}:FAIL${res.status}`);
  }
  console.log(`  [${parts.every((p) => p.endsWith(":ok")) ? "PASS" : "FAIL"}] ${f.padEnd(28)} ${parts.join(" ")}`);
}
const barRes = await search({ operator: "or", filters: bar.map((f) => ({ field: f, operator: "contains", value: "a" })) });
console.log(`  [${barRes.ok ? "PASS" : "FAIL"}] BAR OR (${bar.length})  ${barRes.ok ? "ok" : barRes.status + " " + barRes.err}`);
if (!barRes.ok) {
  for (const f of bar) {
    const r = await search({ operator: "or", filters: [{ field: f, operator: "contains", value: "a" }] });
    if (!r.ok) console.log(`     - offender ${f}: ${r.status}`);
  }
}
console.log("Done.");
