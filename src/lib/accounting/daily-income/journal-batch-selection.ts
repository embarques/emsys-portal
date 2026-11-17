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
 * Invoice receipts and other income use `paymentAccount`.
 */
export function resolveJournalMoneyAccount(
  row: Pick<DailyIncomeJournal, "transactionType" | "sourceAccount" | "paymentAccount" | "accounts">,
): AccountingLookup | undefined {
  const source = row.sourceAccount;
  const payment = row.paymentAccount;
  if (row.transactionType === "LOAN" || row.transactionType === "LOAN-PAYMENT") {
    return accountId(source) ? source : undefined;
  }
  if (accountId(payment)) return payment;
  if (accountId(source)) return source;

  const fundingLine = row.accounts?.find((line) => {
    const type = (line.type || "").toUpperCase();
    if (type !== "ASSET" && type !== "BANK") return false;
    const name = (line.name || "").toUpperCase();
    if (name === "ACCOUNTS RECEIVABLE" || name.includes("LOAN")) return false;
    return line.debit > 0 || line.credit > 0;
  });
  return fundingLine
    ? { id: fundingLine.id, name: fundingLine.name, type: fundingLine.type, displayName: fundingLine.name }
    : undefined;
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
