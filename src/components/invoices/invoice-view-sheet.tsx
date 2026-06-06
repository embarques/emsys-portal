"use client";

import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { InvoiceActivitySection } from "@/components/invoices/invoice-activity-section";
import { InvoicePaymentsSection } from "@/components/invoices/invoice-payments-section";
import { InvoiceCommentsSection } from "@/components/invoices/invoice-comments-section";
import { InvoiceLabelActivitySection } from "@/components/invoices/invoice-label-activity-section";
import { InvoiceLabelStatusesSection } from "@/components/invoices/invoice-label-statuses-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAddressLine } from "@/lib/customers/display";
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function PartySection({ title, party }: { title: string; party: Invoice["sender"] }) {
  const address = getOrderPartyAddress(party);

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm font-medium">{party.name}</p>
      {party.documentId ? <p className="text-xs text-muted-foreground">Doc: {party.documentId}</p> : null}
      {party.email ? <p className="text-xs text-muted-foreground">{party.email}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {party.phones.map((phone) => (phone.label ? `${phone.label}: ${phone.number}` : phone.number)).join(" · ") ||
          "—"}
      </p>
      <div className="mt-3">
        <p className="text-xs font-medium text-primary">Invoice address</p>
        <p className="mt-1 text-sm">{address ? formatAddressLine(address) : "—"}</p>
      </div>
    </div>
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{invoice.invoiceNumber}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span>{formatInvoiceDate(invoice.date)}</span>
            <Badge className={getBranchBadgeClass(invoice.paymentLocation)}>
              {getPaymentLocationLabel(invoice.paymentLocation)}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Invoice ID" value={truncateInvoiceId(invoice.invoiceId)} />
            <DetailRow label="Container" value={getContainerLabel(invoice.containerId)} />
            <DetailRow label="Paid at" value={getPaymentLocationLabel(invoice.paymentLocation)} />
            <DetailRow label="Date created" value={formatAuditDate(invoice.createdAt)} />
            <DetailRow label="User created" value={invoice.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(invoice.updatedAt)} />
          </div>

          <PartySection title="Sender" party={invoice.sender} />
          <PartySection title="Receiver" party={invoice.receiver} />

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description ({invoice.lineItems.length} items)
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Item</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Labels</th>
                    <th className="pb-2 pr-2 font-medium">Unit</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{item.itemName}</td>
                      <td className="py-2 pr-2">{item.quantity}</td>
                      <td className="py-2 pr-2">{item.labelCount}</td>
                      <td className="py-2 pr-2">{formatInvoiceMoney(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatInvoiceMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {invoice.lineItems.map(formatLineItemSummary).join(" · ")}
            </p>
          </div>

          <InvoiceLabelStatusesSection invoice={invoice} />

          <InvoiceLabelActivitySection invoice={invoice} />

          <InvoicePaymentsSection
            invoice={invoice}
            onRecordPayment={(input) => onRecordPayment(invoice.invoiceId, input)}
          />

          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Invoice total</span>
              <span className="font-medium">{formatInvoiceMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-medium">−{formatInvoiceMoney(invoice.discount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="font-medium">−{formatInvoiceMoney(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Balance left</span>
              <span>{formatInvoiceMoney(totals.balance)}</span>
            </div>
          </div>

          <InvoiceCommentsSection
            comments={invoice.comments}
            onAddComment={(description) => onAddComment(invoice.invoiceId, description)}
          />

          <InvoiceActivitySection invoice={invoice} />

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(invoice)}>
              <Pencil className="h-4 w-4" />
              Edit invoice
            </Button>
            <Button variant="destructive" onClick={() => onDelete(invoice)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
