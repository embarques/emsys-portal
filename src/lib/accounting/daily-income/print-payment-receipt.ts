import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import type { ReportRequest } from "@/lib/reports/types";

export function canPrintPaymentReceipt(journal: Pick<DailyIncomeJournal, "transactionType">): boolean {
  return journal.transactionType === "PAYMENT" || journal.transactionType === "INITIAL-PAYMENT";
}

export function buildPaymentReceiptRequest(journal: Pick<DailyIncomeJournal, "id" | "transactionType">): ReportRequest {
  if (!canPrintPaymentReceipt(journal) || !/^[a-f0-9]{24}$/i.test(journal.id)) {
    throw new Error("Select a payment with a valid transaction identifier.");
  }
  return { type: "transaction", collection: "journals", values: [journal.id], lookupField: "id", format: "pdf" };
}
