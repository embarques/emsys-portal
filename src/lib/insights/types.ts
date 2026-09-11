import type { RollingStatPeriod } from "@/lib/stats/rolling-period";

export const INSIGHTS_KPI_PERIODS = ["7d", "30d", "3m", "6m", "1y"] as const;

export type InsightsKpiPeriod = RollingStatPeriod;

export const DEFAULT_INSIGHTS_KPI_PERIOD: InsightsKpiPeriod = "30d";

export const INSIGHTS_HISTOGRAM_RESOURCES = ["appointments", "clients", "invoices"] as const;

export type InsightsHistogramResource = (typeof INSIGHTS_HISTOGRAM_RESOURCES)[number];

export type InsightsWindow = {
  start: string;
  end: string;
};

export type InsightsCountKpi = {
  count: number;
  previousCount: number;
};

export type InsightsAverageValueKpi = {
  average: number;
  previousAverage: number;
  containerCount: number;
  totalValue: number;
};

export type InsightsKpis = {
  period: InsightsKpiPeriod;
  timezone: string;
  window: InsightsWindow;
  previousWindow: InsightsWindow;
  newAppointments: InsightsCountKpi;
  newInvoices: InsightsCountKpi;
  newCustomers: InsightsCountKpi;
  departedContainers: InsightsCountKpi;
  averageValuePerContainer: InsightsAverageValueKpi;
};

export type InsightsBucketCount = {
  bucket: number;
  count: number;
};

export type InsightsHistogram = {
  resource: InsightsHistogramResource;
  timezone: string;
  createdByWeekday: InsightsBucketCount[];
  createdByMonth: InsightsBucketCount[];
  scheduledByWeekday: InsightsBucketCount[];
  scheduledByMonth: InsightsBucketCount[];
};
