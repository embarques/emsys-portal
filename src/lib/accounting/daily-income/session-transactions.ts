import type { DailyIncomeJournal, DailyIncomeJournalValues, JournalTransactionType } from "./types";

export type SessionTransaction = {
  journal: DailyIncomeJournal;
  values: DailyIncomeJournalValues;
  statementId: number;
  savedAt: number;
};

/** Request values fill fields omitted by the journal create response. */
export function sessionTransactionDetails({ journal, values }: SessionTransaction) {
  const type = journal.transactionType || values.transactionType;
  const amount = journal.amount;
  const cost = journal.invoice?.cost ?? values.invoiceCost ?? 0;
  return {
    type,
    amount,
    cost,
    balance: journal.invoice?.balance ?? (type === "INITIAL-PAYMENT" ? cost - amount : values.invoiceBalance ?? 0),
    invoice: journal.invoice?.number || values.invoiceNumber || "—",
    method: journal.paymentMethod?.name || values.paymentMethodName || "",
    account: journal.account?.name || values.accountName || "",
    sourceAccount: journal.sourceAccount?.name || values.sourceAccountName || "",
    description: journal.description || values.description,
    item: journal.inventoryItemName || values.inventoryItemName || "",
    quantity: journal.inventoryQuantity ?? values.inventoryQuantity,
    supplier: journal.inventorySupplierName || values.inventorySupplierName || "",
    direction: journal.inventoryDirection || values.inventoryDirection,
    reference: journal.refNumber || values.refNumber,
  };
}

export function sessionTransactionTotals(entries: SessionTransaction[]) {
  const totals = new Map<JournalTransactionType, { type: JournalTransactionType; count: number; cost: number; amount: number; balance: number }>();
  for (const entry of entries) {
    const detail = sessionTransactionDetails(entry);
    const total = totals.get(detail.type) ?? { type: detail.type, count: 0, cost: 0, amount: 0, balance: 0 };
    total.count++;
    total.amount += detail.amount;
    if (detail.type === "INITIAL-PAYMENT") {
      total.cost += detail.cost;
      total.balance += detail.balance;
    }
    totals.set(detail.type, total);
  }
  return [...totals.values()];
}

/** Operational net: collections minus expenses, discounts, loans and transfers, as in the closeout. */
export function sessionTransactionsNetTotal(entries: SessionTransaction[]): number {
  let cents = 0;
  for (const entry of entries) {
    const d = sessionTransactionDetails(entry);
    const lines = entry.journal.accounts ?? [];
    let amount = 0;
    if (lines.length) {
      for (const line of lines) {
        if (d.type === "TRANSFER") amount -= line.debit;
        else if (line.name === "ACCOUNTS RECEIVABLE" || line.name === "SALES") continue;
        else if (line.name === "LOAN RECEIVABLE") amount -= line.debit - line.credit;
        else if (line.name === "SALES DISCOUNTS" || line.type === "EXPENSE") amount -= line.debit;
        else if (line.type === "BANK") amount += line.debit;
        else if (line.name === "CASH ON HAND" || line.type === "ASSET") amount += Math.max(0, line.debit);
      }
    } else {
      const outflow = ["EXPENSE", "DISCOUNT", "LOAN", "TRANSFER"].includes(d.type) || (d.type === "INVENTORY" && d.direction === "received");
      amount = d.type === "SURCHARGE" ? 0 : outflow ? -d.amount : d.amount;
    }
    cents += Math.round(amount * 100);
  }
  return cents / 100;
}
