import type { DailyIncomeJournalValues, JournalTransactionType } from "./types";

export type TransactionFormStep = "assignment" | "amounts" | "payment" | "review";

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
  amounts: ["invoiceId", "invoiceNumber", "invoiceCost", "invoiceDiscount", "amount", "accountId", "sourceAccountId", "includeSender", "senderId", "includeReceiver", "receiverId", "inventoryItemId", "inventoryQuantity", "inventoryUnitPrice", "inventoryTotal", "autoReconcile"],
  payment: ["paymentMethodId", "paymentMethodName", "paymentAccountId", "paymentAccountType", "checkNumber", "autoClear", "externalReferenceNumber", "refNumberMode", "refNumber", "description"],
};

/**
 * Surcharges only add to the invoice total and expenses are paid from their source account, so both
 * skip payment details: the request always posts Cash with a system reference.
 */
export function hasPaymentDetailsStep(type: JournalTransactionType | null): boolean {
  return type !== "INVENTORY" && !isFixedCashTransactionType(type);
}

export function isFixedCashTransactionType(type: JournalTransactionType | null | undefined): boolean {
  return type === "SURCHARGE" || type === "EXPENSE";
}

export function getTransactionFormSteps(type: JournalTransactionType | null): TransactionFormStep[] {
  return hasPaymentDetailsStep(type) ? ["assignment", "amounts", "payment", "review"] : ["assignment", "amounts", "review"];
}

export function getTransactionStepFields(
  step: Exclude<TransactionFormStep, "review">,
  type: JournalTransactionType | null,
): (keyof DailyIncomeJournalValues)[] {
  const fields = TRANSACTION_STEP_FIELDS[step];
  return step === "amounts" && isFixedCashTransactionType(type) ? [...fields, "description"] : fields;
}

export function getTransactionFieldStep(field: string, type: JournalTransactionType | null = null): Exclude<TransactionFormStep, "review"> {
  const step = (Object.keys(TRANSACTION_STEP_FIELDS) as Exclude<TransactionFormStep, "review">[])
    .find((entry) => TRANSACTION_STEP_FIELDS[entry].includes(field as keyof DailyIncomeJournalValues)) ?? "payment";
  return step === "payment" && !hasPaymentDetailsStep(type) ? "amounts" : step;
}

export function getTransactionStepLabelKey(step: TransactionFormStep, type: JournalTransactionType | null): string {
  if (type === "INVENTORY" && step !== "review") {
    return `accounting.dailyIncome.form.sections.${step === "assignment" ? "inventoryMovement" : "inventoryAmounts"}`;
  }
  if (step === "amounts") {
    return `accounting.dailyIncome.form.sections.${type && ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type) ? "invoiceDetails" : "amounts"}`;
  }
  return `accounting.dailyIncome.wizard.workflow.${step}`;
}
