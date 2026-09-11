import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import { isRollingStatPeriod } from "@/lib/stats/rolling-period";
import {
  DEFAULT_INSIGHTS_KPI_PERIOD,
  INSIGHTS_HISTOGRAM_RESOURCES,
  type InsightsAverageValueKpi,
  type InsightsBucketCount,
  type InsightsCountKpi,
  type InsightsHistogram,
  type InsightsHistogramResource,
  type InsightsKpiPeriod,
  type InsightsKpis,
  type InsightsWindow,
} from "@/lib/insights/types";

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeWindow(raw: unknown): InsightsWindow {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    start: asString(value.start),
    end: asString(value.end),
  };
}

function normalizeCountKpi(raw: unknown): InsightsCountKpi {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    count: asFiniteNumber(value.count),
    previousCount: asFiniteNumber(value.previousCount),
  };
}

function normalizeAverageValueKpi(raw: unknown): InsightsAverageValueKpi {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    average: asFiniteNumber(value.average),
    previousAverage: asFiniteNumber(value.previousAverage),
    containerCount: asFiniteNumber(value.containerCount),
    totalValue: asFiniteNumber(value.totalValue),
  };
}

function normalizePeriod(value: unknown): InsightsKpiPeriod {
  return typeof value === "string" && isRollingStatPeriod(value)
    ? value
    : DEFAULT_INSIGHTS_KPI_PERIOD;
}

function normalizeKpis(raw: unknown): InsightsKpis {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    period: normalizePeriod(value.period),
    timezone: asString(value.timezone),
    window: normalizeWindow(value.window),
    previousWindow: normalizeWindow(value.previousWindow),
    newAppointments: normalizeCountKpi(value.newAppointments),
    newInvoices: normalizeCountKpi(value.newInvoices),
    newCustomers: normalizeCountKpi(value.newCustomers),
    departedContainers: normalizeCountKpi(value.departedContainers),
    averageValuePerContainer: normalizeAverageValueKpi(value.averageValuePerContainer),
  };
}

function normalizeBucket(raw: unknown): InsightsBucketCount | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const bucket = asFiniteNumber(value.bucket, Number.NaN);
  const count = asFiniteNumber(value.count, Number.NaN);
  if (!Number.isFinite(bucket) || !Number.isFinite(count)) return null;
  return { bucket, count };
}

function normalizeBuckets(raw: unknown): InsightsBucketCount[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBucket).filter((item): item is InsightsBucketCount => item != null);
}

function isHistogramResource(value: string): value is InsightsHistogramResource {
  return (INSIGHTS_HISTOGRAM_RESOURCES as readonly string[]).includes(value);
}

function normalizeHistogram(
  raw: unknown,
  fallbackResource: InsightsHistogramResource,
): InsightsHistogram {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const resourceRaw = asString(value.resource, fallbackResource);
  return {
    resource: isHistogramResource(resourceRaw) ? resourceRaw : fallbackResource,
    timezone: asString(value.timezone),
    createdByWeekday: normalizeBuckets(value.createdByWeekday),
    createdByMonth: normalizeBuckets(value.createdByMonth),
    scheduledByWeekday: normalizeBuckets(value.scheduledByWeekday),
    scheduledByMonth: normalizeBuckets(value.scheduledByMonth),
  };
}

export async function fetchInsightsKpis(period: InsightsKpiPeriod): Promise<InsightsKpis> {
  const query = new URLSearchParams({ period });
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(
    `${API_ENDPOINTS.INSIGHTS_KPIS}?${query.toString()}`,
  );
  return normalizeKpis(unwrapApiData(response));
}

export async function fetchInsightsHistogram(
  resource: InsightsHistogramResource,
): Promise<InsightsHistogram> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(
    `${API_ENDPOINTS.INSIGHTS_HISTOGRAMS}/${resource}`,
  );
  return normalizeHistogram(unwrapApiData(response), resource);
}
