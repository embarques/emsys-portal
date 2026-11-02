import { PERMISSIONS } from "@/lib/auth/permissions";
import type { DailyIncomeJournalValues } from "./types";

/** Approval uses the explicit journal grant for every method and transaction type. */
export function getAutoClearPermission() {
  return PERMISSIONS.journalsReconcile;
}
export function isAutoClearEligible(values: Pick<DailyIncomeJournalValues, "transactionType" | "amount" | "paymentMethodName">): boolean {
  return Boolean(values.transactionType);
}
