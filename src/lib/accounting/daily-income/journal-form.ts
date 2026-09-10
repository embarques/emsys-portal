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

function transactionCreatedToastTarget(values: DailyIncomeJournalValues) {
  return (
    values.accountName?.trim() ||
    values.invoiceNumber?.trim() ||
    values.sourceAccountName?.trim() ||
    values.paymentAccountName?.trim() ||
    values.paymentMethodName?.trim() ||
    values.refNumber?.trim()
  );
}

export function transactionCreatedToastMessage(values: DailyIncomeJournalValues, t: TranslateFn) {
  const type = transactionTypeLabel(values.transactionType, t);
  const target = transactionCreatedToastTarget(values);
  return target
    ? t("accounting.dailyIncome.toasts.transactionCreatedWithTarget", { type, target })
    : t("accounting.dailyIncome.toasts.transactionCreatedWithType", { type });
}

export function journalToFormValues(row: DailyIncomeJournal): DailyIncomeJournalValues {
  const routeId = row.route?.id != null ? String(row.route.id) : undefined;
  const assignedToRoute = Boolean(routeId);
  return {
    transactionType: row.transactionType,
    amount: row.amount,
    refNumber: row.refNumber,
    description: row.description,
    assigneeSource: assignedToRoute ? "route" : "employee",
    employeeId: assignedToRoute ? undefined : row.employee?.id,
    employeeName: assignedToRoute ? undefined : row.employee?.name,
    employeeGroupId: assignedToRoute
      ? undefined
      : row.employeeGroup?.id != null
        ? String(row.employeeGroup.id)
        : undefined,
    employeeGroupName: assignedToRoute ? undefined : row.employeeGroup?.name,
    routeId,
    routeName: row.route?.name,
    routeCrewId: row.route?.route?.id != null ? String(row.route.route.id) : undefined,
    routeCrewName: row.route?.route?.name,
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
