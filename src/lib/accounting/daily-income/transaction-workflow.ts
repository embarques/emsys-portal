import { isPaymentAccountsEnabled } from "./payment-accounts";
import type { DailyIncomeJournalValues, JournalTransactionType } from "./types";

export type TransactionFormStep = "assignment" | "amounts" | "payment" | "parties" | "review";

export const TRANSACTION_FIELD_IDS: Partial<Record<keyof DailyIncomeJournalValues, string>> = {
  employeeId: "journal-employee", routeId: "journal-route", supervisorId: "journal-employee-supervisor",
  inventoryHolderVehicleId: "journal-inventory-holder-vehicle",
  inventoryHolderEmployees: "journal-inventory-holder-employee",
  invoiceId: "journal-invoice", invoiceNumber: "journal-invoice-number",
  invoiceCost: "journal-invoice-cost", invoiceDiscount: "journal-invoice-discount", amount: "journal-amount",
  accountId: "journal-account", sourceAccountId: "journal-source",
  senderId: "journal-sender", receiverId: "journal-receiver",
  paymentMethodId: "journal-payment", paymentMethodName: "journal-payment",
  paymentAccountId: "journal-bank-account", paymentAccountType: "journal-bank-account",
  checkNumber: "journal-check-number", autoClear: "journal-auto-clear", refNumber: "journal-reference",
  inventoryDirection: "journal-inventory-direction", inventorySupplierId: "journal-inventory-supplier",
  inventoryItemId: "journal-inventory-item", inventoryQuantity: "journal-inventory-quantity",
  inventoryUnitPrice: "journal-inventory-unit-price", inventoryTotal: "journal-inventory-total",
  autoReconcile: "journal-auto-reconcile",
};

export const TRANSACTION_STEP_FIELDS: Record<Exclude<TransactionFormStep, "review">, (keyof DailyIncomeJournalValues)[]> = {
  assignment: ["employeeId", "routeId", "supervisorId", "inventoryDirection", "inventorySupplierId", "inventoryHolderVehicleId", "inventoryHolderEmployees"],
  amounts: ["invoiceId", "invoiceNumber", "invoiceCost", "invoiceDiscount", "amount", "accountId", "sourceAccountId", "inventoryItemId", "inventoryQuantity", "inventoryUnitPrice", "inventoryTotal", "autoReconcile"],
  payment: ["paymentMethodId", "paymentMethodName", "paymentAccountId", "paymentAccountType", "checkNumber", "autoClear", "externalReferenceNumber", "refNumberMode", "refNumber", "description"],
  parties: ["includeSender", "senderId", "includeReceiver", "receiverId"],
};

/**
 * Discounts and surcharges only adjust the invoice total, so they skip payment details: the request
 * always posts Cash with a system reference. Expenses do the same until the payment-accounts contract
 * is enabled; then they choose a method and the cash or bank account the money comes from.
 */
export function hasPaymentDetailsStep(type: JournalTransactionType | null): boolean {
  return type !== "INVENTORY" && !isFixedCashTransactionType(type);
}

export function isFixedCashTransactionType(type: JournalTransactionType | null | undefined): boolean {
  return type === "DISCOUNT" || type === "SURCHARGE" || (type === "EXPENSE" && !isPaymentAccountsEnabled());
}

/** Expenses pick their source account with the payment method (payment-accounts contract). */
export function isExpensePaidByMethod(type: JournalTransactionType | null | undefined): boolean {
  return type === "EXPENSE" && isPaymentAccountsEnabled();
}

/** New invoices may name sender / receiver clients in an optional step just before review. */
export function hasPartiesStep(type: JournalTransactionType | null): boolean {
  return type === "INITIAL-PAYMENT";
}

export function getTransactionFormSteps(type: JournalTransactionType | null): TransactionFormStep[] {
  return [
    "assignment",
    "amounts",
    ...(hasPaymentDetailsStep(type) ? ["payment" as const] : []),
    ...(hasPartiesStep(type) ? ["parties" as const] : []),
    "review",
  ];
}

export function getTransactionStepFields(
  step: Exclude<TransactionFormStep, "review">,
  type: JournalTransactionType | null,
): (keyof DailyIncomeJournalValues)[] {
  const fields = TRANSACTION_STEP_FIELDS[step];
  if (isExpensePaidByMethod(type)) {
    if (step === "amounts") return fields.filter((field) => field !== "sourceAccountId");
    if (step === "payment") return [...fields, "sourceAccountId"];
  }
  return step === "amounts" && isFixedCashTransactionType(type) ? [...fields, "description"] : fields;
}

export function getTransactionFieldStep(field: string, type: JournalTransactionType | null = null): Exclude<TransactionFormStep, "review"> {
  if (field === "sourceAccountId" && isExpensePaidByMethod(type)) return "payment";
  const step = (Object.keys(TRANSACTION_STEP_FIELDS) as Exclude<TransactionFormStep, "review">[])
    .find((entry) => TRANSACTION_STEP_FIELDS[entry].includes(field as keyof DailyIncomeJournalValues)) ?? "payment";
  return step === "payment" && !hasPaymentDetailsStep(type) ? "amounts" : step;
}

export function getTransactionStepLabelKey(step: TransactionFormStep, type: JournalTransactionType | null): string {
  if (step === "parties") return "accounting.dailyIncome.form.sections.customers";
  if (type === "INVENTORY" && step !== "review") {
    return `accounting.dailyIncome.form.sections.${step === "assignment" ? "inventoryMovement" : "inventoryAmounts"}`;
  }
  if (step === "amounts") {
    return `accounting.dailyIncome.form.sections.${type && ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type) ? "invoiceDetails" : "amounts"}`;
  }
  return `accounting.dailyIncome.wizard.workflow.${step}`;
}
