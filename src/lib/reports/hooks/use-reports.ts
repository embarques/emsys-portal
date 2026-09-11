"use client";

import { useMutation } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  fetchReportDefinitions,
  generateIncomeReport,
  generateInvoiceReport,
  generateJournalReport,
  generateLoanReport,
  generateLabelReport,
  generateDeliveryReport,
  generatePickupReport,
  requestReportGeneration,
} from "@/lib/reports/api/reports-api";
import { queryKeys } from "@/lib/query/query-keys";
import type { NormalizedReportRequest, ReportRequest } from "@/lib/reports/types";

export function useReportDefinitions() {
  return useWorkspaceQuery({
    queryKey: queryKeys.reports.definitions(),
    queryFn: fetchReportDefinitions,
  });
}

export function useRequestReportGeneration() {
  return useMutation({
    mutationFn: (request: NormalizedReportRequest) => requestReportGeneration(request),
  });
}

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
