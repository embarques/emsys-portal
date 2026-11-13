#!/usr/bin/env node
/** Read-only follow-up for the isolated November 12 Section 3 fixtures. */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";
const suite = createApiSuite({title: "Section 3 saved-state readback", options: {output: {flag: "--output", takesValue: true}}});
const evidence = [];
for (const [label, path] of [
  ["Nonexistent bank journal", "/journals/6af5fd37bdc3aed480bf810e"],
  ["Wrong-branch bank journal", "/journals/6af5fd37bdc3aed480bf8110"],
  ["Selected bank account scope", "/chart-accounts/1"],
  ["Nonexistent bank account control", "/chart-accounts/2147483646"],
  ["Bounded journal createdAt sort", "/journals?page=1&limit=6&sort=createdAt:desc"],
]) {
  const r = await suite.request("GET", path);
  evidence.push({label, path, http: r.status, data: r.json});
  suite.note(`${label}: HTTP ${r.status}`);
}
const reversal = await suite.request("POST", "/journals/search", {operator: "and", filters: [{field: "incomeStatement.id", operator: "eq", value: 32701}, {field: "transactionType", operator: "eq", value: "REVERSAL"}], pagination: {page: 1, limit: 10}});
const rows = suite.rowsOf(reversal);
evidence.push({label: "First bank suite reversal attribution", http: reversal.status, total: reversal.json?.total, rows});
suite.check("Three first-suite reversals retain fixture branch and closeout", reversal, r => {
  if (rows.length !== 3 || rows.some(row => row.branch?.id !== 14 || row.incomeStatement?.id !== 32701)) throw Error("Expected three reversals in branch 14 / closeout 32701");
  return `HTTP ${r.status}`;
});
for (const id of ["6af5febfbdc3aed480bf8158", "6af5fec2bdc3aed480bf815f"]) {
  const detail = await suite.request("GET", `/journals/${id}`);
  evidence.push({label: "Reversed PAYMENT detail", id, http: detail.status, data: detail.json?.data});
  for (const value of ["OUTSTANDING", "RECONCILED", "NOT_REQUIRED"]) {
    const response = await suite.request("POST", "/journals/search", {operator: "and", filters: [{field: "id", operator: "eq", value: id}, {field: "reconciliationStatus", operator: "eq", value}], pagination: {page: 1, limit: 1}});
    const matches = suite.ok(response) && Number(response.json.total) === (value === "NOT_REQUIRED" ? 1 : 0);
    evidence.push({label: "Reversed PAYMENT status filter", id, value, http: response.status, total: response.json?.total, matches});
    if (matches) suite.pass(`Reversed PAYMENT ${id} ${value} agrees with detail`);
    else suite.fail(`Reversed PAYMENT ${id} ${value}`, response.status, response.json?.message ?? "Count mismatch");
  }
}
if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), evidence}, null, 2));
suite.finish("Saved-state readback complete.");
