import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function load(relative) {
  const cache = new Map();
  function loadFile(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    function localRequire(id) {
      if (id.startsWith("@/") || id.startsWith(".")) {
        const file = id.startsWith("@/")
          ? path.join(root, "src", id.slice(2))
          : path.resolve(path.dirname(filename), id);
        if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
        return loadFile(fs.existsSync(`${file}.ts`) ? `${file}.ts` : path.join(file, "index.ts"));
      }
      return require(id);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return loadFile(path.join(root, relative));
}

test("loan funding options are cash and bank only; receivable stays on the loan side", () => {
  const { listLoanFundingAccounts, listLoanReceivableAccounts, isLoanReceivableLikeAccount } = load(
    "src/lib/accounting/loans/loan-accounts.ts",
  );
  const cash = { id: 1, name: "CASH ON HAND", displayName: "Cash on hand", type: "ASSET", systemAccount: true };
  const drawer = { id: 2, name: "DRAWER A", displayName: "Drawer A", type: "ASSET", parentAccount: { id: 1 } };
  const ar = { id: 3, name: "ACCOUNTS RECEIVABLE", displayName: "Accounts receivable", type: "ASSET", systemAccount: true };
  const loan = { id: 4, name: "EMPLOYEE LOANS", displayName: "Employee loans", type: "LOAN" };
  const bank = { id: 5, name: "CHASE", displayName: "Chase", type: "BANK" };
  const generalBank = { id: 6, name: "BANK", displayName: "Bank", type: "BANK", systemAccount: true };
  const accounts = [cash, drawer, ar, loan, bank, generalBank];

  assert.equal(isLoanReceivableLikeAccount(ar), true);
  assert.equal(isLoanReceivableLikeAccount(loan), true);
  assert.deepEqual(
    listLoanReceivableAccounts(accounts).map((account) => account.id),
    [4],
  );
  assert.deepEqual(
    listLoanFundingAccounts(accounts).map((account) => account.id).sort((a, b) => a - b),
    [1, 2, 5],
  );
  assert.ok(!listLoanFundingAccounts(accounts).some((account) => account.id === ar.id));
});
