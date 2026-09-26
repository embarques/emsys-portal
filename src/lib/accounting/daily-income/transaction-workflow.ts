import type { DailyIncomeJournalValues, JournalTransactionType } from "./types";

export type TransactionFormStep = "assignment" | "amounts" | "payment" | "review";

export const TRANSACTION_STEP_FIELDS: Record<Exclude<TransactionFormStep, "review">, (keyof DailyIncomeJournalValues)[]> = {
  assignment: ["employeeId", "routeId", "inventoryDirection", "inventorySupplierId"],
  amounts: ["invoiceId", "invoiceNumber", "invoiceCost", "invoiceDiscount", "amount", "accountId", "sourceAccountId", "includeSender", "senderId", "includeReceiver", "receiverId", "inventoryItemId", "inventoryQuantity", "inventoryUnitPrice", "inventoryTotal"],
  payment: ["paymentMethodId", "paymentMethodName", "paymentAccountId", "paymentAccountType", "checkNumber", "externalReferenceNumber", "refNumberMode", "refNumber", "description"],
};

export function getTransactionFormSteps(type: JournalTransactionType | null): TransactionFormStep[] {
  return type === "INVENTORY" ? ["assignment", "amounts", "review"] : ["assignment", "amounts", "payment", "review"];
}

export function getTransactionFieldStep(field: string): Exclude<TransactionFormStep, "review"> {
  return (Object.keys(TRANSACTION_STEP_FIELDS) as Exclude<TransactionFormStep, "review">[])
    .find((step) => TRANSACTION_STEP_FIELDS[step].includes(field as keyof DailyIncomeJournalValues)) ?? "payment";
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
