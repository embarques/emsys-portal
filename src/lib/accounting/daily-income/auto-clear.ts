import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";
import { toApiPaymentMethodName, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

/** Same grant that allows Mark cleared in the matching clearing directory. */
const AUTO_CLEAR_PERMISSIONS: Record<string, Permission> = {
  CHECK: PERMISSIONS.checksUpdate,
  ZELLE: PERMISSIONS.zellePaymentsUpdate,
  DEPOSIT: PERMISSIONS.depositsUpdate,
  "CREDIT-CARD": PERMISSIONS.creditCardPaymentsUpdate,
};

export function getAutoClearPermission(paymentMethodName?: string | null): Permission | undefined {
  return AUTO_CLEAR_PERMISSIONS[toApiPaymentMethodName(paymentMethodName)];
}

/** Invoice payments by check / Zelle / deposit / card create an outstanding record the API can clear on create. */
export function isAutoClearEligible(
  values: Pick<DailyIncomeJournalValues, "transactionType" | "amount" | "paymentMethodName">,
): boolean {
  const isInvoicePayment = values.transactionType === "INITIAL-PAYMENT" || values.transactionType === "PAYMENT";
  return isInvoicePayment && (Number(values.amount) || 0) > 0 && Boolean(getAutoClearPermission(values.paymentMethodName));
}
