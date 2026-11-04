import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(fs.readFileSync("src/lib/navigation/use-nav-alert-count.ts", "utf8"), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;

function fixture() {
  const calls = [];
  const context = {companyId: "company-a", permitted: true};
  const loadedModule = {exports: {}};
  function require(name) {
    if (name.endsWith("use-auth")) return {useAuth: () => ({companyId: context.companyId, hasPermission: () => context.permitted})};
    if (name.endsWith("daily-income/hooks")) return {useAccountingQueryEnabled: () => true};
    if (name.endsWith("reconciliation-api")) return {fetchOutstandingJournalCount: () => {throw new Error("Unexpected request");}};
    if (name.endsWith("query-keys")) return {queryKeys: {accounting: {all: ["accounting"]}}};
    if (name.endsWith("use-workspace-query")) return {useWorkspaceQuery: options => {
      calls.push(options);
      return {data: options.queryKey.at(-1) === "clearance" ? 5 : 3};
    }};
    if (name.endsWith("i18n")) return {useTranslation: () => ({t: key => key})};
    throw new Error(`Unexpected import ${name}`);
  }
  new Function("require", "exports", source)(require, loadedModule.exports);
  return {api: loadedModule.exports, calls, context};
}

test("queue badges use independent tenant-scoped keys and pause queries for unrelated navigation", () => {
  const {api, calls, context} = fixture();
  assert.equal(api.useNavAlertCount("/accounting/pending-financial-activity"), 3);
  assert.equal(api.useNavAlertCount("/accounting/pending-clearance"), 5);
  assert.notDeepEqual(calls[0].queryKey, calls[1].queryKey);
  assert.equal(api.useNavAlertCount("/customers"), 0);
  assert.equal(calls.at(-1).enabled, false);
  context.companyId = "company-b";
  api.useNavAlertCount("/accounting/pending-clearance");
  assert.ok(calls.at(-1).queryKey.includes("company-b"));
  assert.ok(!calls.at(-1).queryKey.includes("company-a"));
  context.permitted = false;
  api.useNavAlertCount("/accounting/pending-clearance");
  assert.equal(calls.at(-1).enabled, false);
});

test("accounting group counts pending tasks from both queues", () => {
  const {api} = fixture();
  assert.equal(api.useNavItemsAlertCount([
    {href: "/accounting/pending-financial-activity"},
    {href: "/accounting/pending-clearance"},
  ]), 8);
  assert.equal(api.useNavAlertLabel("/accounting/pending-clearance", 5), "accounting.journalClearance.pendingAlert");
});
