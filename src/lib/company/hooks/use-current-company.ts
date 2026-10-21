"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/lib/store/hooks";
import { fetchCurrentCompany, updateCompanyPolicy } from "@/lib/company/api/company-api";

export function useCurrentCompany() {
  const { companyId, idToken } = useAppSelector((state) => state.auth);
  return useQuery({
    queryKey: ["company", companyId],
    queryFn: fetchCurrentCompany,
    enabled: Boolean(companyId && idToken),
  });
}

export function useGoogleMapsApiKey(): string {
  const { companyId, idToken } = useAppSelector((state) => state.auth);
  const { data } = useCurrentCompany();
  return idToken && data?.id === companyId ? data.googleMapsApiKey?.trim() ?? "" : "";
}

export function useIsGoogleMapsConfigured(): boolean {
  return Boolean(useGoogleMapsApiKey());
}

export function useUpdateCompanyPolicy() {
  const { companyId } = useAppSelector((state) => state.auth);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyUrl }: { policyUrl: string }) => updateCompanyPolicy(policyUrl),
    onSuccess: (company) => {
      queryClient.setQueryData(["company", company.id], company);
      void queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
  });
}
