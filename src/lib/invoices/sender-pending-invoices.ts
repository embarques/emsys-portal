import type { TranslateFn } from "@/lib/feedback/messages";
import { formatItemPrice } from "@/lib/items/display";
import { getInvoiceBalanceAmount, type Invoice, type InvoiceListParams } from "@/lib/invoices/types";

/** Upper bound on invoices loaded for a single sender's payment picker. */
export const SENDER_PENDING_INVOICES_LIMIT = 200;

/**
 * The API search allowlist has no `balance` field, so request the sender's invoices whose
 * paid status is not CLOSED (OPEN or PARTIAL) and drop zero balances client-side.
 */
export function buildSenderPendingInvoiceParams(senderId: string): InvoiceListParams {
  return {
    page: 1,
    limit: SENDER_PENDING_INVOICES_LIMIT,
    sort: "number:desc",
    filterRows: [
      { id: "sender-pending-sender", join: "and", field: "sender.id", operator: "eq", value: senderId },
      { id: "sender-pending-status", join: "and", field: "paidStatus", operator: "neq", value: "CLOSED" },
    ],
  };
}

export function selectInvoicesWithBalance(invoices: Invoice[]): Invoice[] {
  return invoices.filter((invoice) => getInvoiceBalanceAmount(invoice) > 0);
}

export function sumInvoiceBalances(invoices: Invoice[]): number {
  return Math.round(invoices.reduce((sum, invoice) => sum + getInvoiceBalanceAmount(invoice), 0) * 100) / 100;
}

/** Comment text listing the selected invoices with their balances (and the total for several). */
export function formatPendingInvoicesComment(invoices: Invoice[], t: TranslateFn): string {
  if (invoices.length === 0) return "";
  if (invoices.length === 1) {
    const [invoice] = invoices;
    return t("orders.comments.pendingInvoices.commentSingle", {
      number: invoice.invoiceNumber,
      balance: formatItemPrice(getInvoiceBalanceAmount(invoice)),
    });
  }
  const list = invoices
    .map((invoice) =>
      t("orders.comments.pendingInvoices.commentItem", {
        number: invoice.invoiceNumber,
        balance: formatItemPrice(getInvoiceBalanceAmount(invoice)),
      }),
    )
    .join(", ");
  return t("orders.comments.pendingInvoices.commentMultiple", {
    invoices: list,
    total: formatItemPrice(sumInvoiceBalances(invoices)),
  });
}

export function appendCommentText(existing: string, addition: string): string {
  const current = existing.trim();
  const next = addition.trim();
  if (!next) return existing;
  return current ? `${current} · ${next}` : next;
}
