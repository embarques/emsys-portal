import { fetchChecks } from "@/lib/accounting/checks/api/checks-api";
import { fetchClearablePayments } from "@/lib/accounting/clearable-payments/api";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { TableFilterRowState } from "@/lib/table/filter-types";

export type PendingPaymentMethod = "CHECK" | "ZELLE" | "DEPOSIT" | "CREDIT-CARD";

/** A non-cash invoice payment that does not reduce the balance until cleared. */
export type DeliveryPendingPayment = {
  id: string;
  method: PendingPaymentMethod;
  reference: string;
  amount: number;
  datePosted: string;
};

const LIMIT = 100;

function outstandingForInvoice(invoiceNumber: string): TableFilterRowState[] {
  return [
    { id: "status", join: "and", field: "status", operator: "eq", value: "OUTSTANDING" },
    { id: "invoice", join: "and", field: "invoice.number", operator: "eq", value: invoiceNumber },
  ];
}

const CLEARABLE_ENDPOINTS: Record<Exclude<PendingPaymentMethod, "CHECK">, string> = {
  ZELLE: API_ENDPOINTS.ACCOUNTING_ZELLE_PAYMENTS,
  DEPOSIT: API_ENDPOINTS.ACCOUNTING_DEPOSITS,
  "CREDIT-CARD": API_ENDPOINTS.ACCOUNTING_CREDIT_CARD_PAYMENTS,
};

/**
 * Outstanding (uncleared) check / Zelle / deposit / card payments for one invoice,
 * read only from the clearing directories the caller may list.
 */
export async function fetchInvoicePendingPayments(
  invoice: { invoiceId: string; invoiceNumber: string },
  methods: readonly PendingPaymentMethod[],
): Promise<DeliveryPendingPayment[]> {
  const invoiceNumber = invoice.invoiceNumber.trim();
  if (!invoiceNumber || methods.length === 0) return [];
  const params = { page: 1, limit: LIMIT, filterRows: outstandingForInvoice(invoiceNumber) };
  const sameInvoice = (ref: { id: string; number: string }) =>
    (ref.id ? ref.id === invoice.invoiceId : true) && (ref.number ? ref.number === invoiceNumber : true);

  const groups = await Promise.all(methods.map(async (method): Promise<DeliveryPendingPayment[]> => {
    if (method === "CHECK") {
      const page = await fetchChecks(params);
      return page.items
        .filter((check) => check.status === "OUTSTANDING" && sameInvoice(check.invoice))
        .map((check) => ({ id: check.id, method, reference: check.checkNumber, amount: check.paymentAmount, datePosted: check.datePosted }));
    }
    const page = await fetchClearablePayments(CLEARABLE_ENDPOINTS[method], params);
    return page.items
      .filter((payment) => payment.status === "OUTSTANDING" && sameInvoice(payment.invoice))
      .map((payment) => ({ id: payment.id, method, reference: payment.paymentReference, amount: payment.paymentAmount, datePosted: payment.datePosted }));
  }));
  return groups.flat().filter((payment) => Number.isFinite(payment.amount) && payment.amount > 0);
}

export function sumPendingPayments(payments: readonly DeliveryPendingPayment[]): number {
  return Math.round(payments.reduce((total, payment) => total + payment.amount, 0) * 100) / 100;
}
