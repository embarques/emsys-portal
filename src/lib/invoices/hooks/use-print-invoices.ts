"use client";

import { useCallback } from "react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import {
  openInvoiceReportUrl,
  resolveInvoiceReportLookup,
} from "@/lib/invoices/print-invoice-report";
import { useGenerateInvoiceReport } from "@/lib/reports/hooks/use-reports";

export function usePrintInvoices() {
  const { notifySuccess, notifyError } = useFeedback();
  const generateInvoiceReportMutation = useGenerateInvoiceReport();

  const printInvoice = useCallback(
    async (input: {
      invoiceId?: string | null;
      invoiceNumber?: string | null;
      savedInvoiceId?: string | null;
      successMessage?: string;
    }): Promise<string | null> => {
      const lookup = resolveInvoiceReportLookup(input);
      if (!lookup) {
        const message = "Enter an invoice number or save the invoice before printing.";
        notifyError(message);
        return message;
      }

      try {
        const report = await generateInvoiceReportMutation.mutateAsync({
          type: "invoice",
          collection: "invoices",
          values: lookup.values,
          lookupField: lookup.lookupField,
        });
        openInvoiceReportUrl(report.url);
        notifySuccess(
          input.successMessage ??
            (input.invoiceNumber?.trim()
              ? `Invoice report ready for #${input.invoiceNumber.trim()}.`
              : "Invoice report ready."),
        );
        return null;
      } catch (error) {
        const message = normalizeApiError(error).message;
        notifyError(message);
        return message;
      }
    },
    [generateInvoiceReportMutation, notifyError, notifySuccess],
  );

  const printInvoiceIds = useCallback(
    async (invoiceIds: string[], successMessage?: string): Promise<string | null> => {
      const ids = invoiceIds.map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        const message = "Select at least one invoice to print.";
        notifyError(message);
        return message;
      }

      try {
        const report = await generateInvoiceReportMutation.mutateAsync({
          type: "invoice",
          collection: "invoices",
          values: ids,
          lookupField: "id",
        });
        openInvoiceReportUrl(report.url);
        notifySuccess(successMessage ?? `Invoice report ready for ${ids.length} invoice(s).`);
        return null;
      } catch (error) {
        const message = normalizeApiError(error).message;
        notifyError(message);
        return message;
      }
    },
    [generateInvoiceReportMutation, notifyError, notifySuccess],
  );

  return {
    printInvoice,
    printInvoiceIds,
    isPrinting: generateInvoiceReportMutation.isPending,
  };
}
