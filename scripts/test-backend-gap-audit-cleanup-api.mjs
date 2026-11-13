#!/usr/bin/env node
/** Read-only, independent audit of identities saved by the November 13 runners. */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";

const suite = createApiSuite({title: "Independent mock audit cleanup readback", options: {output: {flag: "--output", takesValue: true}, retainedOnly: {flag: "--retained-only"}}});
suite.opts.skipCrud = true;
const journals = new Set(), invoices = new Set(), deleted = new Set(), evidence = [];
const piecePrefixes = new Set(), retired = new Set(), poolRows = new Map();
for (const file of fs.readdirSync("docs").filter(file => /2026-11-13\.json$/.test(file))) {
  const artifact = JSON.parse(fs.readFileSync(`docs/${file}`, "utf8"));
  for (const id of artifact.journals ?? []) journals.add(String(id));
  if (artifact.marker?.startsWith("CODEX-INVENTORY-")) {
    if (artifact.retained?.item?.id) retired.add(`/inventory/items/${artifact.retained.item.id}`);
    if (artifact.retained?.supplier?.id) retired.add(`/inventory/suppliers/${artifact.retained.supplier.id}`);
  }
  for (const row of artifact.evidence ?? []) {
    if (row.label === "Generated invoice piece shape" && row.sample?.number) piecePrefixes.add(row.sample.number.slice(0, -4));
    if (row.label === "Retained generated unassigned fixture reservations") for (const item of row.rows ?? []) poolRows.set(item.id, item);
    if (/^Cleanup \/(users|roles|employees|containers|vehicle-routes)\//.test(row.label ?? "") && row.passed) deleted.add(row.label.replace("Cleanup ", ""));
    if (row.label === "Created invoice through real portal adapter") invoices.add(row.invoiceId);
    if (row.method === "POST" && ["/journals", "/journals/sync"].includes(row.path) && row.response?.data?.id) journals.add(String(row.response.data.id));
  }
}
async function verify(label, path, predicate) {
  const r = await suite.request("GET", path);
  const passed = predicate(r);
  evidence.push({label, path, http: r.status, passed, transactionStatus: r.json?.data?.transactionStatus, clearanceStatus: r.json?.data?.clearanceStatus, reconciliationStatus: r.json?.data?.reconciliationStatus, branchId: r.json?.data?.branch?.id, closeoutId: r.json?.data?.incomeStatement?.id});
  if (passed) suite.pass(label); else suite.fail(label, r.status, r.json?.error ?? "Saved-state invariant failed");
}
if (!suite.opts.retainedOnly) {
for (const id of journals) await verify(`Posted fixture ${id} is reversed and excluded from pending queues`, `/journals/${id}`, r => suite.ok(r) && r.json.data.transactionStatus === "REVERSED" && r.json.data.clearanceStatus === "NOT_REQUIRED" && r.json.data.reconciliationStatus === "NOT_REQUIRED");
for (const id of invoices) await verify(`Fixture invoice ${id} is deleted`, `/invoices/${id}`, r => r.status === 404);
for (const path of deleted) await verify(`Temporary resource remains deleted ${path}`, path, r => r.status === 404);
}
for (const prefix of piecePrefixes) {
  const r = await suite.request("POST", "/barcodes/search", {filters: [{field: "number", operator: "startsWith", value: prefix}], pagination: {page: 1, limit: 1}});
  const passed = suite.ok(r) && Number(r.json?.total) === 0;
  const label = `Deleted shipment catalog prefix ${prefix} has no remaining pieces`;
  evidence.push({label, http: r.status, passed, total: r.json?.total});
  if (passed) suite.pass(label); else suite.fail(label, r.status, "Catalog cleanup not confirmed");
}
for (const path of retired) await verify(`Inventory fixture remains retired ${path}`, path, r => suite.ok(r) && r.json?.data?.isActive === false);
for (const row of poolRows.values()) {
  const r = await suite.request("POST", "/invoices/reserved/search", {filters: [{field: "number", operator: "eq", value: row.number}], pagination: {page: 1, limit: 1}});
  const item = suite.rowsOf(r)[0];
  const passed = suite.ok(r) && item?.id === row.id && item.allocation?.userId === 0 && !item.claimed;
  const label = `Generated reservation ${row.number} is unclaimed and unassigned`;
  evidence.push({label, http: r.status, passed, id: row.id});
  if (passed) suite.pass(label); else suite.fail(label, r.status, "Reservation return not confirmed");
}
const branchPeriod = await suite.request("GET", "/income-statements/current?branchId=1");
evidence.push({label: "Existing loan-account branch period readiness", path: "/income-statements/current?branchId=1", http: branchPeriod.status, data: branchPeriod.json?.data});
if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), companyId: suite.opts.companyId, evidence}, null, 2));
suite.finish("Readback performs no cleanup writes; retained financial periods/history are intentional.");
