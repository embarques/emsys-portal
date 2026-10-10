"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/lib/store/hooks";
import { fetchCurrentCompany } from "@/lib/company/api/company-api";

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
