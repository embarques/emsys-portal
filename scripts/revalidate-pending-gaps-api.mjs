#!/usr/bin/env node
/** Bounded gap revalidation. Writes only uniquely tagged new directory fixtures. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";
import { createPortalLoader, createHttpApiClient } from "./lib/portal-modules.mjs";

const suite = createApiSuite({
  title: "Pending gap revalidation",
  options: { writeFixtures: { flag: "--write-fixtures" }, output: { flag: "--output", takesValue: true } },
});
const marker = `CODEX-REVALIDATE-${randomUUID()}`;
const evidence = [], owned = [];
function rows(r) { return suite.rowsOf(r); }
async function request(method, path, body, headers) {
  if (["PUT", "PATCH", "DELETE"].includes(method)) {
    if (!owned.some(row => path === `${row.path}/${row.id}`)) throw Error("Refusing to mutate a record not created by this run");
  }
  const r = await suite.request(method, path, body, headers);
  if (r.status === 401) throw Error("Token expired/rejected; stopped live revalidation");
  evidence.push({ method, path, ...(body ? { body } : {}), http: r.status,
    success: r.json?.success, message: r.json?.message, error: r.json?.error,
    total: r.json?.total, returned: rows(r).length,
    ...(r.status >= 400 ? { detail: suite.errDetail(r) } : {}) });
  return r;
}
function check(label, condition, detail) {
  evidence.push({ label, passed: Boolean(condition), ...(detail ? { detail } : {}) });
  if (condition) suite.pass(label); else suite.fail(label, 0, detail || "Assertion failed");
}
async function create(path, body) {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) throw Error("Fixture writes not enabled");
  if (!JSON.stringify(body).includes(marker)) throw Error("Fixture must carry this run's marker");
  const r = await request("POST", path, body);
  const id = suite.extractId(r);
  if (suite.ok(r) && id != null) owned.push({ path, id, marker });
  if (!suite.ok(r) || id == null) throw Error(`Fixture ${path}: HTTP ${r.status}; ${suite.errDetail(r)}`);
  return id;
}
async function search(path, filters = [], sort = [{ field: "createdAt", direction: "desc" }], limit = 2) {
  return request("POST", `${path}/search`, { filters, sort, pagination: { page: 1, limit } });
}
const capabilities = [
  ["/branches", "settings.labelPrefix", marker, "filter"],
  ["/containers", "barcodeSequence", 0, "filter"],
  ["/containers", "deliverySequence", 0, "filter"],
  ["/vehicles", "inspectionDate", "2026-11-14", "filter"],
  ["/vehicles", "registrationDate", "2026-11-14", "filter"],
  ["/inventory/receipts", "postedAt", "2026-11-01", "filter"],
  ["/inventory/dispatches", "postedAt", "2026-11-01", "filter"],
  ["/inventory/receipts", "postedAt", null, "sort"],
  ["/inventory/dispatches", "postedAt", null, "sort"],
];
try {
  const auth = await request("GET", "/users/current");
  if (!suite.ok(auth)) throw Error(`Authentication unavailable: HTTP ${auth.status}`);
  evidence.push({ label: "Authorized context", companyId: suite.opts.companyId,
    userId: auth.json.data?.id, branchId: auth.json.data?.branch?.id, roleId: auth.json.data?.role?.id });
  for (const [path, field, value, kind] of capabilities) {
    for (const direction of kind === "sort" ? ["asc", "desc"] : [null]) {
      const r = await search(path, kind === "filter" ? [{ field, operator: field.endsWith("At") ? "gte" : "eq", value }] : [],
        [{ field: kind === "sort" ? field : "id", direction: direction ?? "asc" }]);
      check(`B09 accepts ${path} ${kind} ${field}${direction ? ` ${direction}` : ""}`, suite.ok(r), `HTTP ${r.status}; ${suite.errDetail(r)}`);
    }
  }
  const clock = await request("GET", "/vehicle-routes/business-date");
  evidence.push({ label: "Business clock", http: clock.status, data: clock.json?.data });
  const categories = await request("GET", "/complaint-categories");
  evidence.push({ label: "B17 category model", http: categories.status, categories: rows(categories) });
  for (const origin of ["http://localhost:3000", "http://localhost:3100", "http://127.0.0.1:3100"]) {
    const r = await fetch(`${suite.opts.baseUrl}/inventory/closeouts`, {
      method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,x-company-id,if-match,idempotency-key" },
      signal: AbortSignal.timeout(30_000),
    });
    evidence.push({ label: "F03 CORS", origin, http: r.status,
      allowOrigin: r.headers.get("access-control-allow-origin"), allowHeaders: r.headers.get("access-control-allow-headers") });
  }
  if (suite.opts.writeFixtures && !suite.opts.skipCrud) {
    const branchId = await create("/branches", { name: marker, code: `Z${randomUUID().slice(0, 6)}`, type: "US",
      settings: { labelPrefix: marker } });
    const branch = await request("GET", `/branches/${branchId}`);
    check("B09 fixture prefix saved", branch.json?.data?.settings?.labelPrefix === marker);
    const prefixMatch = await search("/branches", [{ field: "settings.labelPrefix", operator: "eq", value: marker }]);
    check("B09 labelPrefix matches saved branch", suite.ok(prefixMatch) && rows(prefixMatch).some(row => row.id === branchId));
    const prefixMiss = await search("/branches", [{ field: "settings.labelPrefix", operator: "eq", value: marker + "-missing" }]);
    check("B09 labelPrefix excludes nonmatching branch", suite.ok(prefixMiss) && !rows(prefixMiss).some(row => row.id === branchId));
    const containerId = await create("/containers", { name: marker, containerNumber: marker, booking: marker, barcodeSequence: 17, deliverySequence: 23, cost: 0 });
    const savedContainer = (await request("GET", `/containers/${containerId}`)).json?.data;
    for (const field of ["barcodeSequence", "deliverySequence"]) {
      const value = savedContainer?.[field];
      if (!Number.isFinite(value)) { check(`B09 fixture ${field} readable`, false); continue; }
      const match = await search("/containers", [{ field: "id", operator: "eq", value: Number(containerId) }, { field, operator: "eq", value }]);
      const miss = await search("/containers", [{ field: "id", operator: "eq", value: Number(containerId) }, { field, operator: "eq", value: value + 1 }]);
      check(`B09 ${field} matches persisted numeric value`, suite.ok(match) && rows(match).some(row => row.id === containerId));
      check(`B09 ${field} excludes wrong numeric value`, suite.ok(miss) && rows(miss).length === 0);
    }
    const vehicleId = await create("/vehicles", { name: marker, vehicleId: marker, vin: marker, licensePlate: marker.slice(-8),
      year: 2026, fuelType: "DIESEL", active: true, branch: { id: branchId, code: branch.json.data.code }, inspectionDate: "2026-11-24", registrationDate: "2026-11-25" });
    for (const [field, value] of [["inspectionDate", "2026-11-24"], ["registrationDate", "2026-11-25"]]) {
      let positiveControl = false;
      for (const [operator, date, expected] of [["eq", value, 1], ["lte", "2026-11-01", 0]]) {
        const result = await search("/vehicles", [{ field: "id", operator: "eq", value: String(vehicleId) }, { field, operator, value: date }]);
        check(`B09 ${field} ${operator} respects saved fixture`, suite.ok(result) && rows(result).length === expected);
        if (operator === "eq") positiveControl = suite.ok(result) && rows(result).length === expected;
      }
      if (positiveControl) {
        const invalid = await search("/vehicles", [{ field, operator: "eq", value: "2026-02-30" }]);
        check(`B09 ${field} rejects impossible dates`, invalid.status === 400);
      } else {
        evidence.push({ label: `B09 ${field} impossible-date validation`, status: "unverified",
          reason: "Valid field matching control failed; an unsupported-field 400 is not date-validation proof." });
      }
    }
    // Exercise the actual portal read adapters on only this run's fixtures.
    const load = createPortalLoader({ apiClient: createHttpApiClient(request) });
    for (const [file, fn, id, identity] of [
      ["branches", "fetchBranchById", branchId, "id"], ["containers", "fetchContainerById", containerId, "id"],
      ["vehicles", "fetchVehicleById", String(vehicleId), "id"],
    ]) {
      try {
        const entity = await load(`src/lib/${file}/api/${file}-api.ts`)[fn](id);
        check(`Portal ${file} adapter reads owned fixture`, String(entity[identity]) === String(id));
      } catch (e) { check(`Portal ${file} adapter reads owned fixture`, false, e.message); }
    }
  }
} catch (error) { evidence.push({ label: "Run stopped", error: error.message }); suite.fail("Run prerequisites", 0, error.message); }
finally {
  // Retain this run's tagged fixtures for audit; never delete pre-existing data.
  const result = { checkedAt: new Date().toISOString(), companyId: suite.opts.companyId, marker, owned, evidence,
    limitations: ["Accepted requests do not prove complete matching, isolation, rollback or capacity.",
      "No pre-existing record was intentionally updated or deleted. New tagged fixtures are retained."] };
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify(result, null, 2) + "\n");
}
suite.finish("Review persisted controls separately from simple capability acceptance.");
