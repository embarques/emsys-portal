#!/usr/bin/env node
/** Read-only by default. --write-probes checks invalid commands in an approved mock company. */
import { createApiSuite } from "./lib/api-suite.mjs";

const suite = createApiSuite({
  title: "Daily-route approval readiness",
  options: { writeProbes: { flag: "--write-probes" } },
  usage: "  --write-probes    Probe invalid change/review commands (approved mock data only)\n",
});
const { request, ok, pass, fail, note } = suite;
suite.opts.skipCrud = true;
suite.banner([`Mode: ${suite.opts.writeProbes ? "GET plus invalid-command probes" : "GET requests only"}; record contents and credentials are not printed.`]);

const permissionNames = ["canOperateDailyRoute", "canManageDailyRouteRecords", "canCreateChangeRequest", "canViewChangeRequest", "canApproveChangeRequest"];
const effective = await request("GET", "/users/permissions");
if (!ok(effective)) {
  fail("Effective permissions", effective.status);
} else {
  const permissions = effective.json?.data?.permissions ?? [];
  pass("Effective permissions readable");
  note(`Current account workflow grants: ${permissionNames.filter(name => permissions.some(value => value.name === name)).join(", ") || "none"}`);
}

const catalog = [];
let catalogComplete = false;
for (let page = 1; page <= 20; page += 1) {
  const response = await request("GET", `/permissions?page=${page}&limit=100`);
  if (!ok(response) || !Array.isArray(response.json?.data)) {
    fail("Permission catalog readable", response.status);
    break;
  }
  const rows = response.json.data;
  catalog.push(...rows);
  if (rows.length < 100 || (typeof response.json.total === "number" && catalog.length >= response.json.total)) {
    catalogComplete = true;
    break;
  }
}
if (catalogComplete) {
  for (const name of permissionNames) {
    if (catalog.some(value => value.name === name)) pass(`Catalog: ${name}`);
    else fail(`Catalog: ${name}`, 200, "grant absent from the complete catalog");
  }
} else note("Catalog incomplete; no missing-permission conclusion is drawn.");

const changes = await request("GET", "/change-requests?page=1&limit=1");
if (ok(changes) && Array.isArray(changes.json?.data)) pass("Change requests available");
else fail("Change requests available", changes.status, changes.json?.message ?? "Unexpected response");

if (suite.opts.writeProbes) {
  const missingId = "000000000000000000000000";
  for (const [method, path, body] of [
    ["GET", `/change-requests/${missingId}`],
    ["POST", "/change-requests", {}],
    ["POST", `/change-requests/${missingId}/approve`, { reason: "Mock readiness probe" }],
    ["POST", `/change-requests/${missingId}/reject`, { reason: "Mock readiness probe" }],
  ]) {
    const response = await request(method, path, body);
    if (response.status === 404 && /route not found/i.test(response.json?.message ?? "")) {
      fail(`${method} ${path}`, response.status, "Route not found");
    } else if (ok(response) || response.status === 0 || response.status >= 500 || response.status === 401) {
      fail(`${method} ${path}`, response.status, ok(response) ? "Invalid command or nonexistent request unexpectedly accepted" : "Probe could not validate the route");
    } else {
      note(`${method} ${path}: HTTP ${response.status}; invalid-command probe cannot establish valid approval behavior`);
    }
  }
}

for (const [resource, path] of [["pickup", "/pickups"], ["invoice", "/invoices"], ["journal", "/journals"], ["labels", "/barcodes"], ["inventory", "/inventory/dispatches"]]) {
  const response = await request("GET", `${path}?page=1&limit=1`);
  if (!ok(response)) {
    fail(`${resource}: list access`, response.status, response.json?.message ?? "Unexpected response");
    continue;
  }
  pass(`${resource}: list access`);
  const row = response.json?.data?.[0];
  if (!row) { note(`${resource}: empty list; record permissions unverified`); continue; }
  const id = String(resource === "labels" ? row.barcodeId ?? row.id : row.id);
  const target = await request("GET", `/change-requests/target?${new URLSearchParams({ resourceType: resource, resourceId: id })}`);
  const context = target.json?.data;
  if (ok(target) && context?.resourceType === resource && String(context?.resourceId) === id &&
      typeof context?.version === "string" && context.version && typeof context?.allowedActions === "object" && context.allowedActions !== null) {
    pass(`${resource}: target version and effective request actions`);
  } else {
    fail(`${resource}: target version and effective request actions`, target.status, target.json?.message ?? "Missing target context");
  }
  note(`${resource}: list row effective actions ${row.allowedActions ? "present" : "absent"}; version ${row.version === undefined ? "absent" : "present"}`);
}
note("An admin read-only session cannot establish employee route isolation, atomic approval, stale-version rejection, audit immutability or reversal idempotency. Those require separate actors and non-production fixtures.");
suite.finish("Read-only prerequisites passed; mutation guarantees remain unverified.");
