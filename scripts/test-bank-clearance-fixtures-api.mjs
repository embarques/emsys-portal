#!/usr/bin/env node
/** Opt-in, isolated branch/identity/bank tests. Posted journals are reversed, never deleted.
 * Does not use an existing closeout or alter an existing user's grants.
 * Run with EMSYS_TOKEN and --write-fixtures in an explicitly approved company.
 */
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs";
import {createPortalLoader, createHttpApiClient} from "./lib/portal-modules.mjs";
import {verifyInvoiceBoundaries} from "./lib/invoice-boundary-fixtures.mjs";
import {verifySection3Matrix} from "./lib/section3-matrix-fixtures.mjs";
import {verifyLoanLifecycle} from "./lib/loan-lifecycle-fixtures.mjs";
import { createApiSuite } from "./lib/api-suite.mjs";
const suite = createApiSuite({title: "Isolated bank clearance contract", options: {writeFixtures: {flag: "--write-fixtures"}, output: {flag: "--output", takesValue: true}, extended: {flag: "--extended"}, receiptOnly: {flag: "--receipt-only"}, invoiceBoundaries: {flag: "--invoice-boundaries"}, matrix: {flag: "--matrix"}, reports: {flag: "--reports"}, loanLifecycle: {flag: "--loan-lifecycle"}, branchCode: {flag: "--branch-code", takesValue: true}, lifecycleOnly: {flag: "--lifecycle-only"}}});
const {ok, pass, fail, note, rowsOf} = suite;
const marker = `CODEX-BANK-${randomUUID()}`;
const cleanup = [];
const journals = [];
const evidence = [];
let firebaseUser, firebaseApp, deleteFirebaseUser, deleteFirebaseApp, actorToken;
let retainedBranch, closeout;
const adminToken = suite.opts.token;
async function request(method, path, body, token = adminToken, headers = {}) {
  const response = await fetch(suite.opts.baseUrl + path, {method, headers: {
    Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "")}`, "x-company-id": suite.opts.companyId,
    "content-type": "application/json", ...headers,
  }, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(30_000)});
  return {status: response.status, json: await response.json()};
}
function verify(label, condition, response) {
  evidence.push({label, passed: Boolean(condition), ...(response ? {http: response.status, message: response.json?.message, error: response.json?.error} : {})});
  if (condition) pass(label, response ? `HTTP ${response.status}` : "");
  else fail(label, response?.status ?? 0, response?.json?.message ?? "Invariant failed");
  return condition;
}
function requireOk(label, response) {
  if (!verify(label, ok(response), response)) throw new Error(label);
  return response.json.data;
}
async function create(path, body, token = adminToken) {
  const r = await request("POST", path, body, token);
  if (r.json?.data?.id != null && !["/income-statements", "/journals"].includes(path)) cleanup.push(`${path}/${r.json.data.id}`);
  return requireOk(`Create fixture ${path}`, r);
}
try {
  if (!suite.opts.writeFixtures || suite.opts.skipCrud) {note("No writes; use --write-fixtures only with explicit company authorization.");}
  else {
    if (suite.opts.receiptOnly && !suite.opts.extended) throw new Error("--receipt-only requires --extended");
    try { process.loadEnvFile(".env"); } catch { /* Env may already be configured. */ }
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) throw new Error("Firebase configuration required before any writes");
    const branches = requireOk("Read branch configuration", await request("GET", "/branches?page=1&limit=20"));
    const sample = branches.find(b => b.code === (suite.opts.branchCode || "NY")) ?? (!suite.opts.branchCode ? branches[0] : undefined);
    if (!sample) throw new Error("Requested fixture branch code is not in the bounded branch catalog");
    const catalog = rowsOf(await request("GET", "/permissions?page=1&limit=500"));
    const names = ["canCreateJournal", "canViewJournal", "canListJournal", "canClearJournal", "canCreateIncomeStatement", "canViewIncomeStatement", "canCreateFinancialAdjustment", "canUpdateFinancialActivity", ...(suite.opts.extended ? ["canCreateInvoice", "canViewInvoice", "canUpdateJournal", "canDisableAutomaticInvoiceNumber"] : [])];
    const grants = suite.opts.invoiceBoundaries || suite.opts.matrix || suite.opts.loanLifecycle ? catalog : names.map(name => catalog.find(p => p.name === name));
    if (grants.some(p => !p)) throw new Error("Required explicit fixture grants are missing");
    const branchCreated = await create("/branches", {name: marker, code: suite.opts.receiptOnly || suite.opts.invoiceBoundaries ? sample.code : `ZB${randomBytes(3).toString("hex")}`, type: sample.type, address: sample.address});
    const branch = requireOk("Read complete fixture branch", await request("GET", `/branches/${branchCreated.id}`));
    retainedBranch = branch;
    const role = await create("/roles", {name: marker, active: true, permissions: grants});
    const {initializeApp, deleteApp} = await import("firebase/app");
    const {getAuth, createUserWithEmailAndPassword, deleteUser} = await import("firebase/auth");
    deleteFirebaseUser = deleteUser; deleteFirebaseApp = deleteApp;
    firebaseApp = initializeApp({apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}, marker);
    firebaseUser = (await createUserWithEmailAndPassword(getAuth(firebaseApp), `${marker.toLowerCase()}@example.invalid`, randomBytes(32).toString("base64url"))).user;
    const user = await create("/users", {uid: firebaseUser.uid, email: firebaseUser.email, name: marker, active: true, branch, role: {id: role.id, name: role.name}});
    const employee = await create("/employees", {name: marker, active: true, branch, user: {id: user.id, name: user.name}});
    actorToken = await firebaseUser.getIdToken();
    const effective = requireOk("Read fixture grants", await request("GET", "/users/permissions", undefined, actorToken));
    if (!suite.opts.invoiceBoundaries && !suite.opts.matrix && !suite.opts.loanLifecycle && effective.permissions.some(p => p.name === "canReconcileJournal")) throw new Error("Fixture unexpectedly has reconciliation permission");
    const account = await create("/chart-accounts", {name: marker, displayName: marker, type: "BANK", branch, parentAccount: {id: 4000000004, name: "BANK"}});
    const bank = {id: account.id, name: account.name, type: "BANK"};
    const before = requireOk("Read new branch current closeout", await request("GET", `/income-statements/current?branchId=${branch.id}`, undefined, actorToken));
    if (before?.id) throw new Error("New branch already has a closeout; refusing to reuse it");
    closeout = await create("/income-statements", {currency: "USD", rate: 1}, actorToken);
    verify("Closeout belongs exclusively to fixture branch", closeout.branch?.id === branch.id);
    if (closeout.branch?.id !== branch.id) throw new Error("Unexpected closeout branch");
    const methods = rowsOf(await request("GET", "/accounting/paymentmethods"));
    const paymentMethod = methods.find(m => m.name === "ZELLE");
    if (!paymentMethod) throw new Error("ZELLE missing");
    const payload = {transactionType: "SALES", amount: 0.01, branch: {id: branch.id}, currency: "USD", rate: 1,
      description: marker, refNumber: marker, paymentMethod, paymentAccount: bank, account: {id: 6, name: "VENTA DE CAJAS", type: "REVENUE"}};
    async function post(extra) {
      const r = await request("POST", "/journals", {...payload, ...extra}, actorToken);
      if (r.json?.data?.id) journals.push(r.json.data.id);
      return requireOk("Post isolated bank income", r);
    }
    if (suite.opts.invoiceBoundaries) await verifyInvoiceBoundaries({request: (method, path, body, headers) => request(method, path, body, actorToken, headers), branch, closeout, marker, create: (path, body) => create(path, body, actorToken), verify, evidence, note, lifecycleOnly: suite.opts.lifecycleOnly, uploadDocument: async invoiceId => {
      const form = new FormData();
      form.append("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=", "base64")], {type: "image/png"}), `${marker}.png`);
      form.append("uploadId", randomUUID());
      const r = await fetch(`${suite.opts.baseUrl}/invoices/${invoiceId}/documents`, {method: "POST", headers: {Authorization: `Bearer ${actorToken}`, "x-company-id": suite.opts.companyId}, body: form, signal: AbortSignal.timeout(60_000)});
      return {status: r.status, json: await r.json()};
    }});
    if (suite.opts.matrix) await verifySection3Matrix({request: (method, path, body, headers) => request(method, path, body, actorToken, headers), branch, closeout, marker, payload, bank, methods, journals, verify, evidence, note, create: (path, body) => create(path, body, actorToken), generateReports: suite.opts.reports});
    if (suite.opts.loanLifecycle) await verifyLoanLifecycle({request: (method, path, body, headers) => request(method, path, body, actorToken, headers), branch, closeout, employee, marker, verify, evidence, note});
    if (!suite.opts.receiptOnly && !suite.opts.invoiceBoundaries && !suite.opts.matrix && !suite.opts.loanLifecycle) {
    const pending = await post({autoClear: false});
    verify("Bank creation leaves clearance and reconciliation outstanding", pending.clearanceStatus === "OUTSTANDING" && pending.reconciliationStatus === "OUTSTANDING");
    const rejectedDelete = await request("DELETE", `/journals/${pending.id}`);
    verify("Posted journal rejects DELETE", rejectedDelete.status >= 400, rejectedDelete);
    const command = {requestId: randomUUID(), ids: [pending.id]};
    const clear = await request("POST", "/journals/clear", command, actorToken);
    requireOk("Clear with canClearJournal and without canReconcileJournal", clear);
    const cleared = requireOk("Read cleared fixture", await request("GET", `/journals/${pending.id}`, undefined, actorToken));
    note(`Manual clearance readback: clearance=${cleared.clearanceStatus}, reconciliation=${cleared.reconciliationStatus}`);
    verify("Manual bank clearance atomically reconciles", cleared.clearanceStatus === "CLEARED" && cleared.reconciliationStatus === "RECONCILED");
    const replay = await request("POST", "/journals/clear", command, actorToken);
    verify("Clearance request replay succeeds", ok(replay), replay);
    const independent = await post({autoClear: false, refNumber: `${marker}-STANDALONE`});
    const standalone = await request("POST", "/journals/reconcile", {requestId: randomUUID(), ids: [independent.id]});
    verify("Standalone reconciliation rejects unsettled bank transaction", standalone.status === 409, standalone);
    const autoResponse = await request("POST", "/journals", {...payload, autoClear: true, refNumber: `${marker}-AUTO`}, actorToken);
    if (autoResponse.json?.data?.id) journals.push(autoResponse.json.data.id);
    verify("Bank autoClear needs only canClearJournal and atomically reconciles", ok(autoResponse) && autoResponse.json?.data?.clearanceStatus === "CLEARED" && autoResponse.json?.data?.reconciliationStatus === "RECONCILED", autoResponse);
    if (suite.opts.extended) {
      const load = createPortalLoader({apiClient: createHttpApiClient((method, path, body, headers) => request(method, path, body, actorToken, headers))});
      const portal = load("src/lib/accounting/daily-income/reconciliation-api.ts");
      const extra = await post({autoClear: false, refNumber: `${marker}-PORTAL`});
      const result = await portal.clearJournals({requestId: randomUUID(), ids: [extra.id]});
      verify("Real portal clearance adapter acknowledges created journal", result.data.cleared.includes(extra.id));
      const row = requireOk("Read portal-cleared journal", await request("GET", `/journals/${extra.id}`, undefined, actorToken));
      verify("Real portal clearance request settles both statuses", row.clearanceStatus === "CLEARED" && row.reconciliationStatus === "RECONCILED");
      const invalid = await request("POST", "/journals", {...payload, amount: -1}, actorToken);
      verify("Negative journal rejected", invalid.status >= 400 && invalid.status < 500, invalid);
      await post({refNumber: `${marker}-CORRECTED`, autoClear: false});
      const absentAccount = await request("GET", "/chart-accounts/2147483646");
      const otherAccounts = rowsOf(await request("GET", "/chart-accounts?page=1&limit=100"));
      const otherBank = otherAccounts.find(a => a.type === "BANK" && a.branch?.id && a.branch.id !== branch.id);
      if (absentAccount.status !== 404 || !otherBank) throw new Error("Account negative controls not established");
      evidence.push({label: "Bank negative controls", absentHttp: absentAccount.status, otherBank});
      for (const [label, account] of [["nonexistent", {...bank, id: 2147483646}], ["wrong-branch", {id: otherBank.id, name: otherBank.name, type: otherBank.type}]]) {
        const rejected = await request("POST", "/journals", {...payload, refNumber: `${marker}-${label}`, paymentAccount: account}, actorToken);
        if (rejected.json?.data?.id) journals.push(rejected.json.data.id);
        verify(`Bank account ${label} rejected`, rejected.status >= 400 && rejected.status < 500, rejected);
      }
      const syncId = randomUUID();
      const syncBody = {requestId: syncId, entry: {...payload, refNumber: `${marker}-SYNC`, autoClear: false}};
      const first = await request("POST", "/journals/sync", syncBody, actorToken);
      const firstId = first.json?.data?.id;
      if (firstId) journals.push(firstId);
      const second = await request("POST", "/journals/sync", syncBody, actorToken);
      verify("Sync replay returns same journal", ok(first) && ok(second) && Boolean(firstId) && firstId === second.json?.data?.id, second);
      const waiting = await post({refNumber: `${marker}-GRANTS`, autoClear: false});
      requireOk("Remove clearance grant from fixture role", await request("PUT", `/roles/${role.id}`, {name: marker, active: true, permissions: grants.filter(p => p.name !== "canClearJournal")}));
      const denied = await request("POST", "/journals/clear", {requestId: randomUUID(), ids: [waiting.id]}, actorToken);
      verify("Same token immediately enforces revoked clearance grant", denied.status === 403, denied);
      requireOk("Restore clearance grant on fixture role", await request("PUT", `/roles/${role.id}`, {name: marker, active: true, permissions: grants}));
      requireOk("Same token accepts restored clearance grant", await request("POST", "/journals/clear", {requestId: randomUUID(), ids: [waiting.id]}, actorToken));
    }
    }
    if (suite.opts.extended && !suite.opts.matrix) {
      const syncCommand = {requestId: randomUUID(), entry: {...payload, autoClear: true, refNumber: `${marker}-SYNC-CLEAR`}};
      const synced = await request("POST", "/journals/sync", syncCommand, actorToken);
      if (synced.json?.data?.id) journals.push(synced.json.data.id);
      verify("Sync preserves bank auto-clear contract", ok(synced) && synced.json?.data?.clearanceStatus === "CLEARED" && synced.json?.data?.reconciliationStatus === "RECONCILED", synced);
      const syncReplay = await request("POST", "/journals/sync", syncCommand, actorToken);
      verify("Automatic sync replay returns identical journal", ok(syncReplay) && Boolean(synced.json?.data?.id) && syncReplay.json?.data?.id === synced.json.data.id, syncReplay);
      let registrationResponse;
      const registrationLoader = createPortalLoader({apiClient: createHttpApiClient(async (method, path, body, headers) => {
        const response = await request(method, path, body, actorToken, headers);
        registrationResponse = response;
        return response;
      })});
      try {
        await registrationLoader("src/lib/accounting/daily-income/api.ts").createDailyIncomeJournal({...closeout, branch, currency: "USD", rate: 1}, {transactionType: "INITIAL-PAYMENT", invoiceNumber: marker, invoiceCost: 100, invoiceDiscount: 0, amount: 0, paymentMethodName: "CASH", description: marker, refNumberMode: "system"});
      } catch { /* Record the explicit API prerequisite response below. */ }
      evidence.push({label: "Portal zero-payment registration", http: registrationResponse?.status, data: registrationResponse?.json});
      const registered = registrationResponse?.json?.data;
      if (registered?.id) note(`Retained zero-payment registration ${registered.id}; dedicated invoice lifecycle required`);
      const invoiceResponse = registrationResponse ? {...registrationResponse, json: {...registrationResponse.json, data: registered?.invoice}} : {status: 0, json: {message: "Registration adapter did not reach API"}};
      if (ok(invoiceResponse) && invoiceResponse.json?.data?.id) {
        const invoiceId = invoiceResponse.json.data.id;
        note(`Retained invoice financial fixture ${invoiceId}`);
        const discount = await request("POST", "/journals", {...payload, transactionType: "DISCOUNT", invoiceId, account: undefined, paymentAccount: undefined, paymentMethod: {name: "CASH"}, amount: 20, refNumber: `${marker}-DISCOUNT`}, actorToken);
        const discountId = discount.json?.data?.id;
        if (discountId) journals.push(discountId);
        verify("Create contra-revenue discount", ok(discount), discount);
        const discounted = Boolean(discountId);
        if (discounted) {
          evidence.push({label: "Discount ledger", accounts: discount.json.data.accounts});
          verify("Discount debits contra-revenue and credits receivables", discount.json.data.accounts?.some(a => a.name === "SALES DISCOUNTS" && a.debit === 20) && discount.json.data.accounts?.some(a => a.name === "ACCOUNTS RECEIVABLE" && a.credit === 20));
        }
        const countLoader = createPortalLoader({apiClient: createHttpApiClient((method, path, body, headers) => request(method, path, body, actorToken, headers))});
        const counts = countLoader("src/lib/accounting/daily-income/reconciliation-api.ts");
        const beforePendingCount = await counts.fetchOutstandingJournalCount();
        const payment = await request("POST", "/journals", {...payload, transactionType: "PAYMENT", invoiceId, account: undefined, amount: 80, refNumber: `${marker}-PAYMENT`, autoClear: false}, actorToken);
        const paymentId = payment.json?.data?.id;
        if (paymentId) journals.push(paymentId);
        requireOk("Create deferred invoice payment", payment);
        const outstandingCount = await counts.fetchOutstandingJournalCount();
        evidence.push({label: "Portal pending badge count after PAYMENT", before: beforePendingCount, after: outstandingCount});
        verify("Real portal pending-count adapter includes the new PAYMENT", outstandingCount === beforePendingCount + 1);
        const pendingDetail = requireOk("Read outstanding PAYMENT", await request("GET", `/journals/${paymentId}`, undefined, actorToken));
        evidence.push({label: "Outstanding PAYMENT detail", data: pendingDetail});
        for (const value of ["OUTSTANDING", "RECONCILED", "NOT_REQUIRED"]) {
          const state = await request("POST", "/journals/search", {operator: "and", filters: [{field: "id", operator: "eq", value: paymentId}, {field: "reconciliationStatus", operator: "eq", value}], pagination: {page: 1, limit: 1}}, actorToken);
          verify(`Outstanding PAYMENT ${value} filter agrees with detail`, ok(state) && Number(state.json.total) === (value === "OUTSTANDING" ? 1 : 0), state);
        }
        const alternative = await create("/chart-accounts", {name: `${marker}-CORRECTION`, displayName: `${marker}-CORRECTION`, type: "BANK", branch, parentAccount: {id: 4000000004, name: "BANK"}});
        const correction = await request("PUT", `/journals/${paymentId}`, {...payload, transactionType: "PAYMENT", invoiceId, account: undefined, id: paymentId, expectedVersion: pendingDetail.version, amount: 80, paymentAccount: {id: alternative.id, name: alternative.name, type: "BANK"}, paymentMethod: methods.find(m => m.name === "CHECK") ?? paymentMethod, paymentReference: `${marker}-CHECK`, refNumber: `${marker}-PAYMENT-CORRECTED`}, actorToken);
        verify("Pending receipt method/account correction succeeds", ok(correction), correction);
        const corrected = requireOk("Read corrected pending receipt", await request("GET", `/journals/${paymentId}`, undefined, actorToken));
        evidence.push({label: "Corrected pending PAYMENT detail", data: corrected});
        verify("Corrected pending receipt retains selected bank", corrected.paymentAccount?.id === alternative.id);
        const before = requireOk("Read invoice before clearance", await request("GET", `/invoices/${invoiceId}`, undefined, actorToken));
        evidence.push({label: "Invoice before clearance", data: before});
        verify("Uncleared bank payment leaves invoice balance unchanged", before.balance === (discounted ? 80 : 100) && Number(before.payment ?? 0) === 0);
        const command = {requestId: randomUUID(), ids: [paymentId]};
        requireOk("Clear deferred invoice payment", await request("POST", "/journals/clear", command, actorToken));
        const clearedCount = await counts.fetchOutstandingJournalCount();
        evidence.push({label: "Portal pending badge count after clearance", before: outstandingCount, after: clearedCount});
        verify("Real portal pending-count adapter excludes the cleared PAYMENT", clearedCount === beforePendingCount);
        const after = requireOk("Read settled invoice", await request("GET", `/invoices/${invoiceId}`, undefined, actorToken));
        evidence.push({label: "Invoice after clearance", data: after});
        verify("Clearance applies invoice payment once", Number(after.balance ?? 0) === (discounted ? 0 : 20) && after.payment === 80);
        requireOk("Replay invoice clearance", await request("POST", "/journals/clear", command, actorToken));
        const replayed = requireOk("Read replayed invoice", await request("GET", `/invoices/${invoiceId}`, undefined, actorToken));
        verify("Replayed clearance does not apply payment twice", Number(replayed.balance ?? 0) === (discounted ? 0 : 20) && replayed.payment === 80);
        const duplicate = await request("POST", "/journals/clear", {requestId: randomUUID(), ids: [paymentId, paymentId]}, actorToken);
        verify("Duplicate clearance IDs rejected", duplicate.status === 400, duplicate);
        if (discountId) {
          const noGrant = await request("POST", "/journals/reconcile", {requestId: randomUUID(), ids: [discountId]}, actorToken);
          verify("Reconciliation denied before explicit grant", noGrant.status === 403, noGrant);
          const reconciliationGrant = catalog.find(p => p.name === "canReconcileJournal");
          if (!reconciliationGrant) throw new Error("Reconciliation grant missing from catalog");
          requireOk("Add reconciliation grant to fixture role", await request("PUT", `/roles/${role.id}`, {name: marker, active: true, permissions: [...grants, reconciliationGrant]}));
          requireOk("Same token reconciles after grant addition", await request("POST", "/journals/reconcile", {requestId: randomUUID(), ids: [discountId]}, actorToken));
          requireOk("Remove reconciliation grant from fixture role", await request("PUT", `/roles/${role.id}`, {name: marker, active: true, permissions: grants}));
          const revoked = await request("POST", "/journals/reconcile", {requestId: randomUUID(), ids: [discountId]}, actorToken);
          verify("Same token enforces reconciliation grant removal", revoked.status === 403, revoked);
        }
        const summary = await request("POST", "/journals/summary", {ids: [paymentId, ...(discountId ? [discountId] : [])]}, actorToken);
        evidence.push({label: "Discount and bank collection summary", http: summary.status, data: summary.json?.data});
        verify("Discount and collected bank receipt report net income without expenses", ok(summary) && summary.json.data?.some(row => row.currency === "USD" && row.income === 80 && row.expenses === 0 && row.net === 80), summary);
        for (const value of ["OUTSTANDING", "RECONCILED", "NOT_REQUIRED"]) {
          const status = await request("POST", "/journals/search", {operator: "and", filters: [{field: "id", operator: "eq", value: paymentId}, {field: "reconciliationStatus", operator: "eq", value}], pagination: {page: 1, limit: 1}}, actorToken);
          verify(`New PAYMENT ${value} filter agrees with settled detail`, ok(status) && Number(status.json.total) === (value === "RECONCILED" ? 1 : 0), status);
        }
        requireOk("Reverse fixture payment before automatic settlement control", await request("POST", `/journals/${paymentId}/reverse`, {requestId: randomUUID(), reason: `${marker} cleanup`}, actorToken));
        const auto = await request("POST", "/journals", {...payload, transactionType: "PAYMENT", invoiceId, account: undefined, amount: 80, refNumber: `${marker}-PAYMENT-AUTO`, autoClear: true}, actorToken);
        if (auto.json?.data?.id) journals.push(auto.json.data.id);
        verify("Automatic invoice settlement clears and reconciles", ok(auto) && auto.json.data.clearanceStatus === "CLEARED" && auto.json.data.reconciliationStatus === "RECONCILED", auto);
        const autoInvoice = requireOk("Read automatically settled invoice", await request("GET", `/invoices/${invoiceId}`, undefined, actorToken));
        evidence.push({label: "Invoice after automatic clearance", data: autoInvoice});
        verify("Automatic clearance applies invoice receipt once", Number(autoInvoice.balance ?? 0) === (discounted ? 0 : 20) && autoInvoice.payment === 80);
      } else verify("Create isolated invoice prerequisite", false, invoiceResponse);
    }
  }
} catch (error) { fail("Isolated accounting fixture suite", 0, error.message); }
finally {
  // Financial evidence remains immutable. Only fixture journals are reversed.
  for (const id of journals.reverse()) {
    try {
      if (!actorToken) throw new Error("No fixture-branch token available; reversal requires manual attention");
      const actor = requireOk("Confirm cleanup actor branch", await request("GET", "/users/current", undefined, actorToken));
      if (actor.branch?.id !== retainedBranch?.id) throw new Error("Cleanup actor branch mismatch; refusing reversal");
      const r = await request("POST", `/journals/${id}/reverse`, {requestId: randomUUID(), reason: `${marker} cleanup`}, actorToken);
      verify(`Reverse fixture ${id}`, ok(r), r);
      if (ok(r)) {
        evidence.push({label: `Reversal response ${id}`, data: r.json.data});
        const adjustment = r.json?.data?.adjustment ?? r.json?.data?.journal ?? r.json?.data;
        const adjustmentId = adjustment?.id ?? r.json?.data?.reversalId ?? r.json?.data?.adjustmentId;
        if (adjustmentId) {
          const saved = requireOk("Read saved reversal", await request("GET", `/journals/${adjustmentId}`));
          verify(`Reversal stays in fixture branch ${retainedBranch.id}`, saved.branch?.id === retainedBranch.id && saved.incomeStatement?.id === closeout.id);
        } else note(`Reversal ${id} branch readback unresolved; inspect recorded response shape`);
      }
      const row = await request("GET", `/journals/${id}`);
      verify(`Reversed original ${id} leaves both pending queues`, row.json?.data?.clearanceStatus === "NOT_REQUIRED" && row.json?.data?.reconciliationStatus === "NOT_REQUIRED", row);
    } catch(error) {fail(`Reversal cleanup requires attention ${id}`, 0, error.message);}
  }
  for (const path of cleanup.reverse()) {
    // A branch/account with immutable posted history must stay for audit attribution.
    if ((closeout && path.startsWith("/branches/")) || (journals.length && path.startsWith("/chart-accounts/"))) {note(`Retained for financial audit history: ${path}`); continue;}
    try {
      const r = await request("DELETE", path);
      verify(`Cleanup ${path}`, ok(r) && (await request("GET", path)).status === 404, r);
    } catch(error) {fail(`Cleanup requires attention ${path}`, 0, error.message);}
  }
  if (firebaseUser) {try {await deleteFirebaseUser(firebaseUser); pass("Delete temporary Firebase identity");} catch(error) {fail("Firebase cleanup", 0, error.code);}}
  if (firebaseApp) await deleteFirebaseApp(firebaseApp);
  note(`Fixture marker ${marker}; retained closeout=${closeout?.id ?? "none"}, branch=${closeout ? retainedBranch?.id : "none"}; reversal execution is restricted to the fixture branch.`);
}
if (suite.opts.output) fs.writeFileSync(suite.opts.output, JSON.stringify({checkedAt: new Date().toISOString(), marker, branchId: retainedBranch?.id, closeoutId: closeout?.id, journals, evidence}, null, 2));
suite.finish("Isolated fixture checks complete; review retained financial audit records.");
