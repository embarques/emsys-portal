import { formatContainerLabel } from "@/lib/containers/display";
import { getContainerById } from "@/lib/containers/mock-data";
import { formatAddressLine } from "@/lib/customers/display";
import type { CustomerCoreAddress } from "@/lib/customers/types";
import { formatAddressLine as formatSnapshotAddressLine } from "@/lib/customers/utils/address-utils";
import { formatItemPrice } from "@/lib/items/display";
import { getOrderPartyAddress, type OrderParty } from "@/lib/orders/types";
import { getBranchLabel } from "@/lib/vehicles/display";

import type { Invoice, InvoiceLineItem, InvoicePaymentLocation, InvoicePaymentMethod } from "./types";
import { INVOICE_PAYMENT_METHODS, getInvoiceBalanceAmount, getInvoicePrimaryReceiver, getInvoiceTotal } from "./types";

export function getPaymentLocationLabel(location: InvoicePaymentLocation): string {
  return getBranchLabel(location);
}

export function getPaymentMethodLabel(method: InvoicePaymentMethod): string {
  return INVOICE_PAYMENT_METHODS.find((entry) => entry.value === method)?.label ?? method;
}

export function formatInvoiceTabLabel(invoice: Pick<Invoice, "invoiceNumber">): string {
  const number = invoice.invoiceNumber.trim();
  return number ? `#${number}` : "Invoice";
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
  return "font-medium tabular-nums text-blue-700 dark:text-blue-300";
}

export function getInvoiceDiscountMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "font-medium tabular-nums text-muted-foreground";
  }
  return "font-medium tabular-nums text-amber-700 dark:text-amber-300";
}

export function getInvoicePaidMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "font-medium tabular-nums text-muted-foreground";
  }
  return "font-medium tabular-nums text-emerald-700 dark:text-emerald-300";
}

export function getInvoiceBalanceMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "font-medium tabular-nums text-emerald-700 dark:text-emerald-300";
  }
  return "font-medium tabular-nums text-rose-700 dark:text-rose-300";
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

export function formatInvoicePartySummary(party: Invoice["sender"] | undefined): string {
  if (!party?.name?.trim()) return "—";
  const address = getOrderPartyAddress(party);
  const addressLine = address ? formatAddressLine(address) : "—";
  return `${party.name} · ${addressLine}`;
}

function orderPartyAddressToCore(
  address: NonNullable<ReturnType<typeof getOrderPartyAddress>>,
): CustomerCoreAddress {
  return {
    id: address.id,
    address1: address.streetAddress,
    apartment: address.apt ?? "",
    address2: address.crossStreet ?? "",
    city: address.city,
    state: address.state ?? "",
    zipcode: address.zipCode ?? "",
    country: address.provinceCountry ?? "",
    isPrimary: address.isPrimary,
    location: null,
    verification: null,
  };
}

/** Full snapshot address line for invoice table cells (matches pickup address formatting). */
export function formatInvoicePartyAddressLine(party: OrderParty | null | undefined): string {
  if (!party) return "—";

  const address = getOrderPartyAddress(party);
  if (!address) return "—";

  return formatSnapshotAddressLine(orderPartyAddressToCore(address), "full");
}

/** displayNumber is presentation-only; stored number remains the search/write value. */
export function getInvoicePartyDisplayPhone(party: Invoice["sender"]): string {
  const phone = party.phones.find((entry) => entry.displayNumber?.trim());
  return phone?.displayNumber?.trim() || "—";
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
    formatInvoicePartyAddressLine(invoice.sender),
    formatInvoicePartySummary(getInvoicePrimaryReceiver(invoice)),
    formatInvoicePartyAddressLine(getInvoicePrimaryReceiver(invoice)),
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
