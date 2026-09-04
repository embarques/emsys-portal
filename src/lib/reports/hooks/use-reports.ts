"use client";

import { useMutation } from "@tanstack/react-query";

import {
  generateIncomeReport,
  generateInvoiceReport,
  generateJournalReport,
  generateLoanReport,
  generateLabelReport,
  generateDeliveryReport,
  generatePickupReport,
} from "@/lib/reports/api/reports-api";
import type { ReportRequest } from "@/lib/reports/types";

export function useGenerateIncomeReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generateIncomeReport(request),
  });
}

export function useGenerateInvoiceReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generateInvoiceReport(request),
  });
}

export function useGenerateJournalReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generateJournalReport(request),
  });
}

export function useGenerateLoanReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generateLoanReport(request),
  });
}

export function useGenerateLabelReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generateLabelReport(request),
  });
}

export function useGeneratePickupReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generatePickupReport(request),
  });
}

export function useGenerateDeliveryReport() {
  return useMutation({
    mutationFn: (request: ReportRequest) => generateDeliveryReport(request),
  });
}
