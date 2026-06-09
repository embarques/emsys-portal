"use client";

import { useMemo } from "react";

import { InvoiceActivitySection } from "@/components/invoices/invoice-activity-section";
import { InvoicePaymentsSection } from "@/components/invoices/invoice-payments-section";
import { InvoiceCommentsSection } from "@/components/invoices/invoice-comments-section";
import { InvoiceLabelActivitySection } from "@/components/invoices/invoice-label-activity-section";
import { InvoiceLabelStatusesSection } from "@/components/invoices/invoice-label-statuses-section";
import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAddressLine } from "@/lib/customers/display";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  formatLineItemSummary,
  getContainerLabel,
  getInvoiceBalance,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  truncateInvoiceId,
} from "@/lib/invoices/display";
import type { Invoice, InvoicePaymentInput } from "@/lib/invoices/types";
import { getOrderPartyAddress } from "@/lib/invoices/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";

type InvoiceViewSheetProps = {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onAddComment: (invoiceId: string, description: string) => void;
  onRecordPayment: (invoiceId: string, input: InvoicePaymentInput) => void;
};

function PartySection({ title, party }: { title: string; party: Invoice["sender"] }) {
  const address = getOrderPartyAddress(party);

  return (
    <RecordViewSheetSection title={title} padding="relaxed">
      <p className="text-sm font-medium">{party.name}</p>
      {party.documentId ? <p className="mt-1 text-xs text-muted-foreground">Doc: {party.documentId}</p> : null}
      {party.email ? <p className="text-xs text-muted-foreground">{party.email}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {party.phones
          .map((phone) => {
            const formatted = formatPhoneForDisplay(phone.number);
            return phone.label ? `${phone.label}: ${formatted}` : formatted;
          })
          .filter(Boolean)
          .join(" · ") || "—"}
      </p>
      <div className="mt-4">
        <p className="text-xs font-medium text-primary">Invoice address</p>
        <p className="mt-1 text-sm leading-relaxed">{address ? formatAddressLine(address) : "—"}</p>
      </div>
    </RecordViewSheetSection>
  );
}

export function InvoiceViewSheet({
  invoice,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onAddComment,
  onRecordPayment,
}: InvoiceViewSheetProps) {
  const totals = useMemo(() => {
    if (!invoice) return null;
    const subtotal = getInvoiceSubtotal(invoice);
    const balance = getInvoiceBalance(invoice);
    return { subtotal, balance };
  }, [invoice]);

  if (!invoice || !totals) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={invoice.invoiceNumber}
          description={formatInvoiceDate(invoice.date)}
          meta={
            <Badge className={getBranchBadgeClass(invoice.paymentLocation)}>
              {getPaymentLocationLabel(invoice.paymentLocation)}
            </Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Invoice">
            <RecordViewSheetDetailRow label="Invoice ID" value={truncateInvoiceId(invoice.invoiceId)} />
            <RecordViewSheetDetailRow label="Container" value={getContainerLabel(invoice.containerId)} />
            <RecordViewSheetDetailRow label="Paid at" value={getPaymentLocationLabel(invoice.paymentLocation)} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(invoice.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={invoice.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(invoice.updatedAt)} />
          </RecordViewSheetSection>

          <PartySection title="Sender" party={invoice.sender} />
          <PartySection title="Receiver" party={invoice.receiver} />

          <RecordViewSheetSection title={`Line items (${invoice.lineItems.length})`} padding="relaxed">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Item</th>
                    <th className="pb-3 pr-3 font-medium">Qty</th>
                    <th className="pb-3 pr-3 font-medium">Labels</th>
                    <th className="pb-3 pr-3 font-medium">Unit</th>
                    <th className="pb-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-3">{item.itemName}</td>
                      <td className="py-3 pr-3">{item.quantity}</td>
                      <td className="py-3 pr-3">{item.labelCount}</td>
                      <td className="py-3 pr-3">{formatInvoiceMoney(item.unitPrice)}</td>
                      <td className="py-3 text-right font-medium">{formatInvoiceMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {invoice.lineItems.map(formatLineItemSummary).join(" · ")}
            </p>
          </RecordViewSheetSection>

          <InvoiceLabelStatusesSection invoice={invoice} />
          <InvoiceLabelActivitySection invoice={invoice} />

          <InvoicePaymentsSection
            invoice={invoice}
            onRecordPayment={(input) => onRecordPayment(invoice.invoiceId, input)}
          />

          <RecordViewSheetSection title="Totals" padding="relaxed">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4 py-1">
                <span className="text-muted-foreground">Invoice total</span>
                <span className="font-medium">{formatInvoiceMoney(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">−{formatInvoiceMoney(invoice.discount)}</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-medium">−{formatInvoiceMoney(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border/60 pt-3 text-base font-semibold">
                <span>Balance left</span>
                <span>{formatInvoiceMoney(totals.balance)}</span>
              </div>
            </div>
          </RecordViewSheetSection>

          <InvoiceCommentsSection
            comments={invoice.comments}
            onAddComment={(description) => onAddComment(invoice.invoiceId, description)}
          />

          <InvoiceActivitySection invoice={invoice} />
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit invoice"
          onEdit={() => onEdit(invoice)}
          onDelete={() => onDelete(invoice)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
