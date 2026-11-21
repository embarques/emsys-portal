"use client";

import { Loader2, Printer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useGenerateReport } from "@/lib/reports/hooks/use-reports";
import { buildPaymentReceiptRequest } from "@/lib/accounting/daily-income/print-payment-receipt";
import { openIncomeReportUrl } from "@/lib/accounting/daily-income/print-income-report";
import { normalizeApiError } from "@/lib/api/axios";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import {
  CompactTableScroll,
  compactTableCellClassName,
  compactTableCellWrapClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
  compactTableRowClassName,
} from "@/components/ui/compact-table";
import { cn } from "@/lib/utils";
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
  const feedback = useFeedback();
  const printReceipt = useGenerateReport();
  async function handlePrintReceipt(id: string) {
    if (printReceipt.isPending) return;
    try {
      const receipt = await printReceipt.mutateAsync(buildPaymentReceiptRequest({ id, transactionType: "PAYMENT" }));
      openIncomeReportUrl(receipt.url);
    } catch (error) {
      feedback.notifyError(normalizeApiError(error).message);
    }
  }

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
      icon={Wallet}
    >
      <CompactTableScroll aria-label={t("invoices.view.payments.title", { count: sortedPayments.length })}>
        <table className={compactTableClassName}>
          <thead>
            <tr className={compactTableHeadRowClassName}>
              <th className={cn(compactTableHeadClassName, "w-8 px-1")}>
                <span className="sr-only">{t("accounting.dailyIncome.actions.printReceipt")}</span>
              </th>
              <th className={compactTableHeadClassName}>
                {t("invoices.view.payments.fields.description")}
              </th>
              <th className={cn(compactTableHeadClassName, "text-right")}>
                {t("invoices.view.payments.fields.amount")}
              </th>
              <th className={compactTableHeadClassName}>
                {t("invoices.view.payments.fields.method")}
              </th>
              <th className={compactTableHeadClassName}>
                {t("invoices.view.payments.fields.date")}
              </th>
              <th className={compactTableHeadClassName}>{referenceLabel}</th>
              <th className={compactTableHeadClassName}>
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
                <tr key={payment.id} className={compactTableRowClassName}>
                  <td className={cn(compactTableCellClassName, "w-8 px-1")}>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                      aria-label={t("accounting.dailyIncome.actions.printReceipt")}
                      title={t("accounting.dailyIncome.actions.printReceipt")}
                      disabled={printReceipt.isPending || !/^[a-f0-9]{24}$/i.test(payment.id)}
                      onClick={() => handlePrintReceipt(payment.id)}>
                      {printReceipt.isPending && printReceipt.variables?.values?.[0] === payment.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Printer className="h-3.5 w-3.5" />}
                    </Button>
                  </td>
                  <td className={cn(compactTableCellWrapClassName, "min-w-[8rem]")}>
                    {isFilled(description) ? description : empty}
                  </td>
                  <td className={cn(compactTableCellClassName, "text-right tabular-nums")}>
                    {Number.isFinite(payment.amount) ? formatInvoiceMoney(payment.amount) : empty}
                  </td>
                  <td className={compactTableCellClassName}>
                    {isFilled(method) ? method : empty}
                  </td>
                  <td className={compactTableCellClassName}>
                    {isFilled(date) ? date : empty}
                  </td>
                  <td className={cn(compactTableCellClassName, "font-mono")}>
                    {isFilled(reference) ? reference : empty}
                  </td>
                  <td className={compactTableCellClassName}>
                    {isFilled(createdBy) ? createdBy : empty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CompactTableScroll>
    </RecordViewSheetSection>
  );
}
