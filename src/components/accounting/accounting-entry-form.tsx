"use client";

import { useEffect, useMemo, useState } from "react";

import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatAccountingMoney,
  getAccountingEntryTypeLabel,
} from "@/lib/accounting/display";
import {
  ACCOUNTING_BRANCHES,
  ACCOUNTING_ENTRY_TYPES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  createEmptyAccountingForm,
  findInvoiceByNumber,
  getDefaultCategoryForType,
  getInvoiceTotalForAccounting,
  isCategoryType,
  isExistingInvoicePaymentType,
  isInvoiceDiscountType,
  isNewInvoicePaymentType,
  resetAccountingFormForNextEntry,
  type AccountingFormValues,
} from "@/lib/accounting/types";
import { todayDateInputValue } from "@/lib/orders/types";
import { formatInvoiceMoney, getInvoiceBalance, getInvoiceSubtotal } from "@/lib/invoices/display";
import { INVOICE_PAYMENT_METHODS, type Invoice } from "@/lib/invoices/types";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import type { RouteAssignment } from "@/lib/route-assignments/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type AccountingEntryFormProps = {
  initialValues?: AccountingFormValues;
  invoices: Invoice[];
  routeAssignments?: RouteAssignment[];
  isEditing?: boolean;
  updatedAt?: string;
  variant?: "dialog" | "inline";
  fixedType?: AccountingFormValues["type"];
  submitLabel: string;
  onSubmit: (values: AccountingFormValues) => string | null;
  onFormErrorChange?: (error: string | null) => void;
  onCancel?: () => void;
};

