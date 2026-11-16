import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { auditOpenAPIPublication } from "../../scripts/audit-openapi-publication.mjs";

function complete(format = "openapi") {
  const schemas = {
    "barcode.Barcode": { properties: { route: { allOf: [{ $ref: "#/components/schemas/core.RouteReference" }], nullable: true } } },
    "core.Barcode": { properties: { route: { nullable: true } } },
    "journal.Journal": { properties: { reconciliationStatus: { enum: ["NOT_REQUIRED", "OUTSTANDING", "RECONCILED"] } } },
    "invoice.AssignBarcodesRouteRequest": { required: ["barcodeIds"], properties: { barcodeIds: {
      type: "array", minItems: 1, maxItems: 200, uniqueItems: true, items: { type: "integer", minimum: 1, maximum: 4294967295 },
    } } },
    "loan.IncreaseRequest": { required: ["requestId"], properties: { requestId: { type: "string", format: "uuid" } } },
    "invoice.ReservedInvoice": { properties: { receivedAt: { type: "string", nullable: true } } },
  };
  return { ...(format === "swagger" ? { swagger: "2.0", definitions: schemas } : { openapi: "3.0.3", components: { schemas } }),
    paths: { "/vehicle-routes/business-date": { get: {} }, "/invoices/reserved/search": { post: {} },
      "/change-requests/search": { post: {} }, "/loans/{id}/increases": { post: {} } },
  };
}

test("stale published docs can match the portal while newer source declares operations", () => {
  const published = complete();
  delete published.paths["/loans/{id}/increases"];
  const report = auditOpenAPIPublication({ local: structuredClone(published), published, source: complete("swagger") });
  assert.equal(report.localMatchesPublished, true);
  assert.deepEqual(report.sourceOnlyOperations, ["POST /loans/{id}/increases"]);
  assert.ok(report.missingPublishedDeclarations.includes("operation:post:/loans/{id}/increases"));
  assert.deepEqual(report.missingSourceDeclarations, []);
});

test("operation presence, array limits and description do not certify item bounds or embedded nullability", () => {
  const source = complete("swagger");
  delete source.definitions["core.Barcode"].properties.route.nullable;
  delete source.definitions["invoice.AssignBarcodesRouteRequest"].properties.barcodeIds.items.maximum;
  const report = auditOpenAPIPublication({ local: complete(), published: complete(), source });
  assert.deepEqual(report.missingSourceDeclarations, ["embedded-single-piece-route-nullable", "bulk-positive-uint32-bounds"]);
  assert.deepEqual(report.missingPublishedDeclarations, []);
});

test("declaration audit does not mutate snapshots and ignores object-key order for equality", () => {
  const local = complete();
  const original = structuredClone(local);
  const published = { paths: local.paths, components: local.components, openapi: local.openapi };
  const report = auditOpenAPIPublication({ local, published });
  assert.equal(report.localMatchesPublished, true);
  assert.equal(report.sourceOnlyOperations, null);
  assert.deepEqual(local, original);
  published.openapi = "3.0.4";
  assert.equal(auditOpenAPIPublication({ local, published }).localMatchesPublished, false);
});

test("Swagger x-nullable is recognized and required UUID declarations are checked separately", () => {
  const source = complete("swagger");
  for (const name of ["barcode.Barcode", "core.Barcode"]) {
    source.definitions[name].properties.route = { "x-nullable": true };
  }
  source.definitions["loan.IncreaseRequest"].required = [];
  const report = auditOpenAPIPublication({ local: complete(), published: complete(), source });
  assert.deepEqual(report.missingSourceDeclarations, ["loan-increase-uuid"]);
});

test("unsupported input fails explicitly rather than appearing to have no missing operations", () => {
  assert.throws(() => auditOpenAPIPublication({ local: {}, published: complete() }), /Expected an OpenAPI/);
  assert.throws(() => auditOpenAPIPublication({ local: { ...complete(), paths: [] }, published: complete() }), /Expected an OpenAPI/);
});

test("CLI writes reviewable evidence and distinguishes publication gaps from malformed input", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "emsys-openapi-audit-"));
  try {
    const local = path.join(directory, "local.json");
    const published = path.join(directory, "published.json");
    const output = path.join(directory, "report.json");
    const script = fileURLToPath(new URL("../../scripts/audit-openapi-publication.mjs", import.meta.url));
    const args = [script, "--local", local, "--published", published, "--output", output];
    fs.writeFileSync(local, JSON.stringify(complete()));
    fs.writeFileSync(published, JSON.stringify(complete()));
    assert.equal(spawnSync(process.execPath, args).status, 0);
    const stale = complete();
    delete stale.paths["/invoices/reserved/search"];
    fs.writeFileSync(published, JSON.stringify(stale));
    assert.equal(spawnSync(process.execPath, args).status, 1);
    const report = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.ok(report.missingPublishedDeclarations.includes("operation:post:/invoices/reserved/search"));
    assert.equal(report.localMatchesPublished, false);
    fs.writeFileSync(published, "invalid JSON");
    assert.equal(spawnSync(process.execPath, args).status, 2);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
