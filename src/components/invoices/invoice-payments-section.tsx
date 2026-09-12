"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { InvoiceViewCollapsibleSection } from "@/components/invoices/invoice-view-collapsible-section";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
import {
  formatInvoiceCommentDateTime,
  formatInvoiceMoney,
} from "@/lib/invoices/display";
import {
  INVOICE_PAYMENT_METHODS,
  type Invoice,
  type InvoicePaymentInput,
  type InvoicePaymentMethod,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoicePaymentsSectionProps = {
  invoice: Invoice;
  onRecordPayment: (input: InvoicePaymentInput) => void;
};

function paymentMethodLabelKey(method: InvoicePaymentMethod): string {
  return `invoices.view.payments.methods.${method}`;
}

export function InvoicePaymentsSection({ invoice, onRecordPayment }: InvoicePaymentsSectionProps) {
  const { t } = useTranslation();
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
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("invoices.view.payments.recordError"),
      );
    }
  }

  const sortedPayments = [...invoice.payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <InvoiceViewCollapsibleSection
      title={t("invoices.view.payments.title", { count: invoice.payments.length })}
      description={t("invoices.view.payments.description", {
        totalPaid: formatInvoiceMoney(invoice.amountPaid),
      })}
      icon={DollarSign}
      count={invoice.payments.length}
      footer={
        <div className="space-y-3 rounded-lg border bg-background p-3">
          <p className="text-sm font-medium">{t("invoices.view.payments.recordTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="paymentDescription">{t("invoices.view.payments.fields.description")}</Label>
              <Input
                id="paymentDescription"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("invoices.view.payments.descriptionPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">{t("invoices.view.payments.fields.amount")}</Label>
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
              <Label htmlFor="paymentMethod">{t("invoices.view.payments.fields.method")}</Label>
              <SearchableSelect
                id="paymentMethod"
                value={paymentMethod}
                onValueChange={(next) => {
                  setPaymentMethod(next as InvoicePaymentMethod);
                  if (error) setError(null);
                }}
                searchPlaceholder={t("invoices.view.payments.searchMethods")}
                options={INVOICE_PAYMENT_METHODS.map((option) => ({
                  value: option.value,
                  label: t(paymentMethodLabelKey(option.value)),
                }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="paymentReference">
                {paymentMethod === "check"
                  ? t("invoices.view.payments.fields.checkNumber")
                  : t("invoices.view.payments.fields.referenceNumber")}
                {paymentMethod === "check" ? <span className="text-destructive"> *</span> : null}
              </Label>
              <Input
                id="paymentReference"
                value={referenceNumber}
                onChange={(event) => {
                  setReferenceNumber(event.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  paymentMethod === "check"
                    ? t("invoices.view.payments.checkNumberPlaceholder")
                    : t("invoices.view.payments.referencePlaceholder")
                }
                autoComplete="off"
              />
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="button" size="sm" onClick={handleSubmit}>
            {t("invoices.view.payments.recordAction")}
          </Button>
        </div>
      }
    >
      {sortedPayments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("invoices.view.payments.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {sortedPayments.map((payment) => (
            <InvoiceViewListItem key={payment.id} className="bg-emerald-500/5">
              <InvoiceViewField
                label={t("invoices.view.payments.fields.description")}
                value={payment.description}
              />
              <InvoiceViewField
                label={t("invoices.view.payments.fields.amount")}
                value={formatInvoiceMoney(payment.amount)}
              />
              <InvoiceViewField
                label={t("invoices.view.payments.fields.method")}
                value={t(paymentMethodLabelKey(payment.paymentMethod))}
              />
              <InvoiceViewField
                label={t("invoices.view.payments.fields.date")}
                value={formatInvoiceCommentDateTime(payment.createdAt)}
              />
              <InvoiceViewField
                label={
                  payment.paymentMethod === "check"
                    ? t("invoices.view.payments.fields.checkNumber")
                    : t("invoices.view.payments.fields.referenceNumber")
                }
                value={payment.referenceNumber || undefined}
                mono
              />
              <InvoiceViewField
                label={t("invoices.view.payments.fields.createdBy")}
                value={payment.createdBy}
              />
            </InvoiceViewListItem>
          ))}
        </ul>
      )}
    </InvoiceViewCollapsibleSection>
  );
}
