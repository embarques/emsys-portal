"use client";

import { useState } from "react";

import { AccountingEntryForm } from "@/components/accounting/accounting-entry-form";
import { AccountingSectionRowActions } from "@/components/accounting/accounting-section-row-actions";
import { UniformPillWidthProvider, UniformWidthPill } from "@/components/app-shell/uniform-width-pill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatAccountingCategory,
  formatAccountingDate,
  formatAccountingMoney,
  getAccountingEntryTypeBadgeClass,
  getAccountingEntryTypeLabel,
  getPaymentMethodLabel,
} from "@/lib/accounting/display";
import type { AccountingEntry, AccountingFormValues } from "@/lib/accounting/types";
import type { Invoice } from "@/lib/invoices/types";

type IncomeExpensesSectionProps = {
  entries: AccountingEntry[];
  invoices: Invoice[];
  canRegister: boolean;
  onAddEntry: (values: AccountingFormValues) => string | null;
  onRowClick?: (entry: AccountingEntry) => void;
  onEdit?: (entry: AccountingEntry) => void;
  onDelete?: (entry: AccountingEntry) => void;
};

function InlineCategoryForm({
  type,
  invoices,
  canRegister,
  onAddEntry,
  title,
}: {
  type: "expense" | "income";
  invoices: Invoice[];
  canRegister: boolean;
  onAddEntry: (values: AccountingFormValues) => string | null;
  title: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  function submitEntry(values: AccountingFormValues): string | null {
    if (!canRegister) {
      return "Select a route assignment before registering entries.";
    }
    return onAddEntry(values);
  }

  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <fieldset disabled={!canRegister} className="space-y-0 disabled:opacity-60">
        <AccountingEntryForm
          variant="inline"
          fixedType={type}
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
  );
}

export function IncomeExpensesSection({
  entries,
  invoices,
  canRegister,
  onAddEntry,
  onRowClick,
  onEdit,
  onDelete,
}: IncomeExpensesSectionProps) {
  const ledgerEntries = entries
    .filter((entry) => entry.type === "expense" || entry.type === "income")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Card className="mt-6">
      <CardHeader className="border-b pb-4">
        <CardTitle>Income & expenses</CardTitle>
        <CardDescription>
          Add an expense or income below — each entry appears in the list as soon as you submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <InlineCategoryForm
            type="expense"
            invoices={invoices}
            canRegister={canRegister}
            onAddEntry={onAddEntry}
            title="Add expense"
          />
          <InlineCategoryForm
            type="income"
            invoices={invoices}
            canRegister={canRegister}
            onAddEntry={onAddEntry}
            title="Add income"
          />
        </div>

        <UniformPillWidthProvider resetKey={ledgerEntries.map((entry) => entry.entryId).join(",")}>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Payment method</th>
                  <th className="px-4 py-3 font-medium">Amount paid</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Reference number</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No income or expense entries yet. Add one above.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => (
                    <tr
                      key={entry.entryId}
                      className="border-b last:border-0 hover:bg-muted/30"
                      onClick={() => onRowClick?.(entry)}
                      role={onRowClick ? "button" : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                    >
                      <td className="px-4 py-3">
                        <UniformWidthPill columnKey="type">
                          <Badge className={getAccountingEntryTypeBadgeClass(entry.type)}>
                            {getAccountingEntryTypeLabel(entry.type)}
                          </Badge>
                        </UniformWidthPill>
                      </td>
                      <td className="px-4 py-3">{formatAccountingCategory(entry)}</td>
                      <td className="px-4 py-3">
                        {entry.paymentMethod ? getPaymentMethodLabel(entry.paymentMethod) : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatAccountingMoney(entry.amountPaid ?? entry.amount)}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3">{entry.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatAccountingDate(entry.date)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{entry.referenceNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <AccountingSectionRowActions entry={entry} onEdit={onEdit} onDelete={onDelete} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </UniformPillWidthProvider>
      </CardContent>
    </Card>
  );
}
