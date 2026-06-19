"use client";

import { useQuery } from "@tanstack/react-query";

import { classifyApiError } from "@/lib/api/api-error";
import { fetchApiHealth } from "@/lib/api/health-api";
import { queryKeys } from "@/lib/query/query-keys";

const HEALTH_POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useApiHealth() {
  return useQuery({
    queryKey: queryKeys.api.health(),
    queryFn: fetchApiHealth,
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 30_000,
  });
}

export function useApiConnectivityMessage(error: unknown | null | undefined): string | null {
  if (!error) return null;

  const classified = classifyApiError(error);
  return classified.isConnectivityFailure ? classified.message : null;
}
