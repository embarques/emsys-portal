"use client";

import { keepPreviousData, useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useWorkspaceTabQueriesEnabled } from "@/lib/layout/workspace-tab-scope";

import {
  createCustomer,
  deleteCustomer,
  deleteCustomers,
  fetchCustomerAutocomplete,
  fetchCustomerById,
  fetchCustomers,
  updateCustomer,
  updateCustomerAddressGoogleVerification,
  updateCustomerAddressLocation,
} from "@/lib/customers/api/customers-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  type AddressGeoLocation,
  type AddressVerification,
  type CustomerFormValues,
  type CustomerListParams,
  type CustomerSearchFilter,
} from "@/lib/customers/types";
import { isCustomerTypeFilterActive } from "@/lib/customers/customer-type";
import { useInsightsKpis } from "@/lib/insights/hooks/use-insights-kpis";
import type { NewCustomerStatPeriod } from "@/lib/customers/new-customer-stats";
import { queryKeys } from "@/lib/query/query-keys";

function hasCustomerChipFilters(params: CustomerListParams): boolean {
  return (
    (params.branch !== undefined && params.branch !== "all") ||
    isCustomerTypeFilterActive(params.customerType)
  );
}

function isCustomerListFiltered(params: CustomerListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) => isCompleteFilterRow(row));
  return hasListTextSearch(params.search) || hasRowFilters || hasCustomerChipFilters(params);
}

export function useCustomerAutocomplete(
  query: string,
  customerType: "sender" | "receiver",
  options: { enabled?: boolean; limit?: number } = {},
) {
  const trimmed = query.trim();
  const limit = options.limit ?? 20;
  const enabled = (options.enabled ?? true) && trimmed.length > 0;

  return useWorkspaceQuery({
    queryKey: queryKeys.customers.autocomplete(trimmed, customerType, limit),
    queryFn: () => fetchCustomerAutocomplete({ q: trimmed, customerType, limit }),
    enabled,
  });
}

export function useCustomerSearch(
  search: CustomerSearchFilter | undefined,
  options: {
    enabled?: boolean;
    limit?: number;
    customerType?: number | "all";
    orFields?: readonly string[];
  } = {},
) {
  const { enabled = true, limit = 40, customerType, orFields } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.customers.search(search, limit, { customerType, orFields }),
    queryFn: () =>
      fetchCustomers({
        ...DEFAULT_CUSTOMER_LIST_PARAMS,
        limit,
        search,
        customerType,
        orFields,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useCustomers(params: CustomerListParams) {
  const isFiltered = isCustomerListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useCustomerStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.customers.stats("all"),
    queryFn: () => fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1 }),
  });

  const receiversQuery = useWorkspaceQuery({
    queryKey: queryKeys.customers.stats("receivers"),
    queryFn: () =>
      fetchCustomers({ ...DEFAULT_CUSTOMER_LIST_PARAMS, limit: 1, customerType: CUSTOMER_TYPE_RECEIVER }),
  });

  const sendersQuery = useWorkspaceQuery({
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

/** Count of customers created within a rolling timeframe, plus prior-period count for % change. */
export function useNewCustomerStats(period: NewCustomerStatPeriod) {
  const query = useInsightsKpis(period);

  return {
    total: query.data?.newCustomers.count ?? 0,
    previousTotal: query.data?.newCustomers.previousCount ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}

export function useCustomer(customerId: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.customers.detail(customerId ?? ""),
    queryFn: () => fetchCustomerById(customerId!),
    enabled: enabled && Boolean(customerId),
  });
}

export function useEnsureCustomerDetail() {
  const queryClient = useQueryClient();

  return async (customerId: string, options?: { staleTime?: number }) => {
    return queryClient.fetchQuery({
      queryKey: queryKeys.customers.detail(customerId),
      queryFn: () => fetchCustomerById(customerId),
      staleTime: options?.staleTime ?? 60_000,
    });
  };
}

export function useCustomerDetailsBatch(customerIds: string[], enabled = true) {
  const tabQueriesEnabled = useWorkspaceTabQueriesEnabled();

  return useQueries({
    queries: customerIds.map((customerId) => ({
      queryKey: queryKeys.customers.detail(customerId),
      queryFn: () => fetchCustomerById(customerId),
      enabled: tabQueriesEnabled && enabled && Boolean(customerId),
      staleTime: 60_000,
    })),
  });
}

export function useCustomerPicker(limit = 200) {
  return useCustomers({
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    limit,
  });
}

function invalidateCustomers(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
  ]);
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

export function useUpdateCustomerAddressLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, location }: { customerId: string; location: AddressGeoLocation }) =>
      updateCustomerAddressLocation(customerId, location),
    onSuccess: (_data, variables) => {
      invalidateCustomers(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(variables.customerId),
      });
    },
  });
}

export function useUpdateCustomerAddressGoogleVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      verification,
    }: {
      customerId: string;
      verification: AddressVerification;
    }) => updateCustomerAddressGoogleVerification(customerId, verification),
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
