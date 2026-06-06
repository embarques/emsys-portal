"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatInvoiceCommentDateTime,
  formatInvoiceMoney,
  getPaymentMethodLabel,
} from "@/lib/invoices/display";
import {
  INVOICE_PAYMENT_METHODS,
  type Invoice,
  type InvoicePaymentInput,
  type InvoicePaymentMethod,
} from "@/lib/invoices/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type InvoicePaymentsSectionProps = {
  invoice: Invoice;
  onRecordPayment: (input: InvoicePaymentInput) => void;
};

export function InvoicePaymentsSection({ invoice, onRecordPayment }: InvoicePaymentsSectionProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    try {
      const parsedAmount = Number(amount);
      onRecordPayment({
        description,
        amount: parsedAmount,
        paymentMethod,
        referenceNumber,
      });
      setDescription("");
      setAmount("");
      setReferenceNumber("");
      setPaymentMethod("cash");
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record payment.");
    }
  }

  const sortedPayments = [...invoice.payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <DollarSign className="h-3.5 w-3.5" />
        Payments ({invoice.payments.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Recorded payments for this invoice. Total paid: {formatInvoiceMoney(invoice.amountPaid)}.
      </p>

      {sortedPayments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Date created</th>
                <th className="px-3 py-2 font-medium">User created</th>
                <th className="px-3 py-2 font-medium">Date modified</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0 bg-emerald-500/5">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {formatInvoiceCommentDateTime(payment.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">{payment.createdBy}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">—</td>
                  <td className="px-3 py-2 text-xs">{payment.description}</td>
                  <td className="px-3 py-2 text-xs font-medium">{formatInvoiceMoney(payment.amount)}</td>
                  <td className="px-3 py-2 text-xs">{getPaymentMethodLabel(payment.paymentMethod)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{payment.referenceNumber || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-lg border bg-background p-3">
        <p className="text-sm font-medium">Record payment</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="paymentDescription">Description</Label>
            <Input
              id="paymentDescription"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Partial payment collected at front desk"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Amount</Label>
            <Input
              id="paymentAmount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                if (error) setError(null);
              }}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment method</Label>
            <select
              id="paymentMethod"
              className={selectClassName}
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as InvoicePaymentMethod)}
            >
              {INVOICE_PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="paymentReference">Reference number</Label>
            <Input
              id="paymentReference"
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              placeholder="Check #, transaction ID, confirmation code..."
            />
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="button" size="sm" onClick={handleSubmit}>
          Record payment
        </Button>
      </div>
    </div>
  );
}
