import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { formatInvoiceMoney, getPaymentLocationLabel } from "@/lib/invoices/display";
import {
  computeInvoiceSubtotal,
  getInvoicePrimaryReceiver,
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

export function buildInvoiceCreatedActivities(
  invoice: Invoice,
  t: TranslateFn,
): InvoiceActivityEntry[] {
  const activities: InvoiceActivityEntry[] = [
    createInvoiceActivityEntry({
      invoiceId: invoice.invoiceId,
      action: "created",
      message: t("invoices.view.activity.messages.created", { number: invoice.invoiceNumber }),
      timestamp: invoice.createdAt,
      performedBy: invoice.createdBy,
    }),
  ];

  if (invoice.payments.length > 0) {
    let runningTotal = 0;
    invoice.payments.forEach((payment) => {
      runningTotal = Math.round((runningTotal + payment.amount) * 100) / 100;
      activities.push(buildPaymentRecordedActivity(payment, runningTotal, t));
    });
  } else if (invoice.amountPaid > 0) {
    activities.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "payment",
        message: t("invoices.view.activity.messages.initialPayment", {
          amount: formatInvoiceMoney(invoice.amountPaid),
        }),
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
        message: t("invoices.view.activity.messages.discountApplied", {
          amount: formatInvoiceMoney(invoice.discount),
        }),
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
  t: TranslateFn,
  performedBy = DEFAULT_CREATED_BY
): InvoiceActivityEntry[] {
  const timestamp = next.updatedAt;
  const entries: InvoiceActivityEntry[] = [];

  if (previous.discount !== next.discount) {
    entries.push(
      createInvoiceActivityEntry({
        invoiceId: next.invoiceId,
        action: "discount_change",
        message: t("invoices.view.activity.messages.discountUpdated", {
          from: formatInvoiceMoney(previous.discount),
          to: formatInvoiceMoney(next.discount),
        }),
        timestamp,
        performedBy,
      })
    );
  }

  const changedFields: string[] = [];

  if (previous.invoiceNumber !== next.invoiceNumber) {
    changedFields.push(t("invoices.view.activity.changes.invoiceNumber"));
  }
  if (previous.date !== next.date) changedFields.push(t("invoices.view.activity.changes.date"));
  if (previous.containerId !== next.containerId) {
    changedFields.push(
      t("invoices.view.activity.changes.container", {
        from: getContainerLabel(previous.containerId),
        to: getContainerLabel(next.containerId),
      })
    );
  }
  if (previous.paymentLocation !== next.paymentLocation) {
    changedFields.push(
      t("invoices.view.activity.changes.paymentLocation", {
        from: getPaymentLocationLabel(previous.paymentLocation),
        to: getPaymentLocationLabel(next.paymentLocation),
      })
    );
  }
  if (previous.sender.name !== next.sender.name) {
    changedFields.push(t("invoices.view.activity.changes.sender"));
  }
  const previousReceiver = getInvoicePrimaryReceiver(previous);
  const nextReceiver = getInvoicePrimaryReceiver(next);
  if ((previousReceiver?.name ?? "") !== (nextReceiver?.name ?? "")) {
    changedFields.push(t("invoices.view.activity.changes.receiver"));
  }

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
      t("invoices.view.activity.changes.lineItems", {
        fromCount: previous.lineItems.length,
        fromTotal: formatInvoiceMoney(previousSubtotal),
        toCount: next.lineItems.length,
        toTotal: formatInvoiceMoney(nextSubtotal),
      })
    );
  }

  if (changedFields.length > 0) {
    entries.push(
      createInvoiceActivityEntry({
        invoiceId: next.invoiceId,
        action: "updated",
        message: t("invoices.view.activity.messages.edited", { changes: changedFields.join("; ") }),
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
  timestamp: string,
  t: TranslateFn
): InvoiceActivityEntry {
  const preview =
    description.length > 120 ? `${description.slice(0, 117).trimEnd()}...` : description;

  return createInvoiceActivityEntry({
    invoiceId,
    action: "comment_added",
    message: t("invoices.view.activity.messages.commentAdded", { preview }),
    timestamp,
    performedBy,
  });
}

export function buildPaymentRecordedActivity(
  payment: InvoicePayment,
  invoiceTotalPaid: number,
  t: TranslateFn
): InvoiceActivityEntry {
  const reference = payment.referenceNumber
    ? t("invoices.view.activity.messages.paymentReference", { reference: payment.referenceNumber })
    : "";
  return createInvoiceActivityEntry({
    invoiceId: payment.invoiceId,
    action: "payment",
    message: t("invoices.view.activity.messages.paymentRecorded", {
      amount: formatInvoiceMoney(payment.amount),
      method: getPaymentMethodLabel(payment.paymentMethod, t),
      reference,
      description: payment.description,
      totalPaid: formatInvoiceMoney(invoiceTotalPaid),
    }),
    timestamp: payment.createdAt,
    performedBy: payment.createdBy,
  });
}

export function buildInvoiceActivityTimeline(
  invoice: Invoice,
  t: TranslateFn,
): InvoiceActivityEntry[] {
  if (invoice.activity.length > 0) {
    return [...invoice.activity].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  const synthetic: InvoiceActivityEntry[] = [
    createInvoiceActivityEntry({
      invoiceId: invoice.invoiceId,
      action: "created",
      message: t("invoices.view.activity.messages.created", { number: invoice.invoiceNumber }),
      timestamp: invoice.createdAt,
      performedBy: invoice.createdBy,
    }),
  ];

  if (invoice.amountPaid > 0 && invoice.payments.length === 0) {
    synthetic.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "payment",
        message: t("invoices.view.activity.messages.paymentOnRecord", {
          amount: formatInvoiceMoney(invoice.amountPaid),
        }),
        timestamp: invoice.updatedAt,
        performedBy: invoice.createdBy,
      })
    );
  }

  invoice.payments.forEach((payment) => {
    synthetic.push(buildPaymentRecordedActivity(payment, payment.amount, t));
  });

  invoice.comments.forEach((comment) => {
    const timestamp = comment.createdAt.trim() || invoice.createdAt;
    if (!timestamp) return;
    synthetic.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "comment_added",
        message: t("invoices.view.activity.messages.commentAdded", {
          preview:
            comment.description.length > 120
              ? `${comment.description.slice(0, 117).trimEnd()}...`
              : comment.description,
        }),
        timestamp,
        performedBy: comment.createdBy || invoice.createdBy,
      })
    );
  });

  if (invoice.updatedAt !== invoice.createdAt && synthetic.length === 1) {
    synthetic.push(
      createInvoiceActivityEntry({
        invoiceId: invoice.invoiceId,
        action: "updated",
        message: t("invoices.view.activity.messages.editedGeneric"),
        timestamp: invoice.updatedAt,
        performedBy: invoice.createdBy,
      })
    );
  }

  return synthetic.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function formatInvoiceActivityAction(
  action: InvoiceActivityAction,
  t: TranslateFn,
): string {
  switch (action) {
    case "created":
    case "updated":
    case "payment":
    case "discount_change":
    case "comment_added":
      return t(`invoices.view.activity.actions.${action}`);
    default:
      return action;
  }
}
