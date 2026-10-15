"use client";

import { DollarSign } from "lucide-react";

import { RecordViewList } from "@/components/app-shell/record-view-list";
import { InvoiceViewCollapsibleSection } from "@/components/invoices/invoice-view-collapsible-section";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
import {
  formatInvoiceCommentDateTime,
  formatInvoiceMoney,
} from "@/lib/invoices/display";
import { type Invoice, type InvoicePaymentMethod } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoicePaymentsSectionProps = {
  invoice: Invoice;
};

function paymentMethodLabelKey(method: InvoicePaymentMethod): string {
  return `invoices.view.payments.methods.${method}`;
}

const paymentFieldClassName = "min-w-0 [&_span:last-child]:break-words";

function paymentDateLabel(iso: string): string | undefined {
  const trimmed = iso.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatInvoiceCommentDateTime(trimmed);
}

export function InvoicePaymentsSection({ invoice }: InvoicePaymentsSectionProps) {
  const { t } = useTranslation();

  const sortedPayments = [...invoice.payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (sortedPayments.length === 0) return null;

  return (
    <InvoiceViewCollapsibleSection
      title={t("invoices.view.payments.title", { count: sortedPayments.length })}
      description={t("invoices.view.payments.description", {
        totalPaid: formatInvoiceMoney(invoice.amountPaid),
      })}
      icon={DollarSign}
      count={sortedPayments.length}
    >
      <RecordViewList>
        {sortedPayments.map((payment) => (
          <InvoiceViewListItem key={payment.id} className="bg-emerald-500/5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <InvoiceViewField
                className={paymentFieldClassName}
                label={t("invoices.view.payments.fields.description")}
                value={payment.description}
              />
              <InvoiceViewField
                className={paymentFieldClassName}
                label={t("invoices.view.payments.fields.amount")}
                value={Number.isFinite(payment.amount) ? formatInvoiceMoney(payment.amount) : undefined}
              />
              <InvoiceViewField
                className={paymentFieldClassName}
                label={t("invoices.view.payments.fields.method")}
                value={
                  payment.paymentMethod
                    ? t(paymentMethodLabelKey(payment.paymentMethod))
                    : undefined
                }
              />
              <InvoiceViewField
                className={paymentFieldClassName}
                label={t("invoices.view.payments.fields.date")}
                value={paymentDateLabel(payment.createdAt)}
              />
              <InvoiceViewField
                className={paymentFieldClassName}
                label={
                  payment.paymentMethod === "check"
                    ? t("invoices.view.payments.fields.checkNumber")
                    : t("invoices.view.payments.fields.referenceNumber")
                }
                value={payment.referenceNumber}
                mono
              />
              <InvoiceViewField
                className={paymentFieldClassName}
                label={t("invoices.view.payments.fields.createdBy")}
                value={payment.createdBy}
              />
            </div>
          </InvoiceViewListItem>
        ))}
      </RecordViewList>
    </InvoiceViewCollapsibleSection>
  );
}
