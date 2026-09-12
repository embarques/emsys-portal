"use client";

import { fetchInsightsHistogram } from "@/lib/insights/api/insights-api";
import type { InsightsHistogramResource } from "@/lib/insights/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

const INSIGHTS_HISTOGRAM_STALE_TIME_MS = 10 * 60 * 1000;
const INSIGHTS_HISTOGRAM_GC_TIME_MS = 30 * 60 * 1000;

export function useInsightsHistogram(resource: InsightsHistogramResource) {
  return useWorkspaceQuery({
    queryKey: queryKeys.insights.histogram(resource),
    queryFn: () => fetchInsightsHistogram(resource),
    staleTime: INSIGHTS_HISTOGRAM_STALE_TIME_MS,
    gcTime: INSIGHTS_HISTOGRAM_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
