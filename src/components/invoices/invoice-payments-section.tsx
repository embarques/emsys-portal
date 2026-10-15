"use client";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
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

function isFilled(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "—" && trimmed !== "-";
}

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

  const referenceLabel =
    sortedPayments.length > 0 && sortedPayments.every((payment) => payment.paymentMethod === "check")
      ? t("invoices.view.payments.fields.checkNumber")
      : t("invoices.view.payments.fields.referenceNumber");
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.view.payments.title", { count: sortedPayments.length })}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground">
              <th className="px-3 py-2 font-medium">
                {t("invoices.view.payments.fields.description")}
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                {t("invoices.view.payments.fields.amount")}
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                {t("invoices.view.payments.fields.method")}
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                {t("invoices.view.payments.fields.date")}
              </th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">{referenceLabel}</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                {t("invoices.view.payments.fields.createdBy")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPayments.map((payment) => {
              const description = payment.description?.trim() ?? "";
              const method = payment.paymentMethod
                ? t(paymentMethodLabelKey(payment.paymentMethod))
                : "";
              const date = paymentDateLabel(payment.createdAt) ?? "";
              const reference = payment.referenceNumber?.trim() ?? "";
              const createdBy = payment.createdBy?.trim() ?? "";
              return (
                <tr key={payment.id} className="border-b last:border-b-0 even:bg-muted/25">
                  <td className="min-w-[8rem] px-3 py-2 leading-snug text-foreground [overflow-wrap:anywhere]">
                    {isFilled(description) ? description : empty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                    {Number.isFinite(payment.amount) ? formatInvoiceMoney(payment.amount) : empty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                    {isFilled(method) ? method : empty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                    {isFilled(date) ? date : empty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-foreground">
                    {isFilled(reference) ? reference : empty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                    {isFilled(createdBy) ? createdBy : empty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </RecordViewSheetSection>
  );
}
