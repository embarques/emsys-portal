#!/usr/bin/env node
/** Opt-in rejected-delete probes against an exact invoice created by this audit. */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";
const suite = createApiSuite({title: "Invoice delete preconditions", options: {negativeProbes: {flag: "--negative-probes"}, output: {flag: "--output", takesValue: true}}});
const id = "6af5febebdc3aed480bf8152";
const expectedMarker = "CODEX-BANK-c85e2619-848d-4185-b6bc-be6262859783";
const evidence = [];
async function request(method, headers = {}) {
  const response = await fetch(`${suite.opts.baseUrl}/invoices/${id}`, {method, headers: {Authorization: `Bearer ${suite.opts.token.replace(/^Bearer\s+/i, "")}`, "x-company-id": suite.opts.companyId, ...headers}, signal: AbortSignal.timeout(30000)});
  return {status: response.status, json: await response.json()};
}
try {
  const baseline = await request("GET");
  if (baseline.status !== 200 || baseline.json.data?.number !== expectedMarker || !baseline.json.data?.version) throw new Error("Exact owned fixture identity/version not established; no probes sent");
  if (!suite.opts.negativeProbes || suite.opts.skipCrud) suite.note("No negative DELETE requests; add --negative-probes only in the approved mock company.");
  else {
    for (const [label, headers] of [["missing version", {}], ["stale version", {"If-Match": `"v1:${"0".repeat(64)}"`}]]) {
      const result = await request("DELETE", headers);
      const after = await request("GET");
      const rejected = [400, 409, 412, 428].includes(result.status);
      const unchanged = after.status === 200 && after.json.data?.version === baseline.json.data.version;
      evidence.push({label, http: result.status, response: result.json, afterHttp: after.status, versionUnchanged: unchanged});
      if (rejected && unchanged) suite.pass(`${label} is rejected and the invoice remains unchanged`);
      else suite.fail(label, result.status, "Delete guard or saved-state invariant failed");
    }
  }
} catch (error) { suite.fail("Owned invoice prerequisite", 0, error.message); }
if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), invoiceId: id, evidence}, null, 2));
suite.finish("Invoice precondition checks complete.");
