import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../../src/lib/accounting/display.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
// Other accounting display helpers are unrelated to date formatting.
new Function("require", "module", "exports", compiled)(() => ({}), loaded, loaded.exports);
const { formatAccountingDate } = loaded.exports;

test("accounting date is safe while the current closeout is loading or absent", () => {
  for (const date of ["", " ", undefined, null]) {
    assert.equal(formatAccountingDate(date), "—");
  }
});

test("malformed accounting dates do not crash the workspace", () => {
  for (const date of ["invalid", "2026-13-26", "2026-10-99"]) {
    assert.equal(formatAccountingDate(date), "—");
  }
});

test("accounting dates preserve the server's calendar day", () => {
  assert.equal(formatAccountingDate("2026-10-26"), "Oct 26, 2026");
  assert.equal(formatAccountingDate("2026-10-26T00:00:00Z"), "Oct 26, 2026");
  assert.equal(formatAccountingDate("2026-10-26T23:30:00-04:00"), "Oct 26, 2026");
});
