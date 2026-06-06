import { getContainerById } from "@/lib/containers/mock-data";
import { formatItemPrice } from "@/lib/items/display";
import { getBranchLabel } from "@/lib/trucks/display";
import type { Invoice, InvoiceLineItem, InvoicePaymentLocation, InvoicePaymentMethod } from "./types";
import { INVOICE_PAYMENT_METHODS } from "./types";
import { computeInvoiceBalance, computeInvoiceSubtotal, getOrderPartyAddress } from "./types";
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

export function truncateInvoiceId(invoiceId: string): string {
  return invoiceId.length > 12 ? `${invoiceId.slice(0, 8)}…` : invoiceId;
}

export function getContainerLabel(containerId: string): string {
  const container = getContainerById(containerId);
  if (!container) return "Unknown container";
  return `${container.containerCode} · ${container.containerNumber}`;
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
  return computeInvoiceSubtotal(invoice.lineItems);
}

export function getInvoiceBalance(invoice: Invoice): number {
  return computeInvoiceBalance(getInvoiceSubtotal(invoice), invoice.discount, invoice.amountPaid);
}

export function invoiceMatchesQuery(invoice: Invoice, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    invoice.invoiceId,
    invoice.invoiceNumber,
    invoice.date,
    getPaymentLocationLabel(invoice.paymentLocation),
    getContainerLabel(invoice.containerId),
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
