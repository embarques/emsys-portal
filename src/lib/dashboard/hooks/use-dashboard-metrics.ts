"use client";

import {
  toAppointmentDashboardMetrics,
  toClientDashboardMetrics,
  toInvoiceDashboardMetrics,
} from "@/lib/dashboard/api";
import { useInsightsHistogram } from "@/lib/insights/hooks/use-insights-histogram";

export function useAppointmentDashboardMetrics() {
  const query = useInsightsHistogram("appointments");
  return {
    ...query,
    data: query.data ? toAppointmentDashboardMetrics(query.data) : undefined,
  };
}

export function useClientDashboardMetrics() {
  const query = useInsightsHistogram("clients");
  return {
    ...query,
    data: query.data ? toClientDashboardMetrics(query.data) : undefined,
  };
}

export function useInvoiceDashboardMetrics() {
  const query = useInsightsHistogram("invoices");
  return {
    ...query,
    data: query.data ? toInvoiceDashboardMetrics(query.data) : undefined,
  };
}
