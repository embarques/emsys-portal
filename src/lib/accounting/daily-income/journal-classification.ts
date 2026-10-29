import type { DailyIncomeJournal } from "./types";

type ClassifiableJournal = Pick<DailyIncomeJournal, "transactionType" | "amount" | "inventoryDirection" | "accounts">;

/** Daily Income expense for a journal: EXPENSE account lines win over the transaction type. */
export function journalExpenseAmount(item: ClassifiableJournal): number {
  const expenseLines = item.accounts.filter((account) => account.type === "EXPENSE");
  if (expenseLines.length > 0) return expenseLines.reduce((total, account) => total + account.debit, 0);
  if (item.transactionType === "EXPENSE" || (item.transactionType === "INVENTORY" && item.inventoryDirection === "received")) {
    return item.amount;
  }
  return 0;
}

export function journalCountsAsIncome(item: ClassifiableJournal): boolean {
  return (
    ["INITIAL-PAYMENT", "PAYMENT", "SALES"].includes(item.transactionType) ||
    (item.transactionType === "INVENTORY" && item.inventoryDirection === "dispatched")
  );
}

export type JournalTotals = {
  currency: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
};

function cents(value: number) {
  return Math.round(value * 100) / 100;
}

/** Income, expenses and net income per currency, classified exactly like the Daily Income summary. */
export function summarizeJournalTotals(items: Array<ClassifiableJournal & Pick<DailyIncomeJournal, "currency">>): JournalTotals[] {
  const byCurrency = new Map<string, JournalTotals>();
  for (const item of items) {
    const currency = item.currency?.trim().toUpperCase() ?? "";
    const totals = byCurrency.get(currency) ?? { currency, income: 0, expenses: 0, net: 0, count: 0 };
    if (journalCountsAsIncome(item)) totals.income += item.amount;
    totals.expenses += journalExpenseAmount(item);
    totals.count += 1;
    byCurrency.set(currency, totals);
  }
  return [...byCurrency.values()].map((totals) => ({
    ...totals,
    income: cents(totals.income),
    expenses: cents(totals.expenses),
    net: cents(totals.income - totals.expenses),
  }));
}
