"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { fetchCurrentUserPreferences, updateCurrentUserPreferences } from "./api";
import { getConfigurationServerSnapshot, getConfigurationSnapshot, subscribeConfigurationStore, syncConfigurationStore } from "./store";
import type { UserPreferenceValues } from "./types";

const preferenceKey = ["users", "current", "preferences"] as const;

export function useUserPreferences() {
  return useWorkspaceQuery({ queryKey: preferenceKey, queryFn: fetchCurrentUserPreferences, staleTime: 60_000 });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCurrentUserPreferences,
    onSuccess: (preference) => {
      syncConfigurationStore(preference);
      queryClient.setQueryData(preferenceKey, preference);
    },
  });
}

export function useConfigurationStore(): UserPreferenceValues {
  const value = useSyncExternalStore(subscribeConfigurationStore, getConfigurationSnapshot, getConfigurationServerSnapshot);
  const query = useUserPreferences();
  useEffect(() => {
    if (query.data) syncConfigurationStore(query.data);
  }, [query.data]);
  return value;
}
