import type { AccountingLookup, DailyIncomeJournal } from "./types";

export type JournalBatchSelectionKey = {
  paymentMethod: string;
  moneyAccountId: number;
  moneyAccountName: string;
};

export type JournalBatchSelectionBlockReason = "paymentMethod" | "moneyAccount";

function accountId(account?: AccountingLookup | null): number {
  return account?.id && account.id > 0 ? account.id : 0;
}

function accountName(account?: AccountingLookup | null): string {
  return account?.displayName?.trim() || account?.name?.trim() || "";
}

/**
 * Cash/bank account the batch is confirming — not loan AR / expense categories.
 * Loans store the money side on `sourceAccount` (issue credits it; payment debits it).
 * Match the API: sourceAccount first, then paymentAccount. Ledger lines are
 * display fallbacks, not persisted money-account metadata for batch validation.
 */
export function resolveJournalMoneyAccount(
  row: Pick<DailyIncomeJournal, "transactionType" | "sourceAccount" | "paymentAccount" | "accounts">,
): AccountingLookup | undefined {
  const source = row.sourceAccount;
  const payment = row.paymentAccount;
  if (accountId(source)) return source;
  return accountId(payment) ? payment : undefined;
}

export function getJournalBatchSelectionKey(
  row: Pick<DailyIncomeJournal, "paymentMethod" | "transactionType" | "sourceAccount" | "paymentAccount" | "accounts">,
): JournalBatchSelectionKey {
  const money = resolveJournalMoneyAccount(row);
  return {
    paymentMethod: row.paymentMethod?.name?.trim() ?? "",
    moneyAccountId: accountId(money),
    moneyAccountName: accountName(money),
  };
}

export function getJournalBatchSelectionBlockReason(
  selected: JournalBatchSelectionKey | undefined,
  row: Pick<DailyIncomeJournal, "paymentMethod" | "transactionType" | "sourceAccount" | "paymentAccount" | "accounts">,
): JournalBatchSelectionBlockReason | null {
  if (!selected) return null;
  const next = getJournalBatchSelectionKey(row);
  if (selected.paymentMethod !== next.paymentMethod) return "paymentMethod";
  if (selected.moneyAccountId !== next.moneyAccountId) return "moneyAccount";
  return null;
}

export function journalsShareBatchSelection(
  selected: JournalBatchSelectionKey | undefined,
  row: Pick<DailyIncomeJournal, "paymentMethod" | "transactionType" | "sourceAccount" | "paymentAccount" | "accounts">,
): boolean {
  return getJournalBatchSelectionBlockReason(selected, row) === null;
}
