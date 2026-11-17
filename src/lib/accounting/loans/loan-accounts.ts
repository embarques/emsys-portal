import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import {
  listCashAccounts,
  listSelectableBankAccounts,
} from "@/lib/accounting/daily-income/payment-accounts";

type AccountNode = Pick<
  ChartAccount,
  "id" | "name" | "displayName" | "type" | "systemAccount" | "parentAccount" | "nonPosting" | "branch"
>;

function systemName(account: AccountNode): string {
  return (account.name || account.displayName || "").trim().toUpperCase();
}

/** True for customer AR / loan-receivable style assets that must not fund a loan. */
export function isLoanReceivableLikeAccount(account: AccountNode): boolean {
  const type = (account.type || "").toUpperCase();
  if (type === "LOAN") return true;
  const name = systemName(account);
  return (
    name === "ACCOUNTS RECEIVABLE" ||
    name.includes("LOAN RECEIVABLE") ||
    name.includes("EMPLOYEE LOAN") ||
    (name.includes("RECEIVABLE") && name.includes("LOAN"))
  );
}

/**
 * Debit side for new loans / increases: posting LOAN accounts that hold the
 * employee balance (loan receivable / accounts receivable for the loan).
 */
export function listLoanReceivableAccounts<T extends AccountNode>(accounts: readonly T[]): T[] {
  return accounts.filter((account) => {
    if ((account.type || "").toUpperCase() !== "LOAN") return false;
    if (account.nonPosting) return false;
    return true;
  });
}

/**
 * Credit side for new loans / increases (and payment destination): cash under
 * CASH ON HAND plus selectable bank accounts. Never AR or loan receivables —
 * those are updated on the loan receivable side for the full loan amount.
 */
export function listLoanFundingAccounts<T extends AccountNode>(accounts: readonly T[]): T[] {
  const cash = listCashAccounts(accounts).filter((account) => !account.nonPosting);
  const banks = listSelectableBankAccounts(
    accounts.filter((account) => (account.type || "").toUpperCase() === "BANK" && !account.nonPosting),
  );
  const seen = new Set<number>();
  const out: T[] = [];
  for (const account of [...cash, ...banks]) {
    if (seen.has(account.id) || isLoanReceivableLikeAccount(account)) continue;
    seen.add(account.id);
    out.push(account);
  }
  return out;
}
