import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { InvoicePayment, InvoicePaymentMethod } from "@/lib/invoices/types";

const PAYMENT_METHOD_ALIASES: Array<{ match: string; method: InvoicePaymentMethod }> = [
  { match: "cash", method: "cash" },
  { match: "cheque", method: "check" },
  { match: "check", method: "check" },
  { match: "credit", method: "credit_card" },
  { match: "debit", method: "debit_card" },
  { match: "wire", method: "wire_transfer" },
  { match: "zelle", method: "zelle" },
  { match: "ach", method: "ach" },
];

export function mapJournalPaymentMethod(name?: string): InvoicePaymentMethod {
  const normalized = name?.trim().toLowerCase() ?? "";
  if (!normalized) return "other";
  const alias = PAYMENT_METHOD_ALIASES.find((entry) => normalized.includes(entry.match));
  return alias?.method ?? "other";
}

export function mapJournalToInvoicePayment(
  journal: DailyIncomeJournal,
  invoiceId: string,
): InvoicePayment | null {
  if (journal.amount <= 0) return null;

  return {
    id: journal.id,
    invoiceId,
    description:
      journal.description.trim() ||
      (journal.transactionType === "INITIAL-PAYMENT" ? "Initial payment" : "Payment"),
    amount: journal.amount,
    paymentMethod: mapJournalPaymentMethod(journal.paymentMethod?.name),
    referenceNumber: journal.checkNumber?.trim() || journal.refNumber.trim(),
    createdAt: journal.createdAt?.trim() || (journal.date ? `${journal.date}T12:00:00.000Z` : ""),
    createdBy: journal.employee?.name?.trim() || DEFAULT_CREATED_BY,
  };
}

export function mapInvoiceJournalsToPayments(
  journals: DailyIncomeJournal[],
  invoiceId: string,
): InvoicePayment[] {
  return journals
    .map((journal) => mapJournalToInvoicePayment(journal, invoiceId))
    .filter((payment): payment is InvoicePayment => payment != null);
}
