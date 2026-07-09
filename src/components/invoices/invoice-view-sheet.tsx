"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Container } from "lucide-react";

import { InvoiceActivitySection } from "@/components/invoices/invoice-activity-section";
import { InvoiceBarcodeStatusSection } from "@/components/invoices/invoice-barcode-status-section";
import { InvoicePaymentsSection } from "@/components/invoices/invoice-payments-section";
import { InvoiceCommentsSection } from "@/components/invoices/invoice-comments-section";
import { InvoicePackageTrackerSection } from "@/components/invoices/invoice-package-tracker-section";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Badge } from "@/components/ui/badge";
import { getBarcodeStatusBadgeClass } from "@/lib/barcodes/display";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAddressLine, formatPartyPhoneList } from "@/lib/customers/display";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getContainerLabelForInvoice,
  getInvoiceBalance,
  getInvoicePaidStatusBadgeClass,
  getInvoicePaidStatusLabel,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  resolveInvoicePaidStatus,
} from "@/lib/invoices/display";
import type { Invoice, InvoiceLineItem, InvoicePaymentInput } from "@/lib/invoices/types";
import { getOrderPartyAddress } from "@/lib/invoices/types";
import { getBranchBadgeClass } from "@/lib/vehicles/display";
import { cn } from "@/lib/utils";

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
      <div className="mt-3">
        <p className="text-xs font-medium text-primary">Invoice phones</p>
        <p className="mt-1 text-sm leading-relaxed">{formatPartyPhoneList(party.phones)}</p>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-primary">Invoice address</p>
        <p className="mt-1 text-sm leading-relaxed">{address ? formatAddressLine(address) : "—"}</p>
      </div>
    </RecordViewSheetSection>
  );
}

function formatInvoiceDeduction(amount: number): string {
  if (!amount) return formatInvoiceMoney(0);
  return `−${formatInvoiceMoney(Math.abs(amount))}`;
}

function InvoiceTotalCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "balance";
}) {
  const isBalance = tone === "balance";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isBalance ? "border-primary/40 bg-primary/10" : "border-border/60 bg-background",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          isBalance ? "text-primary/80" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base tabular-nums",
          isBalance && "font-bold text-primary",
          tone === "positive" && "font-semibold text-emerald-600 dark:text-emerald-400",
          tone === "default" && "font-semibold text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatBarcodeScanDate(scanDate?: string): string {
  if (!scanDate) return "—";
  const parsed = new Date(scanDate);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function InvoiceLineItemRow({ item }: { item: InvoiceLineItem }) {
  const [open, setOpen] = useState(false);
  const barcodes = item.barcodes ?? [];
  const hasBarcodes = barcodes.length > 0;
  const showDescription = Boolean(item.description && item.description !== item.itemName);

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-3 pr-3 align-top">
          <div className="flex items-start gap-2">
            {hasBarcodes ? (
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={open ? "Hide barcodes" : "Show barcodes"}
                className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <span className="mt-0.5 inline-block size-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block">{item.itemName}</span>
              {showDescription ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
              ) : null}
              {hasBarcodes ? (
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  className="mt-0.5 text-xs text-primary hover:underline"
                >
                  {open ? "Hide" : "View"} {barcodes.length} barcode{barcodes.length === 1 ? "" : "s"}
                </button>
              ) : null}
            </span>
          </div>
        </td>
        <td className="py-3 pr-3 align-top">{item.quantity}</td>
        <td className="py-3 pr-3 align-top">{item.labelCount}</td>
        <td className="py-3 pr-3 align-top">{formatInvoiceMoney(item.unitPrice)}</td>
        <td className="py-3 text-right align-top font-medium">{formatInvoiceMoney(item.lineTotal)}</td>
      </tr>
      {hasBarcodes && open ? (
        <tr className="border-b border-border/50 last:border-0">
          <td colSpan={5} className="p-0">
            <div className="overflow-x-auto bg-muted/20">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">Barcode</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">Status</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">Container</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">Delivery</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left align-middle font-medium">Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {barcodes.map((barcode) => (
                    <tr key={barcode.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 align-middle font-mono text-xs" title={barcode.number}>
                        {barcode.number}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {barcode.statusName ? (
                          <TableTagText className={getBarcodeStatusBadgeClass(barcode.statusName)}>
                            {barcode.statusName}
                          </TableTagText>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-muted-foreground">
                        {barcode.containerName ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-muted-foreground">
                        {barcode.deliveryName ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-muted-foreground">
                        {formatBarcodeScanDate(barcode.scanDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      ) : null}
    </>
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

  const paidStatus = resolveInvoicePaidStatus(invoice);
  const containerLabel = getContainerLabelForInvoice(invoice);
  const hasContainer = containerLabel.trim() !== "" && containerLabel.trim() !== "—";

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span>{invoice.invoiceNumber}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatInvoiceDate(invoice.date)}
              </span>
            </span>
          }
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getBranchBadgeClass(invoice.paymentLocation)}>
                {getPaymentLocationLabel(invoice.paymentLocation)}
              </Badge>
              <Badge className={getInvoicePaidStatusBadgeClass(paidStatus)}>
                {getInvoicePaidStatusLabel(paidStatus)}
              </Badge>
              {hasContainer ? (
                <Badge variant="outline" className="gap-1.5">
                  <Container className="size-3" />
                  {containerLabel}
                </Badge>
              ) : null}
            </div>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Invoice">
            <RecordViewSheetDetailRow label="User created" value={invoice.createdBy} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(invoice.createdAt)} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(invoice.updatedAt)} />
            <div className="border-t border-border bg-muted/20 px-4 py-3.5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <InvoiceTotalCell label="Total" value={formatInvoiceMoney(totals.subtotal)} />
                <InvoiceTotalCell
                  label="Discount"
                  value={formatInvoiceDeduction(invoice.discount)}
                />
                <InvoiceTotalCell
                  label="Paid"
                  value={formatInvoiceDeduction(invoice.amountPaid)}
                  tone={invoice.amountPaid > 0 ? "positive" : "default"}
                />
                <InvoiceTotalCell
                  label="Balance"
                  value={formatInvoiceMoney(totals.balance)}
                  tone="balance"
                />
              </div>
            </div>
          </RecordViewSheetSection>

          <PartySection title="Sender" party={invoice.sender} />
          {invoice.receiver ? <PartySection title="Receiver" party={invoice.receiver} /> : null}

          <RecordViewSheetSection title={`Items (${invoice.lineItems.length})`} padding="relaxed">
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
                    <InvoiceLineItemRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </RecordViewSheetSection>

          <InvoiceCommentsSection
            comments={invoice.comments}
            onAddComment={(description) => onAddComment(invoice.invoiceId, description)}
          />

          <InvoicePaymentsSection
            invoice={invoice}
            onRecordPayment={(input) => onRecordPayment(invoice.invoiceId, input)}
          />

          <InvoiceBarcodeStatusSection invoice={invoice} />

          <InvoicePackageTrackerSection invoice={invoice} />

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
