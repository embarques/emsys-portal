import { isCheckPaymentMethod, requiresBankAccount } from "@/lib/accounting/daily-income/types";
import { createInventoryLineKey } from "@/lib/inventory/types/common";
import { dateTimeLocalToIso, toDateTimeLocalInput } from "@/lib/inventory/utils/date-time";
import { parseUsdToMinor } from "@/lib/inventory/utils/money";
import {
  readOutcomeQuantity,
  soldRevenueMinor,
  type ReconciliationFormValues,
  type ReconciliationLineFormValues,
  type ReconciliationPaymentFormValues,
} from "./schemas";
import {
  RECONCILIATION_OUTCOMES,
  type DamageResolution,
  type DispatchReconciliationInput,
  type PendingInventoryDispatch,
  type ReconciliationPaymentInput,
} from "./types";

/** One editable block per line that still has supplies in custody. */
export function createReconciliationForm(dispatch: PendingInventoryDispatch, now = toDateTimeLocalInput()): ReconciliationFormValues {
  return {
    occurredAt: now,
    notes: "",
    salesRecordedAtDispatch: dispatch.salesRecordedAtDispatch,
    // The API lists the daily-route supervisor first when there is one.
    incomeEmployeeId: dispatch.incomeRecipients[0]?.id ?? "",
    lines: dispatch.lines
      .filter((line) => line.outstandingQuantity > 0)
      .map((line) => ({
        dispatchLineId: line.id,
        itemName: line.item.name,
        outstanding: line.outstandingQuantity,
        SOLD: "", RETURNED: "", DAMAGED: "", LOST: "", MISSING: "", STOLEN: "",
        revenue: "",
        damageResolution: "",
      })),
    payments: [],
  };
}

export function createEmptyReconciliationPayment(): ReconciliationPaymentFormValues {
  return {
    key: createInventoryLineKey(),
    paymentMethodId: "",
    paymentMethodName: "",
    amount: "",
    paymentAccountId: "",
    checkNumber: "",
    externalReferenceNumber: "",
  };
}

/** Quantity entered so far for a line; invalid entries count as zero. */
export function accountedQuantity(line: ReconciliationLineFormValues): number {
  return RECONCILIATION_OUTCOMES.reduce((sum, outcome) => sum + (readOutcomeQuantity(line[outcome]) ?? 0), 0);
}

function buildPayment(payment: ReconciliationPaymentFormValues): ReconciliationPaymentInput {
  const checkNumber = payment.checkNumber.trim();
  const reference = payment.externalReferenceNumber.trim();
  const isCheck = isCheckPaymentMethod(payment.paymentMethodName);
  return {
    paymentMethod: { id: Number(payment.paymentMethodId), name: payment.paymentMethodName },
    amountMinor: parseUsdToMinor(payment.amount) ?? 0,
    ...(requiresBankAccount(payment.paymentMethodName) && payment.paymentAccountId
      ? { paymentAccountId: Number(payment.paymentAccountId) }
      : {}),
    ...(isCheck && checkNumber ? { paymentReference: checkNumber, checkNumber } : {}),
    ...(!isCheck && reference ? { externalReferenceNumber: reference } : {}),
  };
}

/** Flattens validated form values into the API command; zero quantities are omitted. */
export function buildReconciliationInput(values: ReconciliationFormValues, requestId: string): DispatchReconciliationInput {
  const collectsSales = !values.salesRecordedAtDispatch;
  const payments = collectsSales ? values.payments.map(buildPayment) : [];
  const hasRevenue = collectsSales && soldRevenueMinor(values.lines) > 0;
  return {
    requestId,
    occurredAt: dateTimeLocalToIso(values.occurredAt) ?? "",
    notes: values.notes.trim(),
    ...((payments.length || hasRevenue) && values.incomeEmployeeId ? { incomeEmployeeId: values.incomeEmployeeId } : {}),
    lines: values.lines.flatMap((line) => RECONCILIATION_OUTCOMES.flatMap((outcome) => {
      const quantity = readOutcomeQuantity(line[outcome]) ?? 0;
      if (quantity <= 0) return [];
      return [{
        dispatchLineId: line.dispatchLineId,
        outcome,
        quantity,
        ...(outcome === "SOLD" && collectsSales ? { revenueMinor: parseUsdToMinor(line.revenue) ?? 0 } : {}),
        ...(outcome === "DAMAGED" ? { damageResolution: line.damageResolution as DamageResolution } : {}),
      }];
    })),
    payments,
  };
}
