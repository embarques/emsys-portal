"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCheck,
  deleteCheck,
  deleteChecks,
  fetchChecks,
  updateCheck,
} from "@/lib/accounting/checks/api/checks-api";
import {
  DEFAULT_CHECK_LIST_PARAMS,
  type CheckFormValues,
  type CheckListParams,
} from "@/lib/accounting/checks/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

function useChecksQueryEnabled(extraEnabled = true) {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    extraEnabled &&
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useChecks(params: CheckListParams, options: { enabled?: boolean } = {}) {
  const queryEnabled = useChecksQueryEnabled(options.enabled ?? true);

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.checks(params),
    queryFn: () => fetchChecks(params),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });
}

export function useOutstandingChecksCount() {
  const queryEnabled = useChecksQueryEnabled();

  const query = useQuery({
    queryKey: queryKeys.accounting.checksOutstanding(),
    queryFn: () =>
      fetchChecks({
        ...DEFAULT_CHECK_LIST_PARAMS,
        page: 1,
        limit: 1,
        search: { field: "status", operator: "eq", value: "OUTSTANDING" },
      }),
    enabled: queryEnabled,
    staleTime: 30_000,
  });

  return query.data?.total ?? 0;
}

function invalidateChecks(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
  ]);
}

export function useCreateCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CheckFormValues) => createCheck(values),
    onSuccess: () => invalidateChecks(queryClient),
  });
}

export function useUpdateCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checkId,
      values,
      journalId,
    }: {
      checkId: string;
      values: CheckFormValues;
      journalId?: string;
    }) => updateCheck(checkId, values, { journalId }),
    onSuccess: () => invalidateChecks(queryClient),
  });
}

export function useDeleteCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkId: string) => deleteCheck(checkId),
    onSuccess: () => invalidateChecks(queryClient),
  });
}

export function useDeleteChecks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkIds: string[]) => deleteChecks(checkIds),
    onSuccess: () => invalidateChecks(queryClient),
  });
}
