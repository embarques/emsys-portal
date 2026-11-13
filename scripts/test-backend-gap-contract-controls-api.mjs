#!/usr/bin/env node
/** Bounded read-only contract/negative controls; never generates or assigns reservations. */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";

const suite = createApiSuite({title: "Backend gap contract controls", options: {output: {flag: "--output", takesValue: true}}});
suite.opts.skipCrud = true;
const evidence = [];
async function recorded(label, method, path, body) {
  const r = await suite.request(method, path, body);
  evidence.push({label, method, path, body, http: r.status, response: r.json});
  return r;
}
function verify(label, condition) {
  evidence.push({label, passed: Boolean(condition)});
  if (condition) suite.pass(label); else suite.fail(label, 0, "Contract invariant failed");
}
try {
  const auth = await recorded("Authentication control", "GET", "/users/current");
  if (!suite.ok(auth)) throw Error(`Authentication failed: HTTP ${auth.status}`);
  const list = await recorded("Bounded journal indexed-sort control", "GET", "/journals?page=1&limit=6&sort=createdAt:desc");
  const journals = suite.rowsOf(list);
  verify("Bounded journal list returns at most six rows in descending createdAt order", suite.ok(list) && journals.length > 0 && journals.length <= 6 && journals.every((row, i) => i === 0 || Date.parse(journals[i-1].createdAt) >= Date.parse(row.createdAt)));
  for (const field of ["paidAmount", "balance"]) {
    for (const kind of ["filter", "sort"]) {
      const body = {filters: [{field: "status", operator: "eq", value: "ACTIVE"}], pagination: {page: 1, limit: 1}};
      if (kind === "filter") body.filters.push({field, operator: "eq", value: 1});
      else body.sort = [{field, direction: "asc"}];
      const r = await recorded(`Loan ${kind} ${field}`, "POST", "/loans/search", body);
      verify(`Loan ${field} ${kind} succeeds or explicitly rejects unsupported input without 500`, suite.ok(r) || (r.status === 400 && /not allowed|unsupported/i.test(r.json?.error ?? r.json?.message ?? "")));
    }
  }
  for (const [field, value] of [["status", "APPROVED"], ["resourceType", "pickup"], ["action", "UPDATE"], ["requestedBy.id", 73], ["requestedBy.name", "CODEX-NO-MATCH"], ["reviewedBy.id", 73], ["reviewedBy.name", "CODEX-NO-MATCH"], ["createdAt", "2026-11-01"], ["reviewedAt", "2026-11-01"]]) {
    const body = {filters: [{field, operator: "eq", value}], pagination: {page: 1, limit: 2}, sort: [{field: "createdAt", direction: "desc"}]};
    const r = await recorded(`Change-request filter ${field}`, "POST", "/change-requests/search", body);
    verify(`Change-request search accepts documented candidate ${field}`, suite.ok(r));
    if (suite.ok(r) && ["status", "resourceType", "action"].includes(field)) verify(`Change-request ${field} matches stored rows`, suite.rowsOf(r).every(row => row[field] === value));
  }
  const first = await recorded("Reservation nullable timestamp control", "GET", "/invoices/reserved?limit=1");
  const row = suite.rowsOf(first)[0];
  if (suite.ok(first) && row?.receivedAt === null) {
    for (const operator of ["eq", "neq", "gte", "lte"]) {
      const r = await recorded(`Null receivedAt ${operator}`, "POST", "/invoices/reserved/search", {filters: [{field: "number", operator: "eq", value: row.number}, {field: "receivedAt", operator, value: "2026-11-13"}], pagination: {page: 1, limit: 2}});
      verify(`Null receivedAt ${operator} has documented inclusion behavior`, suite.ok(r) && Number(r.json?.total) === (operator === "neq" ? 1 : 0));
    }
  } else suite.note("No null receivedAt control; null semantics unverified.");
  for (const value of ["invalid-date", "2026-02-30"]) {
    const r = await recorded(`Invalid receivedAt ${value}`, "POST", "/invoices/reserved/search", {filters: [{field: "receivedAt", operator: "gte", value}], pagination: {page: 1, limit: 1}});
    verify(`receivedAt rejects ${value}`, r.status === 400);
  }
} catch (error) {
  suite.fail("Contract control prerequisites", 0, error.message);
} finally {
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), companyId: suite.opts.companyId, evidence}, null, 2));
}
suite.finish("Accepted searches alone do not prove all sort, permission or date-boundary semantics.");
