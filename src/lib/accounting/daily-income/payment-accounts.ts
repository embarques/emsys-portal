import type { UseFormSetValue } from "react-hook-form";

import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

type AccountNode = Pick<ChartAccount, "id" | "name" | "displayName" | "type" | "systemAccount" | "parentAccount" | "nonPosting">;

const DEFAULT_CASH_ACCOUNT_NAME = "CASH ON HAND";
const DEFAULT_BANK_ACCOUNT_NAME = "BANK";
const MAX_ACCOUNT_DEPTH = 10;

/**
 * Cash-account selection, Debit/Wire methods and non-cash expenses need the
 * payment-accounts API contract (docs/payment-accounts-api-contract.md).
 */
export function isPaymentAccountsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED === "true";
}

const CASH_ACCOUNT_INCOME_TYPES = new Set(["PAYMENT", "INITIAL-PAYMENT", "SALES"]);

/** Cash income can land in a chosen cash account instead of always CASH ON HAND. */
export function isCashAccountSelectable(transactionType: string | null | undefined, isCash: boolean): boolean {
  return isPaymentAccountsEnabled() && isCash && CASH_ACCOUNT_INCOME_TYPES.has(transactionType ?? "");
}

function systemName(account: AccountNode): string {
  return (account.name || account.displayName || "").trim().toUpperCase();
}

/** The system CASH ON HAND account every company has; the cash umbrella. */
export function findDefaultCashAccount<T extends AccountNode>(accounts: readonly T[]): T | undefined {
  return accounts.find((account) => account.type === "ASSET" && systemName(account) === DEFAULT_CASH_ACCOUNT_NAME);
}

/** The top-level general bank account; the bank umbrella. */
export function findDefaultBankAccount<T extends AccountNode>(accounts: readonly T[]): T | undefined {
  const roots = accounts.filter((account) => account.type === "BANK" && !account.parentAccount?.id);
  return roots.find((account) => account.systemAccount) ?? roots.find((account) => systemName(account) === DEFAULT_BANK_ACCOUNT_NAME);
}

function isDescendantOf(account: AccountNode, rootId: number, byId: ReadonlyMap<number, AccountNode>): boolean {
  let parentId = account.parentAccount?.id;
  for (let depth = 0; parentId && depth < MAX_ACCOUNT_DEPTH; depth += 1) {
    if (parentId === rootId) return true;
    parentId = byId.get(parentId)?.parentAccount?.id;
  }
  return false;
}

/** CASH ON HAND plus every ASSET account nested under it, at any depth. */
export function listCashAccounts<T extends AccountNode>(accounts: readonly T[]): T[] {
  const root = findDefaultCashAccount(accounts);
  if (!root) return [];
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return accounts.filter((account) => account.type === "ASSET" && (account.id === root.id || isDescendantOf(account, root.id, byId)));
}

/** User-defined bank accounts; the general bank account only when none are defined. */
export function listSelectableBankAccounts<T extends AccountNode>(bankAccounts: readonly T[]): T[] {
  const general = findDefaultBankAccount(bankAccounts);
  const specific = bankAccounts.filter((account) => account.type === "BANK" && account.id !== general?.id);
  if (specific.length) return specific;
  return general ? [general] : [];
}

/** Bank account to preselect: only when there is no choice to make. */
export function resolveDefaultBankAccount<T extends AccountNode>(bankAccounts: readonly T[]): T | undefined {
  const selectable = listSelectableBankAccounts(bankAccounts);
  return selectable.length === 1 ? selectable[0] : undefined;
}

/** "BANK › Chase › Checking" so sub-banks are distinguishable in pickers. */
export function accountPathLabel(account: AccountNode, byId: ReadonlyMap<number, AccountNode>): string {
  const names: string[] = [];
  const seen = new Set<number>();
  let current: AccountNode | undefined = account;
  while (current && !seen.has(current.id) && names.length < MAX_ACCOUNT_DEPTH) {
    seen.add(current.id);
    names.unshift(current.displayName || current.name);
    const parentId: number | undefined = current.parentAccount?.id;
    current = parentId ? byId.get(parentId) : undefined;
  }
  return names.join(" › ");
}

/** Income lands in `paymentAccount`; a paid-by-method expense leaves from `sourceAccount`. */
export type MoneyAccountTarget = "paymentAccount" | "sourceAccount";

export function applyMoneyAccount(
  setValue: UseFormSetValue<DailyIncomeJournalValues>,
  target: MoneyAccountTarget,
  account: Pick<ChartAccount, "id" | "name" | "displayName" | "type"> | undefined,
) {
  const options = { shouldValidate: true, shouldDirty: true };
  const name = account ? account.displayName || account.name : undefined;
  // The id is set last: its validation checks the account type, so name/type must already be in place.
  if (target === "sourceAccount") {
    setValue("sourceAccountName", name ?? "", options);
    setValue("sourceAccountType", account?.type, options);
    setValue("sourceAccountId", account?.id, options);
    return;
  }
  setValue("paymentAccountName", name, options);
  setValue("paymentAccountType", account?.type, options);
  setValue("paymentAccountId", account?.id, options);
}

/** Switching between cash and bank methods invalidates the chosen account. */
export function shouldClearMoneyAccount(nextMethodNeedsBank: boolean, currentAccountType: string | undefined): boolean {
  if (!currentAccountType) return false;
  return nextMethodNeedsBank !== (currentAccountType === "BANK");
}

export function buildPaymentAccountOptions(accounts: readonly AccountNode[], pathSource: readonly AccountNode[] = accounts) {
  const byId = new Map(pathSource.map((account) => [account.id, account]));
  return accounts
    .filter(account => !account.nonPosting)
    .map((account) => {
      const label = accountPathLabel(account, byId);
      return { value: String(account.id), label, keywords: [account.displayName, account.name, label].filter(Boolean) };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}
