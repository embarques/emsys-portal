#!/usr/bin/env node
/** Offline B05 declaration comparison. Fetch public snapshots separately; never sends API requests. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { API_REFERENCE_SPEC } from "./lib/api-reference.mjs";

const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function snapshot(document) {
  const format = typeof document.openapi === "string" && document.openapi.startsWith("3.") ? document.openapi : document.swagger === "2.0" ? "2.0" : null;
  const schemas = document.components?.schemas ?? document.definitions;
  if (!format || !document.paths || Array.isArray(document.paths) || typeof document.paths !== "object" ||
    !schemas || Array.isArray(schemas) || typeof schemas !== "object") {
    throw new Error("Expected an OpenAPI 3 or Swagger 2 document with paths and schemas");
  }
  const operations = Object.entries(document.paths).flatMap(([url, item]) =>
    Object.keys(item).filter(method => methods.has(method)).map(method => `${method.toUpperCase()} ${url}`),
  ).sort();
  return {
    format,
    semanticHash: createHash("sha256").update(JSON.stringify(canonical(document))).digest("hex"),
    pathCount: Object.keys(document.paths).length,
    schemaCount: Object.keys(schemas).length,
    operations,
  };
}

function schema(document, name) {
  return (document.components?.schemas ?? document.definitions)?.[name];
}

function property(document, name, field) {
  return schema(document, name)?.properties?.[field];
}

function nullable(value) {
  return value?.nullable === true || value?.["x-nullable"] === true ||
    (Array.isArray(value?.type) && value.type.includes("null")) ||
    value?.anyOf?.some(entry => entry.type === "null") === true;
}

/** Checks declarations only. No test of schema conversion, permissions or persisted behavior. */
export function auditOpenAPIPublication({ local, published, source }) {
  const documents = { local, published, ...(source ? { source } : {}) };
  const snapshots = Object.fromEntries(Object.entries(documents).map(([name, doc]) => [name, snapshot(doc)]));
  const checks = [];
  const check = (id, contract, inspect) => checks.push({ id, contract,
    declared: Object.fromEntries(Object.entries(documents).map(([name, doc]) => [name, Boolean(inspect(doc))])),
  });
  for (const [method, url] of [
    ["get", "/vehicle-routes/business-date"], ["post", "/invoices/reserved/search"],
    ["post", "/change-requests/search"], ["post", "/loans/{id}/increases"],
  ]) check(`operation:${method}:${url}`, `${method.toUpperCase()} ${url}`, doc => doc.paths[url]?.[method]);

  check("barcode-route-nullable", "barcode.Barcode.route explicitly nullable", doc => nullable(property(doc, "barcode.Barcode", "route")));
  check("embedded-single-piece-route-nullable", "core.Barcode.route explicitly nullable (invoice.InvoiceDetail.barcode)", doc => nullable(property(doc, "core.Barcode", "route")));
  check("reconciliation-not-required", "journal.Journal.reconciliationStatus includes NOT_REQUIRED", doc =>
    property(doc, "journal.Journal", "reconciliationStatus")?.enum?.includes("NOT_REQUIRED"));
  check("bulk-array-constraints", "Required 1–200 distinct bulk barcodeIds", doc => {
    const ids = property(doc, "invoice.AssignBarcodesRouteRequest", "barcodeIds");
    return schema(doc, "invoice.AssignBarcodesRouteRequest")?.required?.includes("barcodeIds") &&
      ids?.type === "array" && ids.minItems === 1 && ids.maxItems === 200 && ids.uniqueItems === true;
  });
  check("bulk-positive-uint32-bounds", "Bulk barcodeIds item schema declares positive uint32 bounds", doc => {
    const item = property(doc, "invoice.AssignBarcodesRouteRequest", "barcodeIds")?.items;
    return item?.type === "integer" && item.minimum === 1 && item.maximum === 4294967295;
  });
  check("loan-increase-uuid", "Required UUID loan.IncreaseRequest.requestId", doc =>
    schema(doc, "loan.IncreaseRequest")?.required?.includes("requestId") &&
    property(doc, "loan.IncreaseRequest", "requestId")?.format === "uuid");
  check("reservation-received-at-nullable", "invoice.ReservedInvoice.receivedAt explicitly nullable", doc =>
    nullable(property(doc, "invoice.ReservedInvoice", "receivedAt")));

  const difference = (left, right) => left.filter(operation => !right.includes(operation));
  return {
    checkedAt: new Date().toISOString(),
    evidenceKind: "schema-declarations-only",
    localMatchesPublished: snapshots.local.semanticHash === snapshots.published.semanticHash,
    snapshots: Object.fromEntries(Object.entries(snapshots).map(([name, value]) => {
      const { operations, ...metadata } = value;
      return [name, { ...metadata, operationCount: operations.length }];
    })),
    sourceOnlyOperations: source ? difference(snapshots.source.operations, snapshots.published.operations) : null,
    publishedOnlyOperations: source ? difference(snapshots.published.operations, snapshots.source.operations) : null,
    checks,
    missingPublishedDeclarations: checks.filter(entry => !entry.declared.published).map(entry => entry.id),
    missingSourceDeclarations: source ? checks.filter(entry => !entry.declared.source).map(entry => entry.id) : null,
    descriptionsForReview: Object.fromEntries(Object.entries(documents).map(([name, doc]) => [name, {
      clearance: doc.paths["/journals/clear"]?.post?.description ?? null,
      reconciliation: doc.paths["/journals/reconcile"]?.post?.description ?? null,
    }])),
    limitations: [
      "Declaration presence is not schema validation, conversion parity, deployed route behavior or persisted business acceptance.",
      "Nullable and bound checks inspect these named schema properties; no external references are fetched.",
      "Descriptions require human review; the declaration checks do not certify all B05/B09 contracts.",
      "No API, tenant, authentication, permission, database, migration or load tests are executed.",
    ],
  };
}

function main() {
  const args = {};
  const allowed = new Set(["--local", "--published", "--published-url", "--source", "--source-revision", "--output"]);
  for (let index = 2; index < process.argv.length; index += 2) {
    const name = process.argv[index];
    const value = process.argv[index + 1];
    if (!allowed.has(name) || !value || value.startsWith("--")) throw new Error(`Invalid argument ${name}`);
    args[name] = value;
  }
  if (!args["--published"]) {
    throw new Error(`Use --published <saved-public-openapi.json> --source ${API_REFERENCE_SPEC}; optionally --local, --source-revision and --output`);
  }
  const read = filename => JSON.parse(fs.readFileSync(filename, "utf8"));
  // The portal keeps no API snapshot; without --local the published document is compared with itself.
  const localFile = args["--local"] ?? args["--published"];
  const sourceFile = args["--source"] ?? null;
  const report = auditOpenAPIPublication({ local: read(localFile), published: read(args["--published"]),
    ...(sourceFile ? { source: read(sourceFile) } : {}),
  });
  report.inputs = { localFile, publishedFile: args["--published"], sourceFile,
    sourceRevision: args["--source-revision"] ?? null, publishedUrl: args["--published-url"] ?? null };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (args["--output"]) fs.writeFileSync(args["--output"], serialized);
  else process.stdout.write(serialized);
  if (!report.localMatchesPublished || report.missingPublishedDeclarations.length || report.missingSourceDeclarations?.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
