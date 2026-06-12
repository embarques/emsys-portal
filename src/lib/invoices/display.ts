import { formatContainerLabel } from "@/lib/containers/display";
import { getContainerById } from "@/lib/containers/mock-data";
import { formatItemPrice } from "@/lib/items/display";
import { getBranchLabel } from "@/lib/trucks/display";
import type { Invoice, InvoiceLineItem, InvoicePaymentLocation, InvoicePaymentMethod } from "./types";
import { INVOICE_PAYMENT_METHODS, getInvoiceBalanceAmount, getInvoiceTotal } from "./types";
import { getOrderPartyAddress } from "./types";
import { formatAddressLine } from "@/lib/customers/display";

export function getPaymentLocationLabel(location: InvoicePaymentLocation): string {
  return getBranchLabel(location);
}

export function getPaymentMethodLabel(method: InvoicePaymentMethod): string {
  return INVOICE_PAYMENT_METHODS.find((entry) => entry.value === method)?.label ?? method;
}

export function formatInvoiceDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatInvoiceCommentDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatInvoiceMoney(amount: number): string {
  return formatItemPrice(amount);
}

export function getInvoiceTotalMoneyClass(): string {
  return "inline-flex rounded-md border border-transparent bg-blue-500/15 px-2 py-0.5 font-medium tabular-nums text-blue-700 dark:text-blue-300";
}

export function getInvoiceDiscountMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "inline-flex rounded-md px-2 py-0.5 font-medium tabular-nums text-muted-foreground";
  }
  return "inline-flex rounded-md border border-transparent bg-amber-500/15 px-2 py-0.5 font-medium tabular-nums text-amber-700 dark:text-amber-300";
}

export function getInvoicePaidMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "inline-flex rounded-md px-2 py-0.5 font-medium tabular-nums text-muted-foreground";
  }
  return "inline-flex rounded-md border border-transparent bg-emerald-500/15 px-2 py-0.5 font-medium tabular-nums text-emerald-700 dark:text-emerald-300";
}

export function getInvoiceBalanceMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "inline-flex rounded-md border border-transparent bg-emerald-500/15 px-2 py-0.5 font-medium tabular-nums text-emerald-700 dark:text-emerald-300";
  }
  return "inline-flex rounded-md border border-transparent bg-rose-500/15 px-2 py-0.5 font-medium tabular-nums text-rose-700 dark:text-rose-300";
}

export type InvoicePaidStatusView = "closed" | "open";

export function resolveInvoicePaidStatus(invoice: Invoice): InvoicePaidStatusView {
  const raw = invoice.paidStatus?.trim().toUpperCase();
  if (raw === "CLOSED") return "closed";
  if (raw === "OPEN" || raw === "PARTIAL") return "open";
  return getInvoiceBalanceAmount(invoice) <= 0 ? "closed" : "open";
}

export function getInvoicePaidStatusLabel(status: InvoicePaidStatusView): string {
  return status === "closed" ? "Closed" : "Open";
}

export function getInvoicePaidStatusBadgeClass(status: InvoicePaidStatusView): string {
  return status === "closed"
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function truncateInvoiceId(invoiceId: string): string {
  return invoiceId.length > 12 ? `${invoiceId.slice(0, 8)}…` : invoiceId;
}

export function getContainerLabel(containerId: string): string {
  const container = getContainerById(containerId);
  if (!container) return "Unknown container";
  return formatContainerLabel(container);
}

export function getContainerLabelForInvoice(
  invoice: Pick<Invoice, "containerId" | "containerName">,
): string {
  if (invoice.containerName?.trim()) {
    return invoice.containerName.trim();
  }
  if (invoice.containerId.trim()) {
    return getContainerLabel(invoice.containerId);
  }
  return "—";
}

export function formatInvoicePartySummary(party: Invoice["sender"]): string {
  const address = getOrderPartyAddress(party);
  const addressLine = address ? formatAddressLine(address) : "—";
  return `${party.name} · ${addressLine}`;
}

export function formatLineItemSummary(item: InvoiceLineItem): string {
  return `${item.itemName} × ${item.quantity} @ ${formatInvoiceMoney(item.unitPrice)} = ${formatInvoiceMoney(item.lineTotal)}`;
}

export function formatInvoiceLineItemsSummary(invoice: Invoice, limit = 2): string {
  if (invoice.lineItems.length === 0) return "—";
  const visible = invoice.lineItems.slice(0, limit).map((item) => item.itemName);
  const suffix = invoice.lineItems.length > limit ? ` (+${invoice.lineItems.length - limit})` : "";
  return `${visible.join(", ")}${suffix}`;
}

export function getInvoiceSubtotal(invoice: Invoice): number {
  return getInvoiceTotal(invoice);
}

export function getInvoiceBalance(invoice: Invoice): number {
  return getInvoiceBalanceAmount(invoice);
}

export function invoiceMatchesQuery(invoice: Invoice, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    invoice.invoiceId,
    invoice.invoiceNumber,
    invoice.date,
    getPaymentLocationLabel(invoice.paymentLocation),
    getInvoicePaidStatusLabel(resolveInvoicePaidStatus(invoice)),
    getContainerLabelForInvoice(invoice),
    formatInvoicePartySummary(invoice.sender),
    formatInvoicePartySummary(invoice.receiver),
    invoice.lineItems.map(formatLineItemSummary).join(" "),
    invoice.comments.map((comment) => comment.description).join(" "),
    invoice.comments.map((comment) => comment.createdBy).join(" "),
    formatInvoiceMoney(getInvoiceSubtotal(invoice)),
    formatInvoiceMoney(getInvoiceBalance(invoice)),
    invoice.createdBy,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeInvoiceKpis(invoices: Invoice[]) {
  const outstanding = invoices.reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0);
  const collected = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);

  return {
    total: invoices.length,
    outstanding,
    collected,
  };
}
