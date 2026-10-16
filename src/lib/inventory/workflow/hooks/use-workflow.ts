'use client';
import { useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/hooks/use-auth';
import { useAppSelector } from '@/lib/store/hooks';
import { useWorkspaceQuery } from '@/lib/query/use-workspace-query';
import { listWorkflow, readWorkflow, writeWorkflow, type Write } from '../api/workflow-api';

export function useWorkflowAccess() {
  const { hasPermission } = useAuth();
  return (capability: string) => hasPermission(capability, capability.split('.')[0]);
}
export function useWorkflowScope() { return useAppSelector(state => state.auth.companyId); }
export function useWorkflowList(resource: string, filters: Record<string, string>, enabled: boolean) {
  const company = useWorkflowScope();
  return useInfiniteQuery({ queryKey: ['inventory-workflow', company, resource, filters], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => listWorkflow(resource, filters, pageParam), getNextPageParam: page => page.nextCursor ?? undefined, enabled: Boolean(company) && enabled });
}
export function useWorkflowDetail(resource: string, id?: string, child?: string, enabled = true) {
  const company = useWorkflowScope();
  return useWorkspaceQuery({ queryKey: ['inventory-workflow', company, resource, id, child], queryFn: () => readWorkflow(resource, id!, child), enabled: Boolean(company && id) && enabled });
}
/** Keep the same command key for an identical retry, including an ambiguous network failure. */
export function useWorkflowWrite() {
  const company = useWorkflowScope();
  const client = useQueryClient();
  const pending = useRef<{ signature: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: Omit<Write, 'idempotencyKey'>) => {
      if (!navigator.onLine) throw new Error('Reconnect before saving or posting.');
      const signature = JSON.stringify([company, input]);
      if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
      return writeWorkflow({ ...input, idempotencyKey: pending.current.key });
    },
    onSuccess: async () => {
      pending.current = null;
      await client.invalidateQueries({ queryKey: ['inventory-workflow', company] });
      await client.invalidateQueries({ queryKey: ['inventory'] });
    },
    retry: false,
  });
}
