import {randomUUID} from "node:crypto";
import fs from "node:fs";
import {createPortalLoader, createHttpApiClient} from "./portal-modules.mjs";

/** Invoked only by the opt-in isolated-branch runner; all postings join its reversal cleanup. */
export async function verifySection3Matrix({request, branch, closeout, marker, payload, bank, methods, journals, verify, evidence, note, create, generateReports = false}) {
  const ok = r => r.status >= 200 && r.status < 300 && r.json?.success !== false;
  const denied = r => r.status >= 400 && r.status < 500;
  async function recorded(label, method, path, body) {
    const r = await request(method, path, body);
    evidence.push({label, method, path, http: r.status, response: r.json});
    return r;
  }
  async function read(path) {
    const r = await recorded(`Read ${path}`, "GET", path);
    if (!ok(r)) throw Error(`Read prerequisite ${path}: HTTP ${r.status}`);
    return r.json.data;
  }
  async function post(label, body, sync = false) {
    const r = await recorded(label, "POST", sync ? "/journals/sync" : "/journals", sync ? {requestId: randomUUID(), entry: body} : body);
    if (r.json?.data?.id) journals.push(r.json.data.id);
    return r;
  }
  async function reverse(id) {
    const r = await recorded(`Reverse matrix journal ${id}`, "POST", `/journals/${id}/reverse`, {requestId: randomUUID(), reason: `${marker} matrix cleanup`});
    if (!ok(r)) throw Error(`Matrix reversal failed: ${id}`);
    const saved = await read(`/journals/${id}`);
    verify(`Matrix reversal ${id} leaves both pending queues`, saved.clearanceStatus === "NOT_REQUIRED" && saved.reconciliationStatus === "NOT_REQUIRED");
    const index = journals.indexOf(id);
    if (index >= 0) journals.splice(index, 1);
  }
  const accountsResponse = await recorded("Persisted account catalog", "GET", "/chart-accounts?page=1&limit=100");
  const accounts = accountsResponse.json?.data ?? [];
  if (!ok(accountsResponse) || Number(accountsResponse.json.total) > accounts.length) throw Error("Complete bounded account control unavailable");
  const cashRoot = accounts.find(a => a.name === "CASH ON HAND" && a.type === "ASSET" && !a.nonPosting);
  const otherBank = accounts.find(a => a.type === "BANK" && a.branch?.id && a.branch.id !== branch.id);
  const absent = await recorded("Absent payment-account control", "GET", "/chart-accounts/2147483646");
  if (!cashRoot || !otherBank || absent.status !== 404) throw Error("Cash/bank negative prerequisites unavailable");
  const cash = cashRoot;
  const cashRef = {id: cash.id, name: cash.name, type: "ASSET"};
  const cashMethod = methods.find(m => m.name === "CASH");
  if (!cashMethod) throw Error("CASH method missing");
  const load = createPortalLoader({apiClient: createHttpApiClient(request)});
  const registration = await load("src/lib/accounting/daily-income/api.ts").createDailyIncomeJournalSync(randomUUID(), {...closeout, branch, currency: "USD", rate: 1}, {transactionType: "INITIAL-PAYMENT", invoiceNumber: `${marker}-CASH`, invoiceCost: 100, invoiceDiscount: 0, amount: 0, paymentMethodName: "CASH", description: marker});
  const invoiceId = registration.invoice?.id;
  evidence.push({label: "Retained matrix registration", registrationId: registration.id, invoiceId});
  if (!invoiceId) throw Error("Registration has no invoice ID");
  const discount = await post("Cash scenario discount", {...payload, transactionType: "DISCOUNT", invoiceId, amount: 20, account: undefined, paymentAccount: undefined, paymentMethod: cashMethod, refNumber: `${marker}-DISCOUNT`});
  if (!ok(discount)) throw Error("Cash discount prerequisite failed");
  const cashPayment = await post("Cash scenario collection", {...payload, transactionType: "PAYMENT", invoiceId, amount: 80, account: undefined, paymentAccount: cashRef, paymentMethod: cashMethod, autoClear: false, refNumber: `${marker}-CASH-PAYMENT`});
  if (!ok(cashPayment)) throw Error("Cash payment prerequisite failed");
  const savedCash = await read(`/journals/${cashPayment.json.data.id}`);
  const invoice = await read(`/invoices/${invoiceId}`);
  verify("Selected persisted cash account receives the $80 debit", savedCash.paymentAccount?.id === cash.id && savedCash.accounts?.some(a => a.id === cash.id && a.debit === 80));
  verify("Cash $100 invoice / $20 discount / $80 receipt leaves zero balance", invoice.cost === 100 && invoice.discount === 20 && invoice.payment === 80 && Number(invoice.balance ?? 0) === 0);
  const summary = await recorded("Cash closeout full summary", "POST", "/journals/summary", {filters: [{field: "incomeStatement.id", operator: "eq", value: closeout.id}]});
  verify("Cash closeout full summary reports income/net $80 and no expense", ok(summary) && summary.json.data?.some(row => row.currency === "USD" && row.income === 80 && row.expenses === 0 && row.net === 80), summary);
  await read(`/income-statements/${closeout.id}`);
  const totals = await read(`/income-statements/${closeout.id}/summary-total`);
  const total = name => totals.totals?.find(t => t.header === name);
  verify("Closeout totals preserve $80 cash/net, zero expense and separate $20 discount", total("Total Efectivo")?.value === 80 && total("Ingresos Neto")?.value === 80 && total("Gastos")?.value === 0 && total("Gastos")?.details?.some(d => d.header === "Descuentos" && d.value === 20));
  if (generateReports) {
  const report = await recorded("Generate isolated cash income report", "POST", "/reports/income", {type: "income", collection: "income_statements", lookup_field: "id", values: [String(closeout.id)], expiresInHours: 1});
  verify("Income report generation accepts isolated cash closeout", ok(report), report);
  if (ok(report) && report.json.data?.url) {
    const url = new URL(report.json.data.url);
    if (url.origin !== "https://api.embarqueros.com" || !url.pathname.startsWith("/public/reports/")) throw Error("Unexpected public report destination");
    const pdf = await fetch(url, {signal: AbortSignal.timeout(30000)});
    const localPath = `/tmp/emsys-cash-report-${closeout.id}.pdf`;
    if (pdf.ok) fs.writeFileSync(localPath, Buffer.from(await pdf.arrayBuffer()));
    evidence.push({label: "Cash report download", http: pdf.status, localPath, totalsExtracted: false});
    delete report.json.data.url;
  }
  } else note("PDF generation/download skipped; requires separate --reports opt-in and authorization for temporary public report exposure.");
  await reverse(cashPayment.json.data.id);
  await reverse(discount.json.data.id);

  // Valid/missing and mixed-method batches must leave every valid candidate pending.
  const paymentBody = {...payload, transactionType: "PAYMENT", invoiceId, account: undefined, autoClear: false};
  const p30 = await post("Concurrent receipt $30", {...paymentBody, amount: 30, refNumber: `${marker}-P30`});
  const p50 = await post("Concurrent receipt $50", {...paymentBody, amount: 50, refNumber: `${marker}-P50`});
  const check = methods.find(m => m.name === "CHECK");
  if (!ok(p30) || !ok(p50) || !check) throw Error("Concurrent payment prerequisites failed");
  const p10 = await post("Mixed-method receipt $10", {...paymentBody, paymentMethod: check, paymentReference: `${marker}-CHECK`, amount: 10, refNumber: `${marker}-P10`});
  if (!ok(p10)) throw Error("Mixed payment prerequisite failed");
  const id30 = p30.json.data.id, id50 = p50.json.data.id, id10 = p10.json.data.id;
  for (const [label, ids] of [["missing journal", [id30, "000000000000000000000000"]], ["mixed bank methods", [id30, id10]]]) {
    const r = await recorded(`Clearance rejects ${label}`, "POST", "/journals/clear", {requestId: randomUUID(), ids});
    verify(`Clearance rejects ${label}`, denied(r), r);
    const saved = await read(`/journals/${id30}`), current = await read(`/invoices/${invoiceId}`);
    verify(`Rejected ${label} leaves receipt and invoice unchanged`, saved.clearanceStatus === "OUTSTANDING" && Number(current.payment ?? 0) === 0 && current.balance === 100);
  }
  const command = {requestId: randomUUID(), ids: [id30]};
  const parallel = await Promise.all([recorded("Concurrent same-command A", "POST", "/journals/clear", command), recorded("Concurrent same-command B", "POST", "/journals/clear", command)]);
  verify("Concurrent identical clear commands both return confirmed results", parallel.every(ok));
  const first = await read(`/invoices/${invoiceId}`);
  verify("Concurrent identical clearance applies exactly $30 once", first.payment === 30 && first.balance === 70);
  const different = await Promise.all([recorded("Concurrent fresh command already-cleared journal", "POST", "/journals/clear", {requestId: randomUUID(), ids: [id30]}), recorded("Concurrent fresh command pending journal", "POST", "/journals/clear", {requestId: randomUUID(), ids: [id50]})]);
  verify("Fresh clear command rejects settled input while pending command succeeds", different[0].status === 409 && ok(different[1]));
  const second = await read(`/invoices/${invoiceId}`);
  verify("Concurrent distinct commands leave total payment $80 / balance $20", second.payment === 80 && second.balance === 20);
  const changed = await recorded("Reject reused UUID with changed payload", "POST", "/journals/clear", {...command, ids: [id50]});
  verify("Clearance command UUID is payload-bound", changed.status === 409, changed);

  const raceReceipt = await post("Independent-command race receipt $5", {...paymentBody, amount: 5, refNumber: `${marker}-RACE`});
  if (!ok(raceReceipt)) throw Error("Independent-command receipt prerequisite failed");
  const raceId = raceReceipt.json.data.id;
  const competing = await Promise.all(["A", "B"].map(label => recorded(`Independent-command same-receipt race ${label}`, "POST", "/journals/clear", {requestId: randomUUID(), ids: [raceId]})));
  verify("Independent commands for one pending receipt have one success and one conflict", competing.filter(ok).length === 1 && competing.filter(r => r.status === 409).length === 1);
  const racedInvoice = await read(`/invoices/${invoiceId}`);
  const racedJournal = await read(`/journals/${raceId}`);
  verify("Independent-command race applies exactly $5 once", racedInvoice.payment === 85 && racedInvoice.balance === 15 && racedJournal.clearanceStatus === "CLEARED" && racedJournal.reconciliationStatus === "RECONCILED");

  // Test exact persisted account references rather than trusting client labels.
  const expenseAccount = await create("/chart-accounts", {name: `${marker}-EXPENSE`, displayName: `${marker}-EXPENSE`, type: "EXPENSE", branch});
  const expenseRef = {id: expenseAccount.id, name: expenseAccount.name, type: "EXPENSE"};
  const expenseControl = await post("Valid bank EXPENSE source control", {...payload, transactionType: "EXPENSE", sourceAccount: bank, paymentAccount: undefined, account: expenseRef, refNumber: `${marker}-EXPENSE-CONTROL`});
  verify("Valid bank EXPENSE source succeeds", ok(expenseControl), expenseControl);
  const cashExpense = await post("Valid cash EXPENSE source control", {...payload, transactionType: "EXPENSE", sourceAccount: cashRef, paymentAccount: undefined, paymentMethod: cashMethod, account: expenseRef, refNumber: `${marker}-CASH-EXPENSE`});
  verify("Cash EXPENSE uses the selected persisted cash source", ok(cashExpense) && cashExpense.json?.data?.accounts?.some(a => a.id === cash.id && a.credit === 0.01), cashExpense);
  const assetCategory = accounts.find(a => a.name === "LOAN RECEIVABLE" && a.type === "ASSET");
  if (assetCategory && ok(expenseControl)) {
    const forged = await post("Persisted ASSET spoofed as EXPENSE category", {...payload, transactionType: "EXPENSE", sourceAccount: bank, paymentAccount: undefined, account: {id: assetCategory.id, name: "Gasolina", type: "EXPENSE"}, refNumber: `${marker}-FORGED-CATEGORY`});
    verify("EXPENSE rejects an ASSET classification account with forged name/type", denied(forged), forged);
    if (forged.json?.data?.id) await read(`/journals/${forged.json.data.id}`);
  }
  for (const sync of [false, true]) {
    const cashDefault = await post(`CASH default ${sync ? "sync" : "create"}`, {...payload, paymentMethod: cashMethod, paymentAccount: undefined, refNumber: `${marker}-CASH-DEFAULT-${sync}`}, sync);
    if (ok(cashDefault)) {
      const row = await read(`/journals/${cashDefault.json.data.id}`);
      verify(`Omitted CASH account defaults to persisted CASH ON HAND on ${sync ? "sync" : "create"}`, (row.paymentAccount == null || row.paymentAccount.id === cashRoot.id) && row.accounts?.some(a => a.id === cashRoot.id && a.debit === 0.01));
    } else verify(`CASH default ${sync ? "sync" : "create"} accepted`, false, cashDefault);
  }
  for (const [label, account] of [["nonexistent", {...bank, id: 2147483646}], ["wrong-branch", {id: otherBank.id, name: otherBank.name, type: "BANK"}]]) {
    for (const sync of [false, true]) {
      const r = await post(`${label} SALES ${sync ? "sync" : "create"}`, {...payload, paymentAccount: account, refNumber: `${marker}-${label}-${sync}`}, sync);
      verify(`${label} bank rejected on SALES ${sync ? "sync" : "create"}`, denied(r), r);
      if (r.json?.data?.id) await read(`/journals/${r.json.data.id}`);
    }
    const expense = await post(`${label} EXPENSE source`, {...payload, transactionType: "EXPENSE", sourceAccount: account, paymentAccount: undefined, account: expenseRef, refNumber: `${marker}-${label}-EXPENSE`});
    if (ok(expenseControl)) verify(`${label} bank rejected on EXPENSE`, denied(expense), expense);
    else note(`${label} EXPENSE rejection is inconclusive without a successful valid source control`);
  }
  const spoof = await post("Spoofed account name/type", {...payload, paymentAccount: {...bank, name: "FORGED-ACCOUNT-NAME", type: "ASSET"}, refNumber: `${marker}-SPOOF`});
  if (ok(spoof)) {
    const saved = await read(`/journals/${spoof.json.data.id}`);
    verify("Persisted account overrides spoofed name/type", saved.paymentAccount?.id === bank.id && saved.paymentAccount.name === bank.name && saved.paymentAccount.type === "BANK");
  } else verify("Spoofed account reference explicitly rejected", denied(spoof), spoof);
  const updateSeed = await post("Account-update positive control", {...payload, refNumber: `${marker}-UPDATE`});
  if (!ok(updateSeed)) throw Error("Update positive prerequisite failed");
  let update = await read(`/journals/${updateSeed.json.data.id}`);
  const validUpdate = await recorded("Account-update valid control", "PUT", `/journals/${update.id}`, {...payload, id: update.id, expectedVersion: update.version, description: `${marker} valid update`});
  verify("Valid persisted bank update succeeds", ok(validUpdate), validUpdate);
  update = await read(`/journals/${update.id}`);
  const invalidUpdate = await recorded("Account-update nonexistent bank", "PUT", `/journals/${update.id}`, {...payload, id: update.id, expectedVersion: update.version, paymentAccount: {...bank, id: 2147483646}});
  verify("Nonexistent bank rejected on journal update", denied(invalidUpdate), invalidUpdate);
  const afterInvalidUpdate = await read(`/journals/${update.id}`);
  verify("Rejected account update preserves version, funding account and ledger", denied(invalidUpdate) && afterInvalidUpdate.version === update.version && JSON.stringify(afterInvalidUpdate.paymentAccount) === JSON.stringify(update.paymentAccount) && JSON.stringify(afterInvalidUpdate.accounts) === JSON.stringify(update.accounts));
  // No manual period closure is used: the deployed contract disables it.
  const close = await recorded("Manual close disabled control", "POST", `/income-statements/${closeout.id}/close`);
  verify("Manual closeout closure remains disabled", close.status === 409, close);
  note("Closed-period and midnight transitions require server clock/lifecycle controls; no historical period was changed.");
  note("Inactive/cross-company account tests require a documented active flag and a second authorized company. Neither was inferred from supplied labels.");
}
