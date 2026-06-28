"use client";

import { useMutation } from "@tanstack/react-query";

import {
  generateInvoiceReport,
  type InvoiceReportRequest,
} from "@/lib/invoices/api/invoice-reports-api";

export function useGenerateInvoiceReport() {
  return useMutation({
    mutationFn: (request: InvoiceReportRequest) => generateInvoiceReport(request),
  });
}
