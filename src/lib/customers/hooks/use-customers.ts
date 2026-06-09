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
import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  type CustomerFormValues,
  type CustomerListParams,
  type CustomerSearchFilter,
} from "@/lib/customers/types";
import { queryKeys } from "@/lib/query/query-keys";

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
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerStats() {
  const totalQuery = useQuery({
    queryKey: queryKeys.customers.stats("all"),
    queryFn: () => fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1 }),
  });

  const activeQuery = useQuery({
    queryKey: queryKeys.customers.stats("active"),
    queryFn: () => fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1, active: true }),
  });

  const inactiveQuery = useQuery({
    queryKey: queryKeys.customers.stats("inactive"),
    queryFn: () => fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1, active: false }),
  });

  const type1Query = useQuery({
    queryKey: queryKeys.customers.stats("type1"),
    queryFn: () => fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1, customerType: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    active: activeQuery.data?.total ?? 0,
    inactive: inactiveQuery.data?.total ?? 0,
    type1: type1Query.data?.total ?? 0,
    isLoading:
      totalQuery.isLoading ||
      activeQuery.isLoading ||
      inactiveQuery.isLoading ||
      type1Query.isLoading,
    isError:
      totalQuery.isError || activeQuery.isError || inactiveQuery.isError || type1Query.isError,
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
