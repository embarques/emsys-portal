import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import { formatInvoiceMoney, getPaymentLocationLabel } from "@/lib/invoices/display";
import {
  computeInvoiceSubtotal,
  type Invoice,
  type InvoiceActivityAction,
  type InvoiceActivityEntry,
  type InvoicePayment,
} from "@/lib/invoices/types";
import { getContainerLabel, getPaymentMethodLabel } from "@/lib/invoices/display";

export function createInvoiceActivityEntry(
  partial: Omit<InvoiceActivityEntry, "id" | "success"> & {
    success?: boolean;
  }
): InvoiceActivityEntry {
  return {
    id: createRecordId(),
    success: partial.success ?? true,
    ...partial,
  };
}

export function buildInvoiceCreatedActivities(invoice: Invoice): InvoiceActivityEntry[] {
  const activities: InvoiceActivityEntry[] = [
    createInvoiceActivityEntry({
      invoiceId: invoice.invoiceId,
      action: "created",
      message: `Invoice ${invoice.invoiceNumber} created.`,
      timestamp: invoice.createdAt,
      performedBy: invoice.createdBy,
    }),
  ];

  if (invoice.payments.length > 0) {
    let runningTotal = 0;
    invoice.payments.forEach((payment) => {
      runningTotal = Math.round((runningTotal + payment.amount) * 100) / 100;
      activities.push(buildPaymentRecordedActivity(payment, runningTotal));
    });
  } else if (invoice.amountPaid > 0) {
    activities.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "payment",
        message: `Initial payment of ${formatInvoiceMoney(invoice.amountPaid)} recorded.`,
        timestamp: invoice.createdAt,
        performedBy: invoice.createdBy,
      })
    );
  }

  if (invoice.discount > 0) {
    activities.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "discount_change",
        message: `Discount of ${formatInvoiceMoney(invoice.discount)} applied.`,
        timestamp: invoice.createdAt,
        performedBy: invoice.createdBy,
      })
    );
  }

  return activities;
}

export function buildInvoiceUpdateActivities(
  previous: Invoice,
  next: Invoice,
  performedBy = DEFAULT_CREATED_BY
): InvoiceActivityEntry[] {
  const timestamp = next.updatedAt;
  const entries: InvoiceActivityEntry[] = [];

  if (previous.discount !== next.discount) {
    entries.push(
      createInvoiceActivityEntry({
        invoiceId: next.invoiceId,
        action: "discount_change",
        message: `Discount updated: ${formatInvoiceMoney(previous.discount)} → ${formatInvoiceMoney(next.discount)}.`,
        timestamp,
        performedBy,
      })
    );
  }

  const changedFields: string[] = [];

  if (previous.invoiceNumber !== next.invoiceNumber) changedFields.push("invoice number");
  if (previous.date !== next.date) changedFields.push("invoice date");
  if (previous.containerId !== next.containerId) {
    changedFields.push(
      `container (${getContainerLabel(previous.containerId)} → ${getContainerLabel(next.containerId)})`
    );
  }
  if (previous.paymentLocation !== next.paymentLocation) {
    changedFields.push(
      `paid at (${getPaymentLocationLabel(previous.paymentLocation)} → ${getPaymentLocationLabel(next.paymentLocation)})`
    );
  }
  if (previous.sender.name !== next.sender.name) changedFields.push("sender");
  if (previous.receiver.name !== next.receiver.name) changedFields.push("receiver");

  const previousSubtotal = computeInvoiceSubtotal(previous.lineItems);
  const nextSubtotal = computeInvoiceSubtotal(next.lineItems);
  if (
    previous.lineItems.length !== next.lineItems.length ||
    previousSubtotal !== nextSubtotal ||
    previous.lineItems.some(
      (item, index) =>
        item.itemName !== next.lineItems[index]?.itemName ||
        item.quantity !== next.lineItems[index]?.quantity ||
        item.unitPrice !== next.lineItems[index]?.unitPrice ||
        item.labelCount !== next.lineItems[index]?.labelCount
    )
  ) {
    changedFields.push(
      `line items (${previous.lineItems.length} items / ${formatInvoiceMoney(previousSubtotal)} → ${next.lineItems.length} items / ${formatInvoiceMoney(nextSubtotal)})`
    );
  }

  if (changedFields.length > 0) {
    entries.push(
      createInvoiceActivityEntry({
        invoiceId: next.invoiceId,
        action: "updated",
        message: `Invoice edited: ${changedFields.join("; ")}.`,
        timestamp,
        performedBy,
      })
    );
  }

  return entries;
}

export function buildInvoiceCommentActivity(
  invoiceId: string,
  description: string,
  performedBy: string,
  timestamp: string
): InvoiceActivityEntry {
  const preview =
    description.length > 120 ? `${description.slice(0, 117).trimEnd()}...` : description;

  return createInvoiceActivityEntry({
    invoiceId,
    action: "comment_added",
    message: `Comment added: ${preview}`,
    timestamp,
    performedBy,
  });
}

export function buildPaymentRecordedActivity(
  payment: InvoicePayment,
  invoiceTotalPaid: number
): InvoiceActivityEntry {
  const reference = payment.referenceNumber ? ` Ref ${payment.referenceNumber}.` : "";
  return createInvoiceActivityEntry({
    invoiceId: payment.invoiceId,
    action: "payment",
    message: `Payment of ${formatInvoiceMoney(payment.amount)} via ${getPaymentMethodLabel(payment.paymentMethod)} recorded.${reference} ${payment.description} Total paid: ${formatInvoiceMoney(invoiceTotalPaid)}.`,
    timestamp: payment.createdAt,
    performedBy: payment.createdBy,
  });
}

export function buildInvoiceActivityTimeline(invoice: Invoice): InvoiceActivityEntry[] {
  if (invoice.activity.length > 0) {
    return [...invoice.activity].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  const synthetic: InvoiceActivityEntry[] = [
    createInvoiceActivityEntry({
      invoiceId: invoice.invoiceId,
      action: "created",
      message: `Invoice ${invoice.invoiceNumber} created.`,
      timestamp: invoice.createdAt,
      performedBy: invoice.createdBy,
    }),
  ];

  if (invoice.amountPaid > 0 && invoice.payments.length === 0) {
    synthetic.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "payment",
        message: `Payment of ${formatInvoiceMoney(invoice.amountPaid)} on record.`,
        timestamp: invoice.updatedAt,
        performedBy: invoice.createdBy,
      })
    );
  }

  invoice.payments.forEach((payment) => {
    synthetic.push(buildPaymentRecordedActivity(payment, payment.amount));
  });

  invoice.comments.forEach((comment) => {
    synthetic.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "comment_added",
        message: `Comment added: ${comment.description.length > 120 ? `${comment.description.slice(0, 117).trimEnd()}...` : comment.description}`,
        timestamp: comment.createdAt,
        performedBy: comment.createdBy,
      })
    );
  });

  if (invoice.updatedAt !== invoice.createdAt && synthetic.length === 1) {
    synthetic.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "updated",
        message: "Invoice edited.",
        timestamp: invoice.updatedAt,
        performedBy: invoice.createdBy,
      })
    );
  }

  return synthetic.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function formatInvoiceActivityAction(action: InvoiceActivityAction): string {
  switch (action) {
    case "created":
      return "Created";
    case "updated":
      return "Edited";
    case "payment":
      return "Payment";
    case "discount_change":
      return "Discount";
    case "comment_added":
      return "Comment";
    default:
      return action;
  }
}
