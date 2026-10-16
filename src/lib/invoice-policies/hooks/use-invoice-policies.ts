"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import {
  createInvoicePolicy,
  deleteInvoicePolicy,
  fetchActiveInvoicePolicies,
  fetchAllInvoicePolicies,
  fetchInvoicePolicy,
  updateInvoicePolicy,
} from "@/lib/invoice-policies/api/invoice-policies-api";
import type { InvoicePolicyFormValues } from "@/lib/invoice-policies/types";

export function useInvoicePolicies() {
  return useWorkspaceQuery({
    queryKey: queryKeys.invoicePolicies.list(),
    queryFn: fetchAllInvoicePolicies,
  });
}

export function useActiveInvoicePolicies(enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.invoicePolicies.active(),
    queryFn: fetchActiveInvoicePolicies,
    enabled,
  });
}

export function useInvoicePolicy(id: number | null) {
  return useWorkspaceQuery({
    queryKey: queryKeys.invoicePolicies.detail(id ?? 0),
    queryFn: () => fetchInvoicePolicy(id!),
    enabled: id != null,
  });
}

export function useInvoicePolicyMutations() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.invoicePolicies.all });
  return {
    create: useMutation({ mutationFn: createInvoicePolicy, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: number; values: InvoicePolicyFormValues }) =>
        updateInvoicePolicy(id, values),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteInvoicePolicy, onSuccess: invalidate }),
  };
}
