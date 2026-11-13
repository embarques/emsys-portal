#!/usr/bin/env node
/** Bounded reservation/cursor/tie readback; never changes allocations or records. */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";
const suite = createApiSuite({title: "Reservation saved-state controls", options: {output: {flag: "--output", takesValue: true}}});
suite.opts.skipCrud = true;
const evidence = [];
const safe = row => ({id: row.id, number: row.number, createdAt: row.createdAt, reservedAt: row.reservedAt, receivedAt: row.receivedAt});
async function read(label, method, path, body) {
  const r = await suite.request(method, path, body);
  const data = r.json?.data;
  const rows = Array.isArray(data) ? data : data?.items ?? [];
  evidence.push({label, method, path, http: r.status, message: r.json?.message, error: r.json?.error, rows: rows.map(safe), remaining: data?.remaining, hasNextCursor: Boolean(data?.nextCursor)});
  return {r, rows, cursor: data?.nextCursor};
}
function verify(label, condition) {
  evidence.push({label, passed: Boolean(condition)});
  if (condition) suite.pass(label); else suite.fail(label, 0, "Readback invariant failed");
}
const ids = rows => rows.map(r => r.id).join(",");
try {
  const path = "/invoices/reserved?limit=3";
  const first = await read("Company pool page one", "GET", path);
  const repeated = await read("Company pool repeat", "GET", path);
  if (first.rows.length) verify("Unchanged reservation page returns stable IDs", suite.ok(first.r) && suite.ok(repeated.r) && ids(first.rows) === ids(repeated.rows));
  else suite.note("Empty reservation sample; ordering is inconclusive.");
  if (first.cursor) {
    const next = await read("Company pool next cursor", "GET", `${path}&after=${encodeURIComponent(first.cursor)}`);
    verify("Valid company-pool cursor advances without repeating IDs", suite.ok(next.r) && next.rows.length > 0 && next.rows.every(row => !first.rows.some(prior => prior.id === row.id)));
    await read("Cursor reused with changed text filter", "GET", `${path}&q=CODEX-NO-MATCH-${Date.now()}&after=${encodeURIComponent(first.cursor)}`);
    suite.note("Changed-filter acceptance does not establish tenant binding; no second authorized tenant was supplied.");
  } else suite.note("No next cursor in bounded company-pool sample.");
  const body = {filters: [{field: "number", operator: "startsWith", value: first.rows[0]?.number.slice(0, 7) ?? "CODEX-NO-MATCH"}], pagination: {page: 1, limit: 20}, sort: [{field: "createdAt", direction: "desc"}]};
  const a = await read("Timestamp-sorted reservation search", "POST", "/invoices/reserved/search?page=1&limit=20", body);
  const b = await read("Repeated timestamp-sorted reservation search", "POST", "/invoices/reserved/search?page=1&limit=20", body);
  if (suite.ok(a.r) && suite.ok(b.r)) {
    if (a.rows.length) verify("Timestamp-sorted reservation search is stable in repeated bounded sample", ids(a.rows) === ids(b.rows));
    else suite.note("No rows in timestamp-sorted control; stable ties remain unverified.");
    const times = a.rows.map(row => row.createdAt).filter(Boolean);
    evidence.push({label: "Stored timestamp ties present in sample", present: new Set(times).size < times.length});
  } else suite.note("Timestamp sort/filter rejected; stable ties remain unverified.");
  const invalid = await read("Invalid reservedAt date", "POST", "/invoices/reserved/search?page=1&limit=1", {filters: [{field: "reservedAt", operator: "gte", value: "invalid-date"}], pagination: {page: 1, limit: 1}});
  verify("Invalid reservedAt date receives validation error", invalid.r.status === 400);
  const received = await read("Valid receivedAt field probe", "POST", "/invoices/reserved/search?page=1&limit=1", {filters: [{field: "receivedAt", operator: "gte", value: "2026-11-01"}], pagination: {page: 1, limit: 1}});
  verify("receivedAt filter is supported", suite.ok(received.r));
} finally {
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), companyId: suite.opts.companyId, evidence}, null, 2));
}
suite.finish("Bounded reservation readback complete; multi-tenant and controlled date boundaries remain separate.");
