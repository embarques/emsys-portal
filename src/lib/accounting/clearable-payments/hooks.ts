"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchClearablePayments,
  updateClearablePayment,
} from "@/lib/accounting/clearable-payments/api";
import type { ClearablePaymentMethodConfig } from "@/lib/accounting/clearable-payments/configs";
import {
  DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
  type ClearablePaymentFormValues,
  type ClearablePaymentListParams,
} from "@/lib/accounting/clearable-payments/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

function useClearablePaymentsQueryEnabled(extraEnabled = true) {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    extraEnabled &&
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useClearablePayments(
  config: ClearablePaymentMethodConfig,
  params: ClearablePaymentListParams,
  options: { enabled?: boolean } = {},
) {
  const queryEnabled = useClearablePaymentsQueryEnabled(options.enabled ?? true);

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.clearablePayments(config.queryKeySegment, params),
    queryFn: () => fetchClearablePayments(config.endpoint, params),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });
}

export function useOutstandingClearablePaymentsCount(config: ClearablePaymentMethodConfig) {
  const queryEnabled = useClearablePaymentsQueryEnabled();

  const query = useQuery({
    queryKey: queryKeys.accounting.clearablePaymentsOutstanding(config.queryKeySegment),
    queryFn: () =>
      fetchClearablePayments(config.endpoint, {
        ...DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
        page: 1,
        limit: 1,
        search: { field: "status", operator: "eq", value: "OUTSTANDING" },
      }),
    enabled: queryEnabled,
    staleTime: 30_000,
    retry: false,
  });

  return query.data?.total ?? 0;
}

function invalidateClearablePayments(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
  ]);
}

export function useUpdateClearablePayment(config: ClearablePaymentMethodConfig) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      values,
      journalId,
    }: {
      paymentId: string;
      values: ClearablePaymentFormValues;
      journalId?: string;
    }) => updateClearablePayment(config.endpoint, paymentId, values, { journalId }),
    onSuccess: () => invalidateClearablePayments(queryClient),
  });
}
