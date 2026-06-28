"use client";

import { Loader2, X } from "lucide-react";

import {
  RecordViewSheetBody,
  RecordViewSheetDetailRow,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAddressLine, formatPartyPhoneList } from "@/lib/customers/display";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoicePaidStatusLabel,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import { useInvoice } from "@/lib/invoices/hooks/use-invoices";
import { getOrderPartyAddress, type Invoice } from "@/lib/invoices/types";

type DeliveryInvoicePreviewSheetProps = {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PartyBlock({ title, party }: { title: string; party: Invoice["sender"] }) {
  const address = getOrderPartyAddress(party);

  return (
    <RecordViewSheetSection title={title} padding="relaxed">
      <p className="text-sm font-medium">{party.name || "—"}</p>
      {party.documentId ? <p className="mt-1 text-xs text-muted-foreground">Doc: {party.documentId}</p> : null}
      {party.email ? <p className="text-xs text-muted-foreground">{party.email}</p> : null}
      <p className="mt-2 text-xs font-medium text-primary">Phones</p>
      <p className="text-sm leading-relaxed">{formatPartyPhoneList(party.phones)}</p>
      <p className="mt-3 text-xs font-medium text-primary">Address</p>
      <p className="text-sm leading-relaxed">{address ? formatAddressLine(address) : "—"}</p>
    </RecordViewSheetSection>
  );
}

export function DeliveryInvoicePreviewSheet({
  invoiceId,
  open,
  onOpenChange,
}: DeliveryInvoicePreviewSheetProps) {
  const invoiceQuery = useInvoice(invoiceId, open && Boolean(invoiceId));
  const invoice = invoiceQuery.data ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[min(720px,92vw)] flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b bg-card px-6 pb-4 pt-6">
          <SheetHeader className="space-y-2 pr-10 text-left">
            <SheetTitle className="text-xl font-semibold">{invoice?.invoiceNumber ?? "Invoice preview"}</SheetTitle>
            <SheetDescription>
              {invoice
                ? `${formatInvoiceDate(invoice.date)} · ${getContainerLabelForInvoice(invoice)}`
                : "Review invoice details while selecting packages."}
            </SheetDescription>
          </SheetHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={() => onOpenChange(false)}
            aria-label="Close preview"
          >
            <X className="size-4" />
          </Button>
        </div>

        <RecordViewSheetBody>
          {invoiceQuery.isLoading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading invoice...
            </div>
          ) : invoiceQuery.isError ? (
            <p className="py-8 text-sm text-destructive">{normalizeApiError(invoiceQuery.error).message}</p>
          ) : invoice ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <RecordViewSheetDetailRow
                  label="Payment location"
                  value={getPaymentLocationLabel(invoice.paymentLocation)}
                />
                <RecordViewSheetDetailRow
                  label="Status"
                  value={
                    <Badge variant="outline" className="font-normal">
                      {getInvoicePaidStatusLabel(resolveInvoicePaidStatus(invoice))}
                    </Badge>
                  }
                />
                <RecordViewSheetDetailRow label="Subtotal" value={formatInvoiceMoney(getInvoiceSubtotal(invoice))} />
                <RecordViewSheetDetailRow label="Balance" value={formatInvoiceMoney(getInvoiceBalance(invoice))} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <PartyBlock title="Sender" party={invoice.sender} />
                <PartyBlock title="Receiver" party={invoice.receiver} />
              </div>

              <RecordViewSheetSection title="Line items" padding="relaxed" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Item</th>
                        <th className="py-2 pr-3 font-medium">Qty</th>
                        <th className="py-2 pr-3 font-medium">Labels</th>
                        <th className="py-2 pr-3 font-medium">Price</th>
                        <th className="py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 pr-3 align-top">
                            <p className="font-medium">{item.itemName}</p>
                            {item.description && item.description !== item.itemName ? (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3 align-top">{item.quantity}</td>
                          <td className="py-2.5 pr-3 align-top">{item.labelCount}</td>
                          <td className="py-2.5 pr-3 align-top">{formatInvoiceMoney(item.unitPrice)}</td>
                          <td className="py-2.5 text-right align-top font-medium">{formatInvoiceMoney(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </RecordViewSheetSection>
            </>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Invoice not found.</p>
          )}
        </RecordViewSheetBody>
      </SheetContent>
    </Sheet>
  );
}
