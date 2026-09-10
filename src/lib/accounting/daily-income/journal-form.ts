import type { DailyIncomeJournal, DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";

const TRANSACTION_TYPE_I18N_KEYS: Record<string, string> = {
  "INITIAL-PAYMENT": "initialPayment",
  PAYMENT: "payment",
  EXPENSE: "expense",
  SALES: "sales",
  INVENTORY: "inventory",
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
    values.inventoryItemName?.trim() ||
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

function lookupId(id?: number): number | undefined {
  return id ? id : undefined;
}

function accountTypeFromLines(
  row: DailyIncomeJournal,
  accountId?: number,
  fallback?: string,
): string | undefined {
  if (fallback?.trim()) return fallback;
  if (!accountId) return undefined;
  return row.accounts.find((account) => account.id === accountId)?.type;
}

export function withPinnedSelectOption<T extends { value: string; label: string; keywords?: string[] }>(
  options: T[],
  value?: string | number | null,
  label?: string,
): T[] {
  if (value == null || value === "") return options;
  const key = String(value);
  if (options.some((option) => option.value === key)) return options;
  const text = label?.trim() || key;
  return [{ value: key, label: text, keywords: [text] } as T, ...options];
}

export function journalToFormValues(row: DailyIncomeJournal): DailyIncomeJournalValues {
  const routeId = row.route?.id != null && String(row.route.id).trim() ? String(row.route.id) : undefined;
  const assignedToRoute = Boolean(routeId);
  const invoiceId = row.invoice?.id != null && String(row.invoice.id).trim() ? String(row.invoice.id) : undefined;
  const senderId = row.invoice?.sender?.id != null ? String(row.invoice.sender.id) : undefined;
  const receiverId = row.invoice?.receiver?.id != null ? String(row.invoice.receiver.id) : undefined;
  return {
    transactionType: row.transactionType,
    amount: row.amount,
    refNumber: row.refNumber ?? "",
    description: row.description ?? "",
    assigneeSource: assignedToRoute ? "route" : "employee",
    employeeId: assignedToRoute ? undefined : lookupId(row.employee?.id),
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
    accountId: lookupId(row.account?.id),
    accountName: row.account?.displayName ?? row.account?.name,
    accountType: accountTypeFromLines(row, row.account?.id, row.account?.type),
    paymentAccountId: lookupId(row.paymentAccount?.id),
    paymentAccountName: row.paymentAccount?.displayName ?? row.paymentAccount?.name,
    paymentAccountType: row.paymentAccount?.type ?? (row.paymentAccount ? "BANK" : undefined),
    sourceAccountId: lookupId(row.sourceAccount?.id),
    sourceAccountName: row.sourceAccount?.displayName ?? row.sourceAccount?.name,
    sourceAccountType: accountTypeFromLines(row, row.sourceAccount?.id, row.sourceAccount?.type),
    invoiceId,
    invoiceNumber: row.invoice?.number ?? "",
    invoiceCost: row.invoice?.cost,
    invoiceDiscount: row.invoice?.discount,
    invoiceBalance: row.invoice?.balance,
    includeSender: Boolean(senderId),
    includeReceiver: Boolean(receiverId),
    senderId,
    senderName: row.invoice?.sender?.name,
    receiverId,
    receiverName: row.invoice?.receiver?.name,
    paymentMethodId: lookupId(row.paymentMethod?.id),
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
