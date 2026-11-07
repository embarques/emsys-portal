import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadModule(relative) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", source)(require, loaded, loaded.exports);
  return loaded.exports;
}

const compliance = loadModule("src/lib/vehicles/compliance-due.ts");
const TODAY = "2026-11-07";

function vehicle(overrides = {}) {
  return { id: "v1", name: "Unit 1", active: true, inspectionDate: "", registrationDate: "", ...overrides };
}

test("warns at 7 days or fewer, including today and overdue dates", () => {
  assert.equal(compliance.daysUntilVehicleDate("2026-11-14", TODAY), 7);
  assert.equal(compliance.daysUntilVehicleDate("2026-11-07", TODAY), 0);
  assert.equal(compliance.daysUntilVehicleDate("2026-11-04", TODAY), -3);

  for (const date of ["2026-11-14", "2026-11-07", "2026-10-01"]) {
    assert.ok(compliance.getVehicleComplianceDue(vehicle({ inspectionDate: date }), "inspection", TODAY), date);
  }
  assert.equal(compliance.getVehicleComplianceDue(vehicle({ inspectionDate: "2026-11-15" }), "inspection", TODAY), null);
});

test("reads RFC3339 dates by calendar day and ignores empty or invalid dates", () => {
  assert.equal(compliance.daysUntilVehicleDate("2026-11-10T00:00:00Z", TODAY), 3);
  assert.equal(compliance.daysUntilVehicleDate("", TODAY), null);
  assert.equal(compliance.daysUntilVehicleDate("2026-02-30", TODAY), null);
  assert.equal(compliance.getVehicleComplianceDue(vehicle(), "registration", TODAY), null);
});

test("skips inactive vehicles and sorts most urgent first", () => {
  const items = compliance.collectVehicleComplianceDue(
    [
      vehicle({ id: "a", name: "Bravo", registrationDate: "2026-11-12" }),
      vehicle({ id: "b", name: "Alpha", inspectionDate: "2026-11-01", registrationDate: "2026-11-09" }),
      vehicle({ id: "c", name: "Off", active: false, inspectionDate: "2026-11-01" }),
    ],
    TODAY,
  );
  assert.deepEqual(
    items.map((entry) => [entry.vehicle.id, entry.kind, entry.daysRemaining]),
    [["b", "inspection", -6], ["b", "registration", 2], ["a", "registration", 5]],
  );
});

test("local business day and timing copy keys", () => {
  assert.equal(compliance.vehicleComplianceToday(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
  assert.deepEqual(compliance.describeVehicleComplianceTiming(-1), { key: "vehicles.compliance.timing.overdue_one", params: { count: 1 } });
  assert.deepEqual(compliance.describeVehicleComplianceTiming(0), { key: "vehicles.compliance.timing.today", params: {} });
  assert.deepEqual(compliance.describeVehicleComplianceTiming(4), { key: "vehicles.compliance.timing.dueIn_other", params: { count: 4 } });
});
