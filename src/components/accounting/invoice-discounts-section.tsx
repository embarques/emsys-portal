"use client";

import { useState } from "react";

import { AccountingEntryForm } from "@/components/accounting/accounting-entry-form";
import { AccountingSectionRowActions } from "@/components/accounting/accounting-section-row-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAccountingMoney,
  getPaymentMethodLabel,
} from "@/lib/accounting/display";
import type { AccountingEntry, AccountingFormValues } from "@/lib/accounting/types";
import type { Invoice } from "@/lib/invoices/types";

type InvoiceDiscountsSectionProps = {
  entries: AccountingEntry[];
  invoices: Invoice[];
  canRegister: boolean;
  onAddEntry: (values: AccountingFormValues) => string | null;
  onRowClick?: (entry: AccountingEntry) => void;
  onEdit?: (entry: AccountingEntry) => void;
  onDelete?: (entry: AccountingEntry) => void;
};

export function InvoiceDiscountsSection({
  entries,
  invoices,
  canRegister,
  onAddEntry,
  onRowClick,
  onEdit,
  onDelete,
}: InvoiceDiscountsSectionProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const discounts = entries
    .filter((entry) => entry.type === "invoice_discount")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function submitEntry(values: AccountingFormValues): string | null {
    if (!canRegister) {
      return "Select a route assignment before registering entries.";
    }
    return onAddEntry(values);
  }

  return (
    <Card className="mt-6">
      <CardHeader className="border-b pb-4">
        <CardTitle>Invoice discounts</CardTitle>
        <CardDescription>
          Add a discount below — it appears in the list as soon as you submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-6">
        <div className="rounded-xl border bg-muted/10 p-4">
          <fieldset disabled={!canRegister} className="space-y-0 disabled:opacity-60">
            <AccountingEntryForm
              variant="inline"
              fixedType="invoice_discount"
              invoices={invoices}
              submitLabel="Add to list"
              onSubmit={submitEntry}
              onFormErrorChange={setFormError}
            />
          </fieldset>
          {!canRegister ? (
            <p className="mt-2 text-sm text-destructive">Select a route assignment above to register entries.</p>
          ) : null}
          {formError ? <p className="mt-2 text-sm text-destructive">{formError}</p> : null}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Receipt number</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Payment method</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No invoice discounts yet. Add one above.
                  </td>
                </tr>
              ) : (
                discounts.map((entry) => (
                  <tr
                    key={entry.entryId}
                    className="border-b last:border-0 hover:bg-muted/30"
                    onClick={() => onRowClick?.(entry)}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    <td className="px-4 py-3 font-medium">{entry.invoiceNumber ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {entry.receiptNumber ?? entry.referenceNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatAccountingMoney(entry.amount)}</td>
                    <td className="px-4 py-3">
                      {entry.paymentMethod ? getPaymentMethodLabel(entry.paymentMethod) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <AccountingSectionRowActions entry={entry} onEdit={onEdit} onDelete={onDelete} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