export function AccountingEntryForm({
  initialValues,
  invoices,
  routeAssignments = [],
  isEditing = false,
  updatedAt,
  variant = "dialog",
  fixedType,
  submitLabel,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: AccountingEntryFormProps) {
  const isInline = variant === "inline";
  const defaultValues = useMemo(() => {
    const empty = createEmptyAccountingForm();
    if (fixedType) {
      return { ...empty, type: fixedType, category: getDefaultCategoryForType(fixedType) };
    }
    return empty;
  }, [fixedType]);

  const [values, setValues] = useState<AccountingFormValues>(initialValues ?? defaultValues);

  useEffect(() => {
    setValues(initialValues ?? defaultValues);
  }, [initialValues, defaultValues]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.invoiceId === values.invoiceId),
    [invoices, values.invoiceId]
  );

  const matchedInvoiceByNumber = useMemo(
    () => findInvoiceByNumber(invoices, values.invoiceNumber),
    [invoices, values.invoiceNumber]
  );

  const typeMeta = ACCOUNTING_ENTRY_TYPES.find((entry) => entry.value === values.type);

  const previewBalance = useMemo(() => {
    if (!isNewInvoicePaymentType(values.type)) return null;
    const total = Number(values.invoiceTotal);
    const paid = Number(values.amountPaid);
    if (!Number.isFinite(total) || !Number.isFinite(paid)) return null;
    return Math.round((total - paid) * 100) / 100;
  }, [values.type, values.invoiceTotal, values.amountPaid]);

  function updateField<K extends keyof AccountingFormValues>(key: K, value: AccountingFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleInvoiceNumberChange(invoiceNumber: string) {
    const matched = findInvoiceByNumber(invoices, invoiceNumber);
    setValues((current) => ({
      ...current,
      invoiceNumber,
      invoiceId: matched?.invoiceId ?? "",
      invoiceTotal: matched ? String(getInvoiceTotalForAccounting(matched)) : current.invoiceTotal,
      senderName: matched?.sender.name ?? current.senderName,
      receiverName: matched?.receiver.name ?? current.receiverName,
      branch: matched?.paymentLocation ?? current.branch,
    }));
  }

  function handleTypeChange(type: AccountingFormValues["type"]) {
    setValues((current) => ({
      ...current,
      type,
      date:
        type === "expense" || type === "income" || type === "invoice_discount"
          ? todayDateInputValue()
          : current.date,
      category: getDefaultCategoryForType(type),
      otherCategory: "",
      linkedPaymentId: "",
      invoiceId: "",
      invoiceNumber: "",
      invoiceTotal: "",
      amount: "",
      amountPaid: "",
      senderName: "",
      receiverName: "",
      receiptNumber: "",
      referenceNumber: "",
      description: "",
    }));
  }

  function handleInvoiceSelect(invoiceId: string) {
    const invoice = invoices.find((entry) => entry.invoiceId === invoiceId);
    setValues((current) => ({
      ...current,
      invoiceId,
      branch: invoice?.paymentLocation ?? current.branch,
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = onSubmit(values);
    onFormErrorChange?.(error);
    if (!error && isInline) {
      setValues(resetAccountingFormForNextEntry(values, fixedType));
    }
  }

  const categoryOptions =
    values.type === "income"
      ? INCOME_CATEGORIES
      : values.type === "expense"
        ? EXPENSE_CATEGORIES
        : [];

  const isNewInvoicePayment = isNewInvoicePaymentType(values.type);
  const isExistingInvoicePayment = isExistingInvoicePaymentType(values.type);
  const isInvoiceDiscount = isInvoiceDiscountType(values.type);
  const isCategoryEntry = isCategoryType(values.type);
  const showGlobalDateBranch = isNewInvoicePayment || isExistingInvoicePayment;

  return (
    <form onSubmit={handleSubmit} className={isInline ? "space-y-3" : "space-y-4"}>
      {!isInline ? (
      <div className="space-y-2">
        <Label htmlFor="entryId">Entry ID</Label>
        <Input id="entryId" value={values.entryId} readOnly className="bg-muted/40 font-mono text-xs" />
      </div>
      ) : null}

      {!isInline && !fixedType ? (
      <div className="space-y-2">
        <Label htmlFor="type">
          Entry type <span className="text-destructive">*</span>
        </Label>
        <select
          id="type"
          className={selectClassName}
          value={values.type}
          onChange={(event) => handleTypeChange(event.target.value as AccountingFormValues["type"])}
          disabled={isEditing}
          required
        >
          {ACCOUNTING_ENTRY_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {typeMeta ? <p className="text-xs text-muted-foreground">{typeMeta.description}</p> : null}
      </div>
      ) : null}

      {showGlobalDateBranch ? (
      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label htmlFor="branch">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch"
            className={selectClassName}
            value={values.branch}
            onChange={(event) => updateField("branch", event.target.value as AccountingFormValues["branch"])}
            required
          >
            {ACCOUNTING_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      ) : null}

      {!showGlobalDateBranch && !isCategoryEntry ? (
        <input type="hidden" value={values.date} readOnly />
      ) : null}

      {isNewInvoicePayment ? (
        <div className={isInline ? "space-y-3" : "space-y-4 rounded-xl border bg-muted/10 p-4"}>
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">
              Invoice number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invoiceNumber"
              value={values.invoiceNumber}
              onChange={(event) => handleInvoiceNumberChange(event.target.value)}
              placeholder="INV-2026-0001"
              required
            />
            {matchedInvoiceByNumber ? (
              <p className="text-xs text-muted-foreground">
                Matched invoice — sender and receiver filled automatically.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoiceTotal">
                Total <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoiceTotal"
                type="number"
                min={0.01}
                step="0.01"
                value={values.invoiceTotal}
                onChange={(event) => updateField("invoiceTotal", event.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountPaid">
                Amount paid <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amountPaid"
                type="number"
                min={0.01}
                step="0.01"
                value={values.amountPaid}
                onChange={(event) => updateField("amountPaid", event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {previewBalance !== null ? (
            <p className="text-xs text-muted-foreground">
              Balance after payment:{" "}
              <span className="font-medium text-foreground">{formatAccountingMoney(previewBalance)}</span>
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">
              Payment type <span className="text-destructive">*</span>
            </Label>
            <select
              id="paymentMethod"
              className={selectClassName}
              value={values.paymentMethod}
              onChange={(event) =>
                updateField("paymentMethod", event.target.value as AccountingFormValues["paymentMethod"])
              }
              required
            >
              {INVOICE_PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender name</Label>
              <Input
                id="senderName"
                value={values.senderName}
                onChange={(event) => updateField("senderName", event.target.value)}
                placeholder="Auto-filled when invoice matches"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiverName">Receiver name</Label>
              <Input
                id="receiverName"
                value={values.receiverName}
                onChange={(event) => updateField("receiverName", event.target.value)}
                placeholder="Auto-filled when invoice matches"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Reference number</Label>
            <Input
              id="referenceNumber"
              value={values.referenceNumber}
              onChange={(event) => updateField("referenceNumber", event.target.value)}
              placeholder="Check #, transaction ID..."
            />
          </div>
        </div>
      ) : null}

      {isExistingInvoicePayment ? (
        <div className={isInline ? "space-y-3" : "space-y-4 rounded-xl border bg-muted/10 p-4"}>
          <div className="space-y-2">
            <Label htmlFor="invoiceIdExisting">
              Invoice <span className="text-destructive">*</span>
            </Label>
            <select
              id="invoiceIdExisting"
              className={selectClassName}
              value={values.invoiceId}
              onChange={(event) => handleInvoiceSelect(event.target.value)}
              required
            >
              <option value="">Select invoice…</option>
              {invoices.map((invoice) => (
                <option key={invoice.invoiceId} value={invoice.invoiceId}>
                  {invoice.invoiceNumber} · {invoice.sender.name}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice ? (
            <div className="grid gap-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-3">
              <p>
                Subtotal:{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(getInvoiceSubtotal(selectedInvoice))}
                </span>
              </p>
              <p>
                Paid:{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(selectedInvoice.amountPaid)}
                </span>
              </p>
              <p>
                Balance:{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(getInvoiceBalance(selectedInvoice))}
                </span>
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="receiptNumber">
              Receipt number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="receiptNumber"
              value={values.receiptNumber}
              onChange={(event) => updateField("receiptNumber", event.target.value)}
              placeholder="RCP-12345"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amountPaidExisting">
                Amount paid <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amountPaidExisting"
                type="number"
                min={0.01}
                step="0.01"
                value={values.amountPaid}
                onChange={(event) => updateField("amountPaid", event.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethodExisting">
                Payment method <span className="text-destructive">*</span>
              </Label>
              <select
                id="paymentMethodExisting"
                className={selectClassName}
                value={values.paymentMethod}
                onChange={(event) =>
                  updateField("paymentMethod", event.target.value as AccountingFormValues["paymentMethod"])
                }
                required
              >
                {INVOICE_PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {isInvoiceDiscount ? (
        <div className={isInline ? "space-y-3" : "space-y-4 rounded-xl border bg-muted/10 p-4"}>
          <div className="space-y-2">
            <Label htmlFor="invoiceIdDiscount">
              Invoice <span className="text-destructive">*</span>
            </Label>
            <select
              id="invoiceIdDiscount"
              className={selectClassName}
              value={values.invoiceId}
              onChange={(event) => handleInvoiceSelect(event.target.value)}
              required
            >
              <option value="">Select invoice…</option>
              {invoices.map((invoice) => (
                <option key={invoice.invoiceId} value={invoice.invoiceId}>
                  {invoice.invoiceNumber} · {invoice.sender.name}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice ? (
            <div className="grid gap-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-3">
              <p>
                Subtotal:{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(getInvoiceSubtotal(selectedInvoice))}
                </span>
              </p>
              <p>
                Current discount:{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(selectedInvoice.discount)}
                </span>
              </p>
              <p>
                Balance:{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(getInvoiceBalance(selectedInvoice))}
                </span>
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="receiptNumberDiscount">
              Receipt number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="receiptNumberDiscount"
              value={values.receiptNumber}
              onChange={(event) => updateField("receiptNumber", event.target.value)}
              placeholder="RCP-12345"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discountAmount">
                Discount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="discountAmount"
                type="number"
                min={0.01}
                step="0.01"
                value={values.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethodDiscount">
                Payment method <span className="text-destructive">*</span>
              </Label>
              <select
                id="paymentMethodDiscount"
                className={selectClassName}
                value={values.paymentMethod}
                onChange={(event) =>
                  updateField("paymentMethod", event.target.value as AccountingFormValues["paymentMethod"])
                }
                required
              >
                {INVOICE_PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {isCategoryEntry ? (
        <div className={isInline ? "space-y-3" : "space-y-4 rounded-xl border bg-muted/10 p-4"}>
          <div className="space-y-2">
            <Label htmlFor="category">
              {values.type === "income" ? "Income" : "Expense"} category{" "}
              <span className="text-destructive">*</span>
            </Label>
            <select
              id="category"
              className={selectClassName}
              value={values.category}
              onChange={(event) => updateField("category", event.target.value)}
              required
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {values.category === "Other" ? (
            <div className="space-y-2">
              <Label htmlFor="otherCategory">
                Other category description <span className="text-destructive">*</span>
              </Label>
              <Input
                id="otherCategory"
                value={values.otherCategory}
                onChange={(event) => updateField("otherCategory", event.target.value)}
                placeholder="Describe the other category"
                required
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentMethodCategory">
                Payment method <span className="text-destructive">*</span>
              </Label>
              <select
                id="paymentMethodCategory"
                className={selectClassName}
                value={values.paymentMethod}
                onChange={(event) =>
                  updateField("paymentMethod", event.target.value as AccountingFormValues["paymentMethod"])
                }
                required
              >
                {INVOICE_PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountPaidCategory">
                Amount paid <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amountPaidCategory"
                type="number"
                min={0.01}
                step="0.01"
                value={values.amountPaid}
                onChange={(event) => updateField("amountPaid", event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descriptionCategory">
              Description <span className="text-destructive">*</span>
            </Label>
            <Input
              id="descriptionCategory"
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder={`Describe this ${getAccountingEntryTypeLabel(values.type).toLowerCase()}`}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateCategory">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dateCategory"
                type="date"
                value={values.date}
                onChange={(event) => updateField("date", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchCategory">
                Branch <span className="text-destructive">*</span>
              </Label>
              <select
                id="branchCategory"
                className={selectClassName}
                value={values.branch}
                onChange={(event) => updateField("branch", event.target.value as AccountingFormValues["branch"])}
                required
              >
                {ACCOUNTING_BRANCHES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referenceNumberCategory">Reference number</Label>
            <Input
              id="referenceNumberCategory"
              value={values.referenceNumber}
              onChange={(event) => updateField("referenceNumber", event.target.value)}
              placeholder="Check #, transaction ID..."
            />
          </div>
        </div>
      ) : null}

      {!isInline && routeAssignments.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="routeAssignmentId">
            Route assignment <span className="text-destructive">*</span>
          </Label>
          <select
            id="routeAssignmentId"
            className={selectClassName}
            value={values.routeAssignmentId}
            onChange={(event) => updateField("routeAssignmentId", event.target.value)}
            required
          >
            <option value="">Select a route assignment…</option>
            {routeAssignments.map((assignment) => (
              <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                {formatRouteAssignmentCopyLabel(assignment)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!isInline ? (
      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />
      ) : null}

      <div className={`flex gap-2 ${isInline ? "justify-start pt-1" : "justify-end pt-2"}`}>
        {!isInline && onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        ) : null}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
