"use client";

import { useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

import { useWorkspaceTabQueriesEnabled } from "@/lib/layout/workspace-tab-scope";

/**
 * Like `useQuery`, but pauses fetches and refetches while the workspace tab is hidden.
 * Outside the tab panel (e.g. mobile), queries behave normally.
 */
export function useWorkspaceQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  const tabQueriesEnabled = useWorkspaceTabQueriesEnabled();

  return useQuery({
    ...options,
    enabled: tabQueriesEnabled && (options.enabled ?? true),
  });
}
