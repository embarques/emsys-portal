import { z } from "zod";

import { isCheckPaymentMethod, requiresBankAccount } from "@/lib/accounting/daily-income/types";
import { dateTimeLocalToIso } from "@/lib/inventory/utils/date-time";
import { parseUsdToMinor, parseWholeQuantity } from "@/lib/inventory/utils/money";
import { DAMAGE_RESOLUTIONS, LOSS_OUTCOMES, RECONCILIATION_OUTCOMES } from "./types";

/** Issue messages are i18n keys under `accounting.pendingInventory.errors`. */
const ERRORS = "accounting.pendingInventory.errors";

const lineSchema = z.object({
  dispatchLineId: z.string().min(1),
  itemName: z.string(),
  outstanding: z.number().int().nonnegative(),
  SOLD: z.string(),
  RETURNED: z.string(),
  DAMAGED: z.string(),
  LOST: z.string(),
  MISSING: z.string(),
  STOLEN: z.string(),
  revenue: z.string(),
  damageResolution: z.string(),
});

const paymentSchema = z.object({
  key: z.string(),
  /** Accounting payment method id as text ("" until chosen). */
  paymentMethodId: z.string(),
  paymentMethodName: z.string(),
  amount: z.string(),
  /** Bank chart account id as text; required for non-cash methods. */
  paymentAccountId: z.string(),
  /** Paper check number; kept as text so leading zeros survive. */
  checkNumber: z.string(),
  externalReferenceNumber: z.string(),
});

export function readOutcomeQuantity(value: string): number | null {
  return value.trim() === "" ? 0 : parseWholeQuantity(value, { allowZero: true });
}

/** Sale revenue entered so far, in cents; invalid entries count as zero. */
export function soldRevenueMinor(lines: { SOLD: string; revenue: string }[]): number {
  return lines.reduce((sum, line) => ((readOutcomeQuantity(line.SOLD) ?? 0) > 0 ? sum + (parseUsdToMinor(line.revenue) ?? 0) : sum), 0);
}

export function paymentsTotalMinor(payments: { amount: string }[]): number {
  return payments.reduce((sum, payment) => sum + (parseUsdToMinor(payment.amount) ?? 0), 0);
}

export const reconciliationFormSchema = z.object({
  occurredAt: z.string(),
  notes: z.string().max(1000),
  /** Sales were posted at dispatch time; revenue and payments are not collected again. */
  salesRecordedAtDispatch: z.boolean(),
  incomeEmployeeId: z.string(),
  lines: z.array(lineSchema),
  payments: z.array(paymentSchema),
}).superRefine((values, context) => {
  if (!dateTimeLocalToIso(values.occurredAt)) {
    context.addIssue({ code: "custom", path: ["occurredAt"], message: `${ERRORS}.occurredAt` });
  }
  let total = 0;
  let hasLoss = false;
  values.lines.forEach((line, index) => {
    let accounted = 0;
    for (const outcome of RECONCILIATION_OUTCOMES) {
      const quantity = readOutcomeQuantity(line[outcome]);
      if (quantity === null) {
        context.addIssue({ code: "custom", path: ["lines", index, outcome], message: `${ERRORS}.quantity` });
      } else {
        accounted += quantity;
        if (quantity > 0 && (LOSS_OUTCOMES as readonly string[]).includes(outcome)) hasLoss = true;
      }
    }
    total += accounted;
    if (accounted > line.outstanding) {
      context.addIssue({ code: "custom", path: ["lines", index, "outstanding"], message: `${ERRORS}.exceeds` });
    }
    if (!values.salesRecordedAtDispatch && (readOutcomeQuantity(line.SOLD) ?? 0) > 0 && parseUsdToMinor(line.revenue) === null) {
      context.addIssue({ code: "custom", path: ["lines", index, "revenue"], message: `${ERRORS}.revenue` });
    }
    if ((readOutcomeQuantity(line.DAMAGED) ?? 0) > 0 && !(DAMAGE_RESOLUTIONS as readonly string[]).includes(line.damageResolution)) {
      context.addIssue({ code: "custom", path: ["lines", index, "damageResolution"], message: `${ERRORS}.resolution` });
    }
  });
  if (total === 0) {
    context.addIssue({ code: "custom", path: ["lines"], message: `${ERRORS}.nothing` });
  }
  if (hasLoss && !values.notes.trim()) {
    context.addIssue({ code: "custom", path: ["notes"], message: `${ERRORS}.notesRequired` });
  }
  if (values.salesRecordedAtDispatch) return;

  values.payments.forEach((payment, index) => {
    if (!payment.paymentMethodId) {
      context.addIssue({ code: "custom", path: ["payments", index, "paymentMethodId"], message: `${ERRORS}.paymentMethod` });
    }
    const amount = parseUsdToMinor(payment.amount);
    if (amount === null || amount <= 0) {
      context.addIssue({ code: "custom", path: ["payments", index, "amount"], message: `${ERRORS}.paymentAmount` });
    }
    if (payment.paymentMethodId && requiresBankAccount(payment.paymentMethodName) && !payment.paymentAccountId) {
      context.addIssue({ code: "custom", path: ["payments", index, "paymentAccountId"], message: `${ERRORS}.paymentAccount` });
    }
    if (isCheckPaymentMethod(payment.paymentMethodName) && !payment.checkNumber.trim()) {
      context.addIssue({ code: "custom", path: ["payments", index, "checkNumber"], message: `${ERRORS}.checkNumber` });
    }
  });
  const revenue = soldRevenueMinor(values.lines);
  const paid = paymentsTotalMinor(values.payments);
  if (paid > revenue) {
    context.addIssue({ code: "custom", path: ["payments"], message: `${ERRORS}.paymentExceeds` });
  }
  if ((revenue > 0 || values.payments.length > 0) && !values.incomeEmployeeId) {
    context.addIssue({ code: "custom", path: ["incomeEmployeeId"], message: `${ERRORS}.incomeEmployee` });
  }
  if (revenue > paid && !hasLoss && !values.notes.trim()) {
    context.addIssue({ code: "custom", path: ["notes"], message: `${ERRORS}.creditNotesRequired` });
  }
});

/** Sale revenue not paid yet; it becomes a collection obligation for the income recipient. */
export function creditMinor(values: Pick<ReconciliationFormValues, "lines" | "payments" | "salesRecordedAtDispatch">): number {
  if (values.salesRecordedAtDispatch) return 0;
  return Math.max(0, soldRevenueMinor(values.lines) - paymentsTotalMinor(values.payments));
}

export type ReconciliationFormValues = z.infer<typeof reconciliationFormSchema>;
export type ReconciliationLineFormValues = ReconciliationFormValues["lines"][number];
export type ReconciliationPaymentFormValues = ReconciliationFormValues["payments"][number];
