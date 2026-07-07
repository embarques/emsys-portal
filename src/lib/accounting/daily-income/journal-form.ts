import type { DailyIncomeJournal, DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

export function transactionTypeLabel(value: string) {
  return (
    {
      "INITIAL-PAYMENT": "Invoice",
      PAYMENT: "Payment",
      DISCOUNT: "Discount",
      SURCHARGE: "Surcharge",
      EXPENSE: "Expense",
      SALES: "Income",
      TRANSFER: "Transfer",
      LOAN: "Loan",
    } as Record<string, string>
  )[value] ?? value;
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
    includeReceiver: Boolean(
      row.invoice?.receiver?.id ??
        row.invoice?.receivers?.find((receiver) => receiver?.id)?.id,
    ),
    senderId: row.invoice?.sender?.id != null ? String(row.invoice.sender.id) : undefined,
    senderName: row.invoice?.sender?.name,
    receiverId:
      row.invoice?.receiver?.id != null
        ? String(row.invoice.receiver.id)
        : row.invoice?.receivers?.find((receiver) => receiver?.id)?.id != null
          ? String(row.invoice.receivers.find((receiver) => receiver?.id)!.id)
          : undefined,
    receiverName:
      row.invoice?.receiver?.name ??
      row.invoice?.receivers?.find((receiver) => receiver?.name)?.name,
    paymentMethodId: row.paymentMethod?.id,
    paymentMethodName: row.paymentMethod?.name,
    zelleTransactionDate: row.zelleTransactionDate,
    zelleTransactionName: row.zelleTransactionName,
  };
}
