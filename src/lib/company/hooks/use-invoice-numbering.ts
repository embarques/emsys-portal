"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchInvoiceNumbering, updateInvoiceNumbering } from "@/lib/company/invoice-numbering-api";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export function useInvoiceNumbering(companyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["company-invoice-numbering", companyId];
  const query = useWorkspaceQuery({
    queryKey,
    enabled: Boolean(companyId),
    queryFn: ({ signal }) => fetchInvoiceNumbering(signal),
  });
  const mutation = useMutation({
    mutationFn: updateInvoiceNumbering,
    onSuccess: (settings) => queryClient.setQueryData(queryKey, settings),
  });
  return { query, mutation };
}
