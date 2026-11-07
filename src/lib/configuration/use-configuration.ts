"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { fetchCurrentUserPreferences, updateCurrentUserPreferences } from "./api";
import { getConfigurationServerSnapshot, getConfigurationSnapshot, subscribeConfigurationStore, syncConfigurationStore } from "./store";
import type { UserPreferenceValues } from "./types";

function usePreferenceScope() {
  const { companyId, user, email } = useAuth();
  return { key: ["users", "current", "preferences", companyId, user?.uid ?? email] as const, ready: Boolean(companyId && (user?.uid || email)) };
}

export function useUserPreferences() {
  const scope = usePreferenceScope();
  return useWorkspaceQuery({ queryKey: scope.key, enabled: scope.ready, queryFn: fetchCurrentUserPreferences, staleTime: 60_000 });
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  const scope = usePreferenceScope();
  return useMutation({
    mutationFn: updateCurrentUserPreferences,
    onSuccess: (preference) => {
      syncConfigurationStore(preference);
      queryClient.setQueryData(scope.key, preference);
      void queryClient.invalidateQueries({ queryKey: ["invoice-pool"] });
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
