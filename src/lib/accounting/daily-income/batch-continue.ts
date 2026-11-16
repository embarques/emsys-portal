import { getBatchPreservedValueKeys } from "@/lib/accounting/daily-income/transaction-workflow";
import {
  withDefaultCashPaymentMethod,
  type AccountingLookup,
  type DailyIncomeJournalValues,
  type JournalTransactionType,
} from "@/lib/accounting/daily-income/types";
import type { TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";

export function emptyTransaction(
  type: JournalTransactionType,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  const values: DailyIncomeJournalValues = {
    transactionType: type,
    autoGenerateInvoiceNumber: type === "INITIAL-PAYMENT",
    amount: 0,
    autoClear: false,
    clearPaymentOnSave: false,
    refNumber: "",
    refNumberMode: "system",
    externalReferenceNumber: "",
    description: "",
    includeSender: false,
    includeReceiver: false,
    // Default accountability: digitizing user (API resolves their linked employee).
    assigneeSource: "creator",
  };

  return withDefaultCashPaymentMethod(values, paymentMethods);
}

/**
 * Default post-save draft when no batch mark is set: shared assignee + payment defaults,
 * with transactional fields (invoice, amount, references) cleared for the next entry.
 */
export function continueTransactionValues(
  type: JournalTransactionType,
  values: DailyIncomeJournalValues,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  return {
    ...emptyTransaction(type, paymentMethods),
    autoGenerateInvoiceNumber: type === "INITIAL-PAYMENT" ? values.autoGenerateInvoiceNumber ?? true : undefined,
    employeeId: values.employeeId,
    employeeName: values.employeeName,
    employeeGroupId: values.employeeGroupId,
    employeeGroupName: values.employeeGroupName,
    assigneeSource: values.assigneeSource,
    routeId: values.routeId,
    routeName: values.routeName,
    supervisorId: values.supervisorId,
    supervisorName: values.supervisorName,
    routeCrewId: values.routeCrewId,
    routeCrewName: values.routeCrewName,
    paymentMethodId: values.paymentMethodId,
    paymentMethodName: values.paymentMethodName,
    paymentAccountId: values.paymentAccountId,
    paymentAccountName: values.paymentAccountName,
    paymentAccountType: values.paymentAccountType,
    refNumberMode: values.refNumberMode ?? "system",
    autoClear: values.autoClear ?? false,
    clearPaymentOnSave: values.clearPaymentOnSave ?? false,
    autoReconcile: values.autoReconcile,
    includeSender: values.includeSender ?? false,
    includeReceiver: values.includeReceiver ?? false,
    accountId: values.accountId,
    accountName: values.accountName,
    accountType: values.accountType,
    sourceAccountId: values.sourceAccountId,
    sourceAccountName: values.sourceAccountName,
    sourceAccountType: values.sourceAccountType,
    transactionType: type,
  };
}

/**
 * Batch mark is set: keep every field from steps before `batchStartStep`, and reset
 * the start step plus everything after it so the operator only re-enters from there.
 */
export function continueTransactionValuesFromStep(
  type: JournalTransactionType,
  values: DailyIncomeJournalValues,
  batchStartStep: TransactionFormStep,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  const next: DailyIncomeJournalValues = {
    ...emptyTransaction(type, paymentMethods),
    transactionType: type,
  };

  for (const key of getBatchPreservedValueKeys(type, batchStartStep)) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    const value = values[key];
    // Keep false / 0 / "" from the saved entry; only skip missing fields.
    if (value !== undefined) {
      (next as Record<string, unknown>)[key] = value;
    }
  }

  if (type === "INITIAL-PAYMENT" && next.autoGenerateInvoiceNumber === undefined) {
    next.autoGenerateInvoiceNumber = true;
  }

  return withDefaultCashPaymentMethod(next, paymentMethods);
}
