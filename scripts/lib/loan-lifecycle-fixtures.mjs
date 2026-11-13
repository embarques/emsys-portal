import {randomUUID} from "node:crypto";
import {createPortalLoader, createHttpApiClient} from "./portal-modules.mjs";

/** Isolated employee/current period only. Repayment offsets fixture funding;
 * immutable loan/journal/transaction history is retained rather than deleted. */
export async function verifyLoanLifecycle({request, branch, closeout, employee, marker, verify, evidence, note}) {
  const ok = r => r.status >= 200 && r.status < 300 && r.json?.success !== false;
  async function recorded(method, path, body) {
    const r = await request(method, path, body);
    evidence.push({label: "Loan lifecycle HTTP", method, path, body, http: r.status, response: r.json});
    return r;
  }
  const api = createPortalLoader({apiClient: createHttpApiClient(recorded)})("src/lib/accounting/loans/api.ts");
  const catalog = await recorded("GET", "/chart-accounts?page=1&limit=100");
  const accounts = catalog.json?.data ?? [];
  const cash = accounts.find(a => a.name === "CASH ON HAND" && a.type === "ASSET" && !a.nonPosting);
  const loanAccount = accounts.find(a => a.type === "LOAN" && (!a.branch || a.branch.id === branch.id) && !a.nonPosting);
  if (!ok(catalog) || !cash) throw Error("Cash catalog control unavailable");
  if (!loanAccount) {
    evidence.push({label: "Loan lifecycle prerequisite unavailable", branchId: branch.id, reason: "No eligible LOAN account in the fixture branch; ASSET is rejected and chart-account creation rejects LOAN"});
    note("Valid loan lifecycle remains unverified: no eligible LOAN account in the isolated branch. Existing business periods are preserved.");
    return;
  }
  const date = String(closeout.businessDate ?? closeout.date).slice(0,10);
  const common = {employeeId: employee.id, employeeName: employee.name, transactionDate: date, referenceNumber: randomUUID(), description: marker};
  let loan;
  try {
    loan = await api.createLoan({...common, principalAmount: 1, loanAccountId: loanAccount.id, loanAccountName: loanAccount.name, loanAccountType: loanAccount.type, sourceAccountId: cash.id, sourceAccountName: cash.name, sourceAccountType: cash.type});
    if (!loan?.id) throw Error("Loan creation returned no ID");
    evidence.push({label: "Retained fixture loan", loanId: loan.id, employeeId: employee.id, branchId: branch.id});
    verify("Loan issue persists principal/balance in fixture branch", loan.principalAmount === 1 && loan.balance === 1 && loan.branch?.id === branch.id);
    const values = {...common, referenceNumber: randomUUID(), loanId: loan.id, sourceAccountId: cash.id, sourceAccountName: cash.name, sourceAccountType: cash.type, amount: 0.25};
    try {
      await api.increaseLoan(values);
      verify("Current portal increase payload is accepted", true);
    } catch (error) {
      verify("Current portal increase payload is accepted", false, {status: error.response?.status, json: error.response?.data});
      note("Testing the runtime-required requestId separately; portal feature remains gated.");
      const body = {requestId: randomUUID(), employee: {id: employee.id, name: employee.name}, sourceAccount: {id: cash.id, name: cash.name, type: cash.type}, amount: 0.25, transactionDate: date, referenceNumber: values.referenceNumber, description: marker};
      const first = await recorded("POST", `/loans/${loan.id}/increases`, body);
      verify("Keyed loan increase succeeds", ok(first), first);
      if (ok(first)) {
        const replay = await recorded("POST", `/loans/${loan.id}/increases`, body);
        verify("Keyed loan increase replays successfully", ok(replay), replay);
        const changed = await recorded("POST", `/loans/${loan.id}/increases`, {...body, amount: 0.5});
        verify("Loan increase key rejects changed payload", changed.status === 409, changed);
      }
    }
    const saved = await api.fetchLoan(loan.id);
    verify("Increase and replay apply principal exactly once", saved?.principalAmount === 1.25 && saved.balance === 1.25 && saved.paidAmount === 0);
    const transactions = await api.fetchLoanTransactions(loan.id);
    verify("Loan has one issue and one linked increase", transactions.filter(t => t.type === "ISSUE").length === 1 && transactions.filter(t => t.type === "INCREASE").length === 1 && transactions.every(t => Boolean(t.journalEntryId)));
    evidence.push({label: "Loan linked transaction readback", loan: saved, transactions});
  } finally {
    if (loan?.id) {
      const saved = await api.fetchLoan(loan.id);
      if (saved?.balance > 0) {
        await api.recordLoanPayment({...common, referenceNumber: randomUUID(), allocationMode: "specific-loan", loanId: loan.id, receivedAccountId: cash.id, receivedAccountName: cash.name, receivedAccountType: cash.type, amount: saved.balance});
      }
      const settled = await api.fetchLoan(loan.id);
      verify("Fixture loan repaid in full without deleting financial history", settled?.balance === 0 && settled.status === "PAID");
      note(`Retained paid fixture loan ${loan.id}; issue/increase/repayment history belongs to branch ${branch.id}.`);
    }
  }
}
