"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatAccountingCategory,
  formatAccountingDate,
  formatAccountingMoney,
  getAccountingBranchBadgeClass,
  getAccountingBranchLabel,
  getAccountingEntryTypeBadgeClass,
  getAccountingEntryTypeLabel,
  getNewInvoicePaymentBalance,
  getPaymentMethodLabel,
  truncateAccountingEntryId,
} from "@/lib/accounting/display";
import { getRouteAssignmentLabel } from "@/lib/orders/display";
import type { AccountingEntry } from "@/lib/accounting/types";

type AccountingEntryViewSheetProps = {
  entry: AccountingEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (entry: AccountingEntry) => void;
  onDelete: (entry: AccountingEntry) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function AccountingEntryViewSheet({
  entry,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: AccountingEntryViewSheetProps) {
  if (!entry) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{formatAccountingMoney(entry.amount)}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <Badge className={getAccountingEntryTypeBadgeClass(entry.type)}>
              {getAccountingEntryTypeLabel(entry.type)}
            </Badge>
            <Badge className={getAccountingBranchBadgeClass(entry.branch)}>
              {getAccountingBranchLabel(entry.branch)}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Entry ID" value={truncateAccountingEntryId(entry.entryId)} />
            <DetailRow label="Date" value={formatAccountingDate(entry.date)} />
            <DetailRow label="Description" value={entry.description} />
            <DetailRow label="Amount" value={formatAccountingMoney(entry.amount)} />
            <DetailRow
              label="Route assignment"
              value={getRouteAssignmentLabel(entry.routeAssignmentId)}
            />
          </div>

          {entry.invoiceNumber ? (
            <div className="rounded-xl border bg-muted/20 px-4">
              <DetailRow label="Invoice" value={entry.invoiceNumber} />
              {entry.type === "invoice_discount" ? (
                <DetailRow
                  label="Receipt number"
                  value={entry.receiptNumber ?? entry.referenceNumber ?? "—"}
                />
              ) : null}
              {entry.type === "invoice_discount" ? (
                <DetailRow label="Discount" value={formatAccountingMoney(entry.amount)} />
              ) : null}
              {entry.type === "invoice_payment_new" && entry.invoiceTotal !== undefined ? (
                <DetailRow label="Total" value={formatAccountingMoney(entry.invoiceTotal)} />
              ) : null}
              {entry.type === "invoice_payment_new" ? (
                <DetailRow
                  label="Amount paid"
                  value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
                />
              ) : null}
              {entry.type === "invoice_payment_new" ? (
                <DetailRow label="Balance" value={formatAccountingMoney(getNewInvoicePaymentBalance(entry))} />
              ) : null}
              {entry.type === "invoice_payment_existing" ? (
                <DetailRow
                  label="Receipt number"
                  value={entry.receiptNumber ?? entry.referenceNumber ?? "—"}
                />
              ) : null}
              {entry.type === "invoice_payment_existing" ? (
                <DetailRow
                  label="Amount paid"
                  value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
                />
              ) : null}
              {entry.senderName ? <DetailRow label="Sender" value={entry.senderName} /> : null}
              {entry.receiverName ? <DetailRow label="Receiver" value={entry.receiverName} /> : null}
              {entry.paymentMethod ? (
                <DetailRow label="Payment method" value={getPaymentMethodLabel(entry.paymentMethod)} />
              ) : null}
              {entry.type === "invoice_payment_new" && entry.referenceNumber ? (
                <DetailRow label="Reference" value={entry.referenceNumber} />
              ) : null}
            </div>
          ) : null}

          {entry.category ? (
            <div className="rounded-xl border bg-muted/20 px-4">
              <DetailRow label="Category" value={formatAccountingCategory(entry)} />
              {entry.paymentMethod ? (
                <DetailRow label="Payment method" value={getPaymentMethodLabel(entry.paymentMethod)} />
              ) : null}
              <DetailRow
                label="Amount paid"
                value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
              />
              {entry.referenceNumber ? (
                <DetailRow label="Reference number" value={entry.referenceNumber} />
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Date created" value={formatAuditDate(entry.createdAt)} />
            <DetailRow label="User created" value={entry.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(entry.updatedAt)} />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(entry)}>
              <Pencil className="h-4 w-4" />
              Edit entry
            </Button>
            <Button variant="destructive" onClick={() => onDelete(entry)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
