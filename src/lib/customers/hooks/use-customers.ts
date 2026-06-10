"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCustomer,
  deleteCustomer,
  deleteCustomers,
  fetchCustomerById,
  fetchCustomers,
  updateCustomer,
} from "@/lib/customers/api/customers-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  type CustomerFormValues,
  type CustomerListParams,
  type CustomerSearchFilter,
} from "@/lib/customers/types";
import { isCustomerTypeFilterActive } from "@/lib/customers/customer-type";
import { queryKeys } from "@/lib/query/query-keys";

function hasCustomerChipFilters(params: CustomerListParams): boolean {
  return (
    (params.branch !== undefined && params.branch !== "all") ||
    isCustomerTypeFilterActive(params.customerType)
  );
}

function isCustomerListFiltered(params: CustomerListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some(isCompleteFilterRow);
  return hasListTextSearch(params.search) || hasRowFilters || hasCustomerChipFilters(params);
}

export function useCustomerSearch(
  search: CustomerSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.customers.search(search, limit),
    queryFn: () =>
      fetchCustomers({
        ...DEFAULT_CUSTOMER_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useCustomers(params: CustomerListParams) {
  const isFiltered = isCustomerListFiltered(params);

  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useCustomerStats() {
  const totalQuery = useQuery({
    queryKey: queryKeys.customers.stats("all"),
    queryFn: () => fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1 }),
  });

  const receiversQuery = useQuery({
    queryKey: queryKeys.customers.stats("receivers"),
    queryFn: () =>
      fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1, customerType: CUSTOMER_TYPE_RECEIVER }),
  });

  const sendersQuery = useQuery({
    queryKey: queryKeys.customers.stats("senders"),
    queryFn: () =>
      fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1, customerType: CUSTOMER_TYPE_SENDER }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    senders: sendersQuery.data?.total ?? 0,
    receivers: receiversQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading || sendersQuery.isLoading || receiversQuery.isLoading,
    isError: totalQuery.isError || sendersQuery.isError || receiversQuery.isError,
  };
}

export function useCustomer(customerId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.detail(customerId ?? ""),
    queryFn: () => fetchCustomerById(customerId!),
    enabled: enabled && Boolean(customerId),
  });
}

export function useCustomerPicker(limit = 200) {
  return useCustomers({
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    limit,
  });
}

function invalidateCustomers(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CustomerFormValues) => createCustomer(values),
    onSuccess: () => invalidateCustomers(queryClient),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, values }: { customerId: string; values: CustomerFormValues }) =>
      updateCustomer(customerId, values),
    onSuccess: (_data, variables) => {
      invalidateCustomers(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(variables.customerId),
      });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerId: string) => deleteCustomer(customerId),
    onSuccess: () => invalidateCustomers(queryClient),
  });
}

export function useDeleteCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerIds: string[]) => deleteCustomers(customerIds),
    onSuccess: () => invalidateCustomers(queryClient),
  });
}
