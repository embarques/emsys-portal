"use client";

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

export function AccountingEntryViewSheet({
  entry,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: AccountingEntryViewSheetProps) {
  if (!entry) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={formatAccountingMoney(entry.amount)}
          meta={
            <>
              <Badge className={getAccountingEntryTypeBadgeClass(entry.type)}>
                {getAccountingEntryTypeLabel(entry.type)}
              </Badge>
              <Badge className={getAccountingBranchBadgeClass(entry.branch)}>
                {getAccountingBranchLabel(entry.branch)}
              </Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Entry">
            <RecordViewSheetDetailRow label="Entry ID" value={truncateAccountingEntryId(entry.entryId)} />
            <RecordViewSheetDetailRow label="Date" value={formatAccountingDate(entry.date)} />
            <RecordViewSheetDetailRow label="Description" value={entry.description} />
            <RecordViewSheetDetailRow label="Amount" value={formatAccountingMoney(entry.amount)} />
            <RecordViewSheetDetailRow
              label="Route assignment"
              value={getRouteAssignmentLabel(entry.routeAssignmentId)}
            />
          </RecordViewSheetSection>

          {entry.invoiceNumber ? (
            <RecordViewSheetSection title="Invoice">
              <RecordViewSheetDetailRow label="Invoice" value={entry.invoiceNumber} />
              {entry.type === "invoice_discount" ? (
                <RecordViewSheetDetailRow
                  label="Receipt number"
                  value={entry.receiptNumber ?? entry.referenceNumber ?? "—"}
                />
              ) : null}
              {entry.type === "invoice_discount" ? (
                <RecordViewSheetDetailRow label="Discount" value={formatAccountingMoney(entry.amount)} />
              ) : null}
              {entry.type === "invoice_payment_new" && entry.invoiceTotal !== undefined ? (
                <RecordViewSheetDetailRow label="Total" value={formatAccountingMoney(entry.invoiceTotal)} />
              ) : null}
              {entry.type === "invoice_payment_new" ? (
                <RecordViewSheetDetailRow
                  label="Amount paid"
                  value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
                />
              ) : null}
              {entry.type === "invoice_payment_new" ? (
                <RecordViewSheetDetailRow label="Balance" value={formatAccountingMoney(getNewInvoicePaymentBalance(entry))} />
              ) : null}
              {entry.type === "invoice_payment_existing" ? (
                <RecordViewSheetDetailRow
                  label="Receipt number"
                  value={entry.receiptNumber ?? entry.referenceNumber ?? "—"}
                />
              ) : null}
              {entry.type === "invoice_payment_existing" ? (
                <RecordViewSheetDetailRow
                  label="Amount paid"
                  value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
                />
              ) : null}
              {entry.senderName ? <RecordViewSheetDetailRow label="Sender" value={entry.senderName} /> : null}
              {entry.receiverName ? <RecordViewSheetDetailRow label="Receiver" value={entry.receiverName} /> : null}
              {entry.paymentMethod ? (
                <RecordViewSheetDetailRow label="Payment method" value={getPaymentMethodLabel(entry.paymentMethod)} />
              ) : null}
              {entry.type === "invoice_payment_new" && entry.referenceNumber ? (
                <RecordViewSheetDetailRow label="Reference" value={entry.referenceNumber} />
              ) : null}
            </RecordViewSheetSection>
          ) : null}

          {entry.category ? (
            <RecordViewSheetSection title="Category">
              <RecordViewSheetDetailRow label="Category" value={formatAccountingCategory(entry)} />
              {entry.paymentMethod ? (
                <RecordViewSheetDetailRow label="Payment method" value={getPaymentMethodLabel(entry.paymentMethod)} />
              ) : null}
              <RecordViewSheetDetailRow
                label="Amount paid"
                value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
              />
              {entry.referenceNumber ? (
                <RecordViewSheetDetailRow label="Reference number" value={entry.referenceNumber} />
              ) : null}
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title="Audit">
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(entry.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={entry.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(entry.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit entry" onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
