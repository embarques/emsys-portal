"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { InvoiceLineItemsEditor } from "@/components/invoices/invoice-line-items-editor";
import { OrderPartyEditor } from "@/components/orders/order-party-editor";
import { cloneContainers } from "@/lib/containers/mock-data";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  INVOICE_PAYMENT_LOCATIONS,
  computeInvoiceBalance,
  computeLineTotal,
  createEmptyInvoiceForm,
  resetInvoiceFormForNextEntry,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import { cloneItems } from "@/lib/items/mock-data";
import { useCustomerPicker } from "@/lib/customers/hooks/use-customers";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type InvoiceFormProps = {
  initialValues?: InvoiceFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  suggestedInvoiceNumber?: string;
  submitLabel: string;
  onSubmit: (values: InvoiceFormValues) => InvoiceFormSubmitResult;
  onFormErrorChange?: (error: string | null) => void;
  onCancel: () => void;
};

export function InvoiceForm({
  initialValues,
  isEditing = false,
  updatedAt,
  suggestedInvoiceNumber,
  submitLabel,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: InvoiceFormProps) {
  const { data: customersData } = useCustomerPicker();
  const customers = customersData?.items ?? [];
  const containers = useMemo(() => cloneContainers(), []);
  const catalogItems = useMemo(() => cloneItems(), []);

  const [values, setValues] = useState<InvoiceFormValues>(initialValues ?? createEmptyInvoiceForm());

  useEffect(() => {
    const base = initialValues ?? createEmptyInvoiceForm();
    setValues(
      !isEditing && suggestedInvoiceNumber && !base.invoiceNumber
        ? { ...base, invoiceNumber: suggestedInvoiceNumber }
        : base
    );
  }, [initialValues, isEditing, suggestedInvoiceNumber]);

  function updateField<K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = onSubmit(values);
    onFormErrorChange?.(result.error);
    if (!result.error && !isEditing) {
      setValues(
        resetInvoiceFormForNextEntry(values, result.nextInvoiceNumber ?? suggestedInvoiceNumber ?? "")
      );
    }
  }

  const subtotal = values.lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum;
    return sum + computeLineTotal(quantity, unitPrice);
  }, 0);

  const discount = Number(values.discount) || 0;
  const amountPaid = Number(values.amountPaid) || 0;
  const balance = computeInvoiceBalance(subtotal, discount, amountPaid);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="invoiceId">Invoice ID</Label>
          <Input id="invoiceId" value={values.invoiceId} readOnly className="bg-muted/40 font-mono text-xs" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">
            Invoice number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="invoiceNumber"
            value={values.invoiceNumber}
            onChange={(event) => updateField("invoiceNumber", event.target.value)}
            placeholder="INV-2026-0001"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">
            Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="containerId">
            Container <span className="text-destructive">*</span>
          </Label>
          <select
            id="containerId"
            className={selectClassName}
            value={values.containerId}
            onChange={(event) => updateField("containerId", event.target.value)}
            required
          >
            <option value="">Select a container</option>
            {containers.map((container) => (
              <option key={container.containerId} value={container.containerId}>
                {container.containerCode} · {container.containerNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentLocation">
            Pending <span className="text-destructive">*</span>
          </Label>
          <select
            id="paymentLocation"
            className={selectClassName}
            value={values.paymentLocation}
            onChange={(event) =>
              updateField("paymentLocation", event.target.value as InvoiceFormValues["paymentLocation"])
            }
            required
          >
            {INVOICE_PAYMENT_LOCATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <OrderPartyEditor
        title="Sender"
        description="Manage sender phones, addresses, and the address used on this invoice."
        values={values.sender}
        customers={customers}
        customerFilter="sender"
        onChange={(sender) => updateField("sender", sender)}
      />

      <OrderPartyEditor
        title="Receiver"
        description="Manage receiver phones, addresses, and the address used on this invoice."
        values={values.receiver}
        customers={customers}
        customerFilter="receiver"
        onChange={(receiver) => updateField("receiver", receiver)}
      />

      <InvoiceLineItemsEditor
        lineItems={values.lineItems}
        catalogItems={catalogItems}
        onChange={(lineItems) => updateField("lineItems", lineItems)}
      />

      <section className="rounded-xl border bg-muted/10 p-4">
        <h3 className="text-sm font-semibold">Invoice totals</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="discount">Discount</Label>
            <Input
              id="discount"
              type="number"
              min={0}
              step="0.01"
              value={values.discount}
              onChange={(event) => updateField("discount", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amountPaid">Amount paid so far</Label>
            <Input
              id="amountPaid"
              value={formatInvoiceMoney(amountPaid)}
              readOnly
              className="bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              Record individual payments when viewing the invoice after it is saved.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-lg border bg-background p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice total</span>
            <span className="font-medium">{formatInvoiceMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium">−{formatInvoiceMoney(discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="font-medium">−{formatInvoiceMoney(amountPaid)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Balance left</span>
            <span>{formatInvoiceMoney(balance)}</span>
          </div>
        </div>
      </section>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
