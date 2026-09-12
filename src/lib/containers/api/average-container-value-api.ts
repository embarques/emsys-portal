import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import {
  DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD,
  isDepartedContainerStatPeriod,
  type DepartedContainerStatPeriod,
} from "@/lib/containers/departed-container-stats";
import type {
  AverageContainerValueStats,
  ContainerStatsWindow,
} from "@/lib/containers/average-container-value";

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeWindow(raw: unknown): ContainerStatsWindow {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    start: asString(value.start),
    end: asString(value.end),
  };
}

function normalizePeriod(value: unknown): DepartedContainerStatPeriod {
  return typeof value === "string" && isDepartedContainerStatPeriod(value)
    ? value
    : DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD;
}

function normalizeAverageContainerValueStats(raw: unknown): AverageContainerValueStats {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    period: normalizePeriod(value.period),
    timezone: asString(value.timezone),
    window: normalizeWindow(value.window),
    previousWindow: normalizeWindow(value.previousWindow),
    average: asFiniteNumber(value.average),
    previousAverage: asFiniteNumber(value.previousAverage),
    containerCount: asFiniteNumber(value.containerCount),
    totalValue: asFiniteNumber(value.totalValue),
  };
}

/**
 * Rolling merchandise average for containers that departed in `period`.
 * Server-side: non-void invoices assigned by `invoice.container._id`,
 * invoice dates are not filtered, detail totals with invoice `cost` fallback,
 * empty departed containers count as $0.
 */
export async function fetchAverageContainerValueStats(
  period: DepartedContainerStatPeriod,
): Promise<AverageContainerValueStats> {
  const query = new URLSearchParams({ period });
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(
    `${API_ENDPOINTS.CONTAINERS_AVERAGE_VALUE}?${query.toString()}`,
  );
  return normalizeAverageContainerValueStats(unwrapApiData(response));
}
