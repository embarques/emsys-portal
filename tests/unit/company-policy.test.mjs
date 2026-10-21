import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const api = {};
new Function("exports", "require", ts.transpileModule(readFileSync("src/lib/company/policy-schema.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(api, require);
const schema = api.createCompanyPolicySchema("Invalid URL");
test("policy URL permits clearing and trims public HTTPS URLs", () => {
  assert.deepEqual(schema.parse({ policyUrl: "" }), { policyUrl: "" });
  assert.equal(schema.parse({ policyUrl: " https://example.test/policies " }).policyUrl, "https://example.test/policies");
});
test("policy URL rejects unsafe schemes, credentials, whitespace and oversized values", () => {
  for (const policyUrl of ["http://example.test", "javascript:alert(1)", "/policies", "https://u:p@example.test", "https://example.test/a b", "https://example.test/" + "a".repeat(2048)]) {
    assert.equal(schema.safeParse({ policyUrl }).success, false, policyUrl);
  }
});
