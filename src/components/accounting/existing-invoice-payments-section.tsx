"use client";

import { useState } from "react";

import { AccountingEntryForm } from "@/components/accounting/accounting-entry-form";
import { AccountingSectionRowActions } from "@/components/accounting/accounting-section-row-actions";
import { InteractiveTableRow } from "@/components/app-shell/interactive-table-row";
import { TableCopyableCell } from "@/components/app-shell/table-copyable-cell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAccountingMoney,
  getPaymentMethodLabel,
} from "@/lib/accounting/display";
import type { AccountingEntry, AccountingFormValues } from "@/lib/accounting/types";
import type { Invoice } from "@/lib/invoices/types";

type ExistingInvoicePaymentsSectionProps = {
  entries: AccountingEntry[];
  invoices: Invoice[];
  canRegister: boolean;
  onAddEntry: (values: AccountingFormValues) => string | null;
  onRowClick?: (entry: AccountingEntry) => void;
  onEdit?: (entry: AccountingEntry) => void;
  onDelete?: (entry: AccountingEntry) => void;
  activeEntryId?: string;
};

export function ExistingInvoicePaymentsSection({
  entries,
  invoices,
  canRegister,
  onAddEntry,
  onRowClick,
  onEdit,
  onDelete,
  activeEntryId,
}: ExistingInvoicePaymentsSectionProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const existingInvoicePayments = entries
    .filter((entry) => entry.type === "invoice_payment_existing")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function submitEntry(values: AccountingFormValues): string | null {
    if (!canRegister) {
      return "Select a route before registering entries.";
    }
    return onAddEntry(values);
  }

  return (
    <Card className="mt-6">
      <CardHeader className="border-b pb-4">
        <CardTitle>Existing invoice payments</CardTitle>
        <CardDescription>
          Add a payment below — it appears in the list as soon as you submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-6">
        <div className="rounded-xl border bg-muted/10 p-4">
          <fieldset disabled={!canRegister} className="space-y-0 disabled:opacity-60">
            <AccountingEntryForm
              variant="inline"
              fixedType="invoice_payment_existing"
              invoices={invoices}
              submitLabel="Add to list"
              onSubmit={submitEntry}
              onFormErrorChange={setFormError}
            />
          </fieldset>
          {!canRegister ? (
            <p className="mt-2 text-sm text-destructive">Select a route above to register entries.</p>
          ) : null}
          {formError ? <p className="mt-2 text-sm text-destructive">{formError}</p> : null}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Receipt number</th>
                <th className="px-4 py-3 font-medium">Amount paid</th>
                <th className="px-4 py-3 font-medium">Payment method</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {existingInvoicePayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No existing invoice payments yet. Add one above.
                  </td>
                </tr>
              ) : (
                existingInvoicePayments.map((entry) => {
                  const receiptNumber = entry.receiptNumber ?? entry.referenceNumber;

                  return (
                    <InteractiveTableRow
                      key={entry.entryId}
                      active={entry.entryId === activeEntryId}
                      onRowClick={onRowClick ? () => onRowClick(entry) : undefined}
                    >
                      <td className="px-4 py-3 font-medium">
                        {entry.invoiceNumber ? (
                          <TableCopyableCell value={entry.invoiceNumber} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {receiptNumber ? <TableCopyableCell value={receiptNumber} /> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <TableCopyableCell
                          value={formatAccountingMoney(entry.amountPaid ?? entry.amount)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {entry.paymentMethod ? (
                          <TableCopyableCell value={getPaymentMethodLabel(entry.paymentMethod)} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <AccountingSectionRowActions entry={entry} onEdit={onEdit} onDelete={onDelete} />
                      </td>
                    </InteractiveTableRow>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
