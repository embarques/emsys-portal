#!/usr/bin/env node
/** Active NY/RD branch acceptance. Never deletes existing records or changes branch configuration. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";
import { createPortalLoader, createHttpApiClient } from "./lib/portal-modules.mjs";

const suite = createApiSuite({ title: "Active branch gap controls", options: {
  writeFixtures: { flag: "--write-fixtures" }, allowRollover: { flag: "--allow-rollover" },
  output: { flag: "--output", takesValue: true },
} });
const marker = `CODEX-ACTIVE-NY-${randomUUID()}`;
const evidence = [], owned = [];
let loan, employee, increaseValues, increaseKey, closeout, issueTransactionId, originalIncrease;
async function request(method, path, body, headers) {
  // No directory update/delete, period close/reopen, seed or config commands in this runner.
  if (["PUT", "PATCH", "DELETE"].includes(method)) throw Error("Active-branch runner has no directory update/delete path");
  const response = await suite.request(method, path, body, headers);
  evidence.push({ method, path, ...(body ? { body } : {}), http: response.status, response: response.json });
  if (method === "POST" && path === "/loans" && suite.ok(response)) issueTransactionId = String(response.json.data?.transaction?.id);
  if (method === "POST" && /\/increases$/.test(path) && suite.ok(response)) {
    originalIncrease ??= { transactionId: String(response.json.data?.transaction?.id), journalId: String(response.json.data?.journal?.id) };
  }
  if (response.status === 401) throw Error("Token rejected; no further writes");
  return response;
}
function check(label, condition, detail) {
  evidence.push({ label, passed: Boolean(condition), ...(detail ? { detail } : {}) });
  if (condition) suite.pass(label); else suite.fail(label, 0, detail || "Persisted invariant failed");
}
async function read(path) {
  const r = await request("GET", path);
  if (!suite.ok(r)) throw Error(`${path}: HTTP ${r.status}`);
  return r.json.data;
}
const load = createPortalLoader({ apiClient: createHttpApiClient(request) });
const api = load("src/lib/accounting/loans/api.ts");
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) throw Error("Explicit --write-fixtures is required");
  const actor = await read("/users/current");
  const branch = await read(`/branches/${actor.branch?.id}`);
  if (branch.code !== "NY") throw Error("This runner requires the supplied actor's existing NY branch");
  const context = await read(`/income-statements/context?branchId=${branch.id}`);
  closeout = context.current;
  // Read-only branch-clock/closed-state evidence does not need a period mutation.
  check("V13 NY server context reports authoritative date/timezone", Boolean(context.today && context.serverTimezone));
  if (!closeout) {
    const r = await request("POST", "/journals", {
      transactionType: "SALES", amount: 0.01, branch: { id: branch.id }, currency: "USD", rate: 1,
      description: marker, refNumber: marker, paymentMethod: { id: 1, name: "CASH" }, account: { id: 6, name: "VENTA DE CAJAS", type: "REVENUE" },
    });
    check("V13 stale NY closeout rejects posting with CLOSEOUT_REQUIRED", r.status === 409 && /CLOSEOUT_REQUIRED/.test(JSON.stringify(r.json)));
    if (suite.ok(r)) {
      if (r.json.data?.id) owned.push({ path: "/journals", id: r.json.data.id, attention: "Unexpected posting despite no current closeout" });
      throw Error("Posting unexpectedly succeeded without a current period; stop before rollover");
    }
    if (!suite.opts.allowRollover) throw Error("NY normal rollover needs approval: current=null; existing stale periods may be closed");
    const opened = await request("POST", "/income-statements", { currency: "USD", rate: 1 });
    if (!suite.ok(opened)) throw Error(`Approved NY opening failed: HTTP ${opened.status}`);
    closeout = opened.json.data;
    owned.push({ path: "/income-statements", id: closeout.id, retained: true });
    evidence.push({ label: "Approved normal NY rollover", closedCloseouts: closeout.closedCloseouts ?? [], closeoutId: closeout.id });
  }
  if (!closeout?.id || closeout.branch?.id !== branch.id) throw Error("Current closeout branch control failed");
  const accounts = await read("/chart-accounts?page=1&limit=100");
  const cash = accounts.find(a => a.name === "CASH ON HAND" && a.type === "ASSET" && !a.nonPosting);
  const loanAccount = accounts.find(a => a.type === "LOAN" && a.branch?.id === branch.id && !a.nonPosting);
  if (!cash || !loanAccount) throw Error("Existing NY loan/cash account prerequisites missing");
  const created = await request("POST", "/employees", { name: marker, active: true, branch: { id: branch.id, name: branch.name, code: branch.code } });
  if (!suite.ok(created) || !created.json.data?.id) throw Error(`New mock employee rejected: HTTP ${created.status}`);
  employee = created.json.data;
  owned.push({ path: "/employees", id: employee.id, retained: true });
  const common = { employeeId: employee.id, employeeName: marker,
    transactionDate: closeout.businessDate ?? context.today, referenceNumber: marker, description: marker };
  loan = await api.createLoan({ ...common, principalAmount: 1, loanAccountId: loanAccount.id,
    loanAccountName: loanAccount.name, loanAccountType: loanAccount.type,
    sourceAccountId: cash.id, sourceAccountName: cash.name, sourceAccountType: cash.type });
  if (!loan?.id) throw Error("Loan creation returned no identity; inspect evidence before retrying");
  owned.push({ path: "/loans", id: loan.id, retained: true });
  check("B12 existing NY account issues mock loan through portal adapter", loan.principalAmount === 1 && loan.balance === 1 && loan.branch?.id === branch.id);
  increaseKey = randomUUID();
  increaseValues = { ...common, referenceNumber: marker + "-INCREASE", loanId: loan.id,
    sourceAccountId: cash.id, sourceAccountName: cash.name, sourceAccountType: cash.type, amount: 0.25 };
  const parallel = await Promise.allSettled([api.increaseLoan(increaseKey, increaseValues), api.increaseLoan(increaseKey, increaseValues)]);
  check("B12 concurrent exact NY increase retries return success", parallel.every(r => r.status === "fulfilled"),
    parallel.filter(r => r.status === "rejected").map(r => r.reason.message).join("; "));
  await api.increaseLoan(increaseKey, increaseValues);
  const saved = await api.fetchLoan(loan.id);
  const tx = await api.fetchLoanTransactions(loan.id);
  check("B12 NY increase principal and balance apply exactly once", saved?.principalAmount === 1.25 && saved.balance === 1.25 && saved.paidAmount === 0);
  // Source uses type LOAN for both principal disbursements; track committed identities.
  check("B12 NY has one issue and one increase with journal links", tx.length === 2 &&
    tx.filter(x => x.id === issueTransactionId).length === 1 &&
    tx.filter(x => x.id === originalIncrease?.transactionId && x.journalEntryId === originalIncrease?.journalId).length === 1 &&
    tx.every(x => x.journalEntryId));
  const changed = await request("POST", `/loans/${loan.id}/increases`, { requestId: increaseKey, ...api.buildLoanIncreasePayload(increaseValues), amount: 0.5 });
  check("B12 NY changed-payload UUID reuse conflicts", changed.status === 409);
  const afterConflict = await api.fetchLoan(loan.id);
  check("B12 NY rejected replay leaves principal/balance unchanged", afterConflict?.principalAmount === saved?.principalAmount && afterConflict?.balance === saved?.balance);
  for (const transaction of tx) {
    const journal = await read(`/journals/${transaction.journalEntryId}`);
    check(`B12 linked ${transaction.type} journal stays in NY/current period`, journal.branch?.id === branch.id && journal.incomeStatement?.id === closeout.id);
  }
} catch (error) {
  evidence.push({ label: "Run stopped", error: error.message });
  suite.fail("Active NY acceptance prerequisites/lifecycle", error.response?.status ?? 0, error.message);
} finally {
  if (loan?.id && employee?.id) {
    try {
      const before = await api.fetchLoan(loan.id);
      if (before?.balance > 0) {
        await api.recordLoanPayment({ employeeId: employee.id, employeeName: marker,
          transactionDate: closeout.businessDate, referenceNumber: marker + "-REPAY", description: marker,
          allocationMode: "specific-loan", loanId: loan.id, receivedAccountId: 1,
          receivedAccountName: "CASH ON HAND", receivedAccountType: "ASSET", amount: before.balance });
      }
      const paid = await api.fetchLoan(loan.id);
      check("B12 new NY mock loan fully repaid; history retained", paid?.balance === 0 && paid.status === "PAID");
      if (increaseKey && increaseValues) {
        const beforeTx = await api.fetchLoanTransactions(loan.id);
        const replay = await request("POST", `/loans/${loan.id}/increases`, { requestId: increaseKey, ...api.buildLoanIncreasePayload(increaseValues) });
        const after = await api.fetchLoan(loan.id);
        const afterTx = await api.fetchLoanTransactions(loan.id);
        check("B12 authorized exact retry after PAID returns original effects/current loan", suite.ok(replay) &&
          String(replay.json.data?.transaction?.id) === originalIncrease?.transactionId &&
          String(replay.json.data?.journal?.id) === originalIncrease?.journalId && replay.json.data?.loan?.status === "PAID" &&
          after?.balance === 0 && after?.status === "PAID" && beforeTx.length === afterTx.length);
      }
    } catch (error) {
      evidence.push({ label: "Mock loan repayment/replay needs attention", error: error.message, loanId: loan.id });
      suite.fail("Mock loan cleanup/replay", error.response?.status ?? 0, error.message);
    }
  }
  if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({ checkedAt: new Date().toISOString(),
    companyId: suite.opts.companyId, marker, owned, evidence,
    limitations: ["No existing records deleted or branch configuration changed.", "Period rollover only when --allow-rollover explicitly authorized.", "Failure injection, other actors, after-period-closure retry and all account combinations remain separate."] }, null, 2) + "\n");
}
suite.finish("Only explicitly evidenced NY variants can be removed from pending scope.");
