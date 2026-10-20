'use client';
import { useCallback, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { useAppSelector } from '@/lib/store/hooks';
import { useWorkspaceQuery } from '@/lib/query/use-workspace-query';
import { queryKeys } from '@/lib/query/query-keys';
import { listWorkflow, nextWorkflowPage, readWorkflow, workflowError, writeWorkflow, type Write } from '../api/workflow-api';

export function useWorkflowAccess() {
  const { hasPermission } = useAuth();
  return useCallback((capability: string) => hasPermission(capability, capability.split('.')[0]), [hasPermission]);
}

export function useWorkflowScope() {
  return useAppSelector(state => state.auth.companyId);
}

/** Translates `inventory.*` error keys raised by the workflow layer; API messages pass through. */
export function useWorkflowErrorMessage() {
  const { t } = useTranslation();
  return useCallback((error: unknown) => {
    const message = workflowError(error);
    return message.startsWith('inventory.') ? t(message) : message;
  }, [t]);
}

export function useWorkflowList(resource: string, filters: Record<string, string>, enabled: boolean) {
  const company = useWorkflowScope();
  return useInfiniteQuery({
    queryKey: ['inventory-workflow', company, resource, 'list', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listWorkflow(resource, filters, pageParam),
    getNextPageParam: (last, pages) => nextWorkflowPage(last, pages),
    enabled: Boolean(company) && enabled,
  });
}

export function useWorkflowDetail(resource: string, id?: string, child?: string, enabled = true) {
  const company = useWorkflowScope();
  return useWorkspaceQuery({
    queryKey: ['inventory-workflow', company, resource, id, child],
    queryFn: () => readWorkflow(resource, id!, child),
    enabled: Boolean(company && id) && enabled,
  });
}

/** Keep the same command key for an identical retry, including an ambiguous network failure. */
export function useWorkflowWrite() {
  const company = useWorkflowScope();
  const client = useQueryClient();
  const pending = useRef<{ signature: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (input: Omit<Write, 'idempotencyKey'>) => {
      if (!navigator.onLine) throw new Error('inventory.operations.errors.offline');
      const signature = JSON.stringify([company, input]);
      if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
      return writeWorkflow({ ...input, idempotencyKey: pending.current.key });
    },
    onSuccess: async () => {
      pending.current = null;
      await Promise.all([
        client.invalidateQueries({ queryKey: ['inventory-workflow', company] }),
        client.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      ]);
    },
    retry: false,
  });
}
