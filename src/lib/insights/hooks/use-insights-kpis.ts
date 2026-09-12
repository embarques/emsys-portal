"use client";

import { fetchInsightsKpis } from "@/lib/insights/api/insights-api";
import type { InsightsKpiPeriod } from "@/lib/insights/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

const INSIGHTS_KPI_STALE_TIME_MS = 60_000;

type UseInsightsKpisOptions = {
  enabled?: boolean;
};

export function useInsightsKpis(period: InsightsKpiPeriod, options: UseInsightsKpisOptions = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.insights.kpis(period),
    queryFn: () => fetchInsightsKpis(period),
    enabled: options.enabled,
    staleTime: INSIGHTS_KPI_STALE_TIME_MS,
  });
}
