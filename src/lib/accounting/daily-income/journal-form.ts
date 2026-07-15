import type { DailyIncomeJournal, DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";

const TRANSACTION_TYPE_I18N_KEYS: Record<string, string> = {
  "INITIAL-PAYMENT": "initialPayment",
  PAYMENT: "payment",
  EXPENSE: "expense",
  SALES: "sales",
  DISCOUNT: "discount",
  SURCHARGE: "surcharge",
  TRANSFER: "transfer",
  LOAN: "loan",
};

export function transactionTypeLabel(value: string, t: TranslateFn) {
  const key = TRANSACTION_TYPE_I18N_KEYS[value];
  if (!key) return value;
  return t(`accounting.dailyIncome.transactionTypes.${key}.shortLabel`);
}

export function journalToFormValues(row: DailyIncomeJournal): DailyIncomeJournalValues {
  return {
    transactionType: row.transactionType,
    amount: row.amount,
    refNumber: row.refNumber,
    description: row.description,
    employeeId: row.employee?.id,
    employeeName: row.employee?.name,
    employeeGroupId: row.employeeGroup?.id != null ? String(row.employeeGroup.id) : undefined,
    employeeGroupName: row.employeeGroup?.name,
    accountId: row.account?.id,
    accountName: row.account?.displayName ?? row.account?.name,
    accountType: row.accounts.find((account) => account.id === row.account?.id)?.type,
    paymentAccountId: row.paymentAccount?.id,
    paymentAccountName: row.paymentAccount?.displayName ?? row.paymentAccount?.name,
    paymentAccountType: row.paymentAccount ? "BANK" : undefined,
    sourceAccountId: row.sourceAccount?.id,
    sourceAccountName: row.sourceAccount?.displayName ?? row.sourceAccount?.name,
    sourceAccountType: row.accounts.find((account) => account.id === row.sourceAccount?.id)?.type,
    invoiceId: row.invoice?.id != null ? String(row.invoice.id) : "",
    invoiceNumber: row.invoice?.number ?? "",
    invoiceCost: row.invoice?.cost,
    includeSender: Boolean(row.invoice?.sender?.id),
    includeReceiver: Boolean(row.invoice?.receiver?.id),
    senderId: row.invoice?.sender?.id != null ? String(row.invoice.sender.id) : undefined,
    senderName: row.invoice?.sender?.name,
    receiverId: row.invoice?.receiver?.id != null ? String(row.invoice.receiver.id) : undefined,
    receiverName: row.invoice?.receiver?.name,
    paymentMethodId: row.paymentMethod?.id,
    paymentMethodName: row.paymentMethod?.name,
    zelleTransactionDate: row.zelleTransactionDate,
    zelleTransactionName: row.zelleTransactionName,
    checkNumber: row.checkNumber,
  };
}

export function areDailyIncomeJournalValuesEquivalent(
  left: DailyIncomeJournalValues,
  right: DailyIncomeJournalValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}
