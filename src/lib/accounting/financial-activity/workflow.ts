import type { ActivityEvent, FinancialActivity } from "./api";
import { toApiPaymentMethodName } from "../daily-income/types";

/** Lifecycle, stock and loan corrections must use their domain workflows. */
export function canReverseFinancialActivity(row: FinancialActivity): boolean {
  return Boolean(row.journalId) && ["PAYMENT", "EXPENSE", "SALES", "TRANSFER", "DISCOUNT", "SURCHARGE"].includes(row.transactionType);
}

export function pendingHandovers(events: ActivityEvent[]): ActivityEvent[] {
  return events.filter(event => event.type === "HANDED_OVER" && !events.some(other =>
    other.handoverId === event.id && (other.type === "VERIFIED" || other.type === "REJECTED"),
  ));
}

export function reconciliationActions(row: FinancialActivity, events: ActivityEvent[]): string[] {
  if (!row.journalId || events.some(event => event.type === "REVERSED")) return [];
  if (row.transactionType === "EXPENSE" || row.transactionType === "REFUND") return ["VERIFIED"];
  if (toApiPaymentMethodName(row.paymentMethod?.name) !== "CASH") return [];
  return ["HANDED_OVER", ...(pendingHandovers(events).length ? ["VERIFIED", "REJECTED"] : [])];
}
