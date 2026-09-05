"use client";

import {
  fetchAppointmentDashboardMetrics,
  fetchClientDashboardMetrics,
  fetchInvoiceDashboardMetrics,
} from "@/lib/dashboard/api";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

const DASHBOARD_METRICS_STALE_TIME_MS = 10 * 60 * 1000;
const DASHBOARD_METRICS_GC_TIME_MS = 30 * 60 * 1000;

const dashboardQueryOptions = {
  staleTime: DASHBOARD_METRICS_STALE_TIME_MS,
  gcTime: DASHBOARD_METRICS_GC_TIME_MS,
  refetchOnWindowFocus: false,
} as const;

type DashboardMetricsQueryOptions = {
  enabled?: boolean;
};

export function useAppointmentDashboardMetrics(options: DashboardMetricsQueryOptions = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.dashboard.appointments(),
    queryFn: fetchAppointmentDashboardMetrics,
    enabled: options.enabled,
    ...dashboardQueryOptions,
  });
}

export function useClientDashboardMetrics(options: DashboardMetricsQueryOptions = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.dashboard.clients(),
    queryFn: fetchClientDashboardMetrics,
    enabled: options.enabled,
    ...dashboardQueryOptions,
  });
}

export function useInvoiceDashboardMetrics(options: DashboardMetricsQueryOptions = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.dashboard.invoices(),
    queryFn: fetchInvoiceDashboardMetrics,
    enabled: options.enabled,
    ...dashboardQueryOptions,
  });
}
