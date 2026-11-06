"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAppSelector } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { createChange, fetchChanges, fetchChangeTarget, reviewChange, type ChangeResource } from "./api";
import { changeAffectedPrefixes } from "./utils/invalidation";

const key = "change-requests";

function useChangeScope() {
  const auth = useAuth();
  const transport = useAppSelector(state => state.auth);
  return {
    ...auth,
    scope: [auth.companyId, auth.user?.uid ?? auth.email, auth.roleId,
      auth.permissions.map(value => `${value.resourceType}:${value.name}`).sort().join("|")] as const,
    ready: !auth.loading && !auth.roleLoading && Boolean(transport.idToken && auth.companyId && auth.companyId === transport.companyId),
  };
}

export function useChanges(page: number) {
  const { hasPermission, scope, ready } = useChangeScope();
  return useWorkspaceQuery({
    queryKey: [key, ...scope, page],
    queryFn: ({ signal }) => fetchChanges(page, signal),
    enabled: ready && hasPermission("canViewChangeRequest", "change_request"),
    retry: false,
  });
}

export function useChangeTarget(resource: ChangeResource, id: string, active: boolean) {
  const { hasPermission, scope, ready } = useChangeScope();
  return useWorkspaceQuery({
    queryKey: [key, ...scope, "target", resource, id],
    queryFn: ({ signal }) => fetchChangeTarget(resource, id, signal),
    enabled: ready && active && Boolean(id.trim()) && hasPermission("canCreateChangeRequest", "change_request"),
    retry: false,
  });
}

export function useSubmitChange() {
  const client = useQueryClient();
  const { companyId, ready, hasPermission } = useChangeScope();
  return useMutation({
    mutationFn: (input: Parameters<typeof createChange>[0]) => {
      if (!ready || store.getState().auth.companyId !== companyId || !hasPermission("canCreateChangeRequest", "change_request")) throw new Error("Access denied");
      return createChange(input);
    },
    retry: false,
    onMutate: () => ({ companyId }),
    onSuccess: (_result, _input, context) => client.invalidateQueries({ queryKey: [key, context.companyId] }),
  });
}

export function useReviewChange() {
  const client = useQueryClient();
  const { companyId, ready, hasPermission } = useChangeScope();
  return useMutation({
    mutationFn: (input: Parameters<typeof reviewChange>[0]) => {
      if (!ready || store.getState().auth.companyId !== companyId || !hasPermission("canApproveChangeRequest", "change_request")) throw new Error("Access denied");
      return reviewChange(input);
    },
    retry: false,
    onMutate: () => ({ companyId }),
    onSuccess: async (_result, input, context) => {
      await client.invalidateQueries({ queryKey: [key, context.companyId] });
      // Legacy resource keys lack company scope. Do not refetch them under a new tenant's headers.
      if (!input.approve || store.getState().auth.companyId !== context.companyId) return;
      await Promise.all(changeAffectedPrefixes(input.resourceType).map(prefix =>
        client.invalidateQueries({ queryKey: [prefix] })));
    },
  });
}
