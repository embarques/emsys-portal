"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";
import { useAppSelector } from "@/lib/store/hooks";
import { fetchApiVersion } from "@/lib/system/api/version-api";

/** Keep the API version for this session; opening About never refreshes it. */
export function useSessionVersion() {
  const { idToken, companyId } = useAppSelector((state) => state.auth);
  return useQuery({
    queryKey: queryKeys.sessionVersion.detail(companyId),
    queryFn: ({ signal }) => fetchApiVersion(signal),
    enabled: Boolean(idToken && companyId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
