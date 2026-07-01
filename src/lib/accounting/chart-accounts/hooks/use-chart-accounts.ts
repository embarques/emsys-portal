"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createChartAccount,
  deleteChartAccount,
  fetchChartAccounts,
  updateChartAccount,
} from "@/lib/accounting/chart-accounts/api/chart-accounts-api";
import type {
  ChartAccountListParams,
  ChartAccountValues,
} from "@/lib/accounting/chart-accounts/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

function useChartAccountsQueryEnabled(extraEnabled = true) {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    extraEnabled &&
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useChartAccounts(params: ChartAccountListParams, enabled = true) {
  const queryEnabled = useChartAccountsQueryEnabled(enabled);

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.accounts(params),
    queryFn: () => fetchChartAccounts(params),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateChartAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ChartAccountValues) => createChartAccount(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}

export function useUpdateChartAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ChartAccountValues }) =>
      updateChartAccount(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}

export function useDeleteChartAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteChartAccount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}
