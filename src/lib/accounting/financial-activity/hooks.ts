"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAccountingQueryEnabled } from "@/lib/accounting/daily-income/hooks";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { queryKeys } from "@/lib/query/query-keys";
import { clearFinancialPayment, type FinancialActivity, fetchFinancialActivity, fetchActivityHistory, recordActivity, reverseActivity, fetchAutomationSettings, saveAutomationSettings, type ActivityFilters, type EventInput, type AutomationSettings } from "./api";
export function useFinancialActivity(filters: ActivityFilters, page: number) { const ready=useAccountingQueryEnabled(); const { companyId, hasPermission, loading, roleLoading } = useAuth(); return useWorkspaceQuery({ queryKey: queryKeys.accounting.financialActivity(companyId ?? "", filters, page), queryFn: ({ signal }) => fetchFinancialActivity(filters, page, signal), enabled: ready && !!companyId && !loading && !roleLoading && hasPermission("canViewFinancialActivity", "financial_activity") }); }
export function useActivityHistory(id: string | null,directoryOnly=false) { const ready=useAccountingQueryEnabled(); const { companyId, hasPermission } = useAuth(); return useWorkspaceQuery({ queryKey: [...queryKeys.accounting.financialHistory(companyId ?? "", id ?? ""),directoryOnly], queryFn: ({ signal }) => fetchActivityHistory(id!, signal,directoryOnly), enabled: ready && !!companyId && !!id && hasPermission("canViewFinancialActivity", "financial_activity") }); }
export function useRecordActivity() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: {
        id: string;
        input: EventInput;
    }) => recordActivity(id, input), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.accounting.all }) }); }
export function useReverseActivity() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, requestId, reason }: {
        id: string;
        requestId: string;
        reason: string;
    }) => reverseActivity(id, requestId, reason), onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.accounting.all }), client.invalidateQueries({ queryKey: ["invoices"] })]) }); }
export function useAutomationSettings() { const ready=useAccountingQueryEnabled(); const { companyId, hasPermission } = useAuth(); return useWorkspaceQuery({ queryKey: queryKeys.accounting.closeoutAutomation(companyId ?? ""), queryFn: ({ signal }) => fetchAutomationSettings(signal), enabled: ready && !!companyId && hasPermission("canViewSettings", "settings") }); }
export function useSaveAutomation() { const client = useQueryClient(); const { companyId } = useAuth(); return useMutation({ mutationFn: (settings: AutomationSettings) => saveAutomationSettings(settings), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.accounting.closeoutAutomation(companyId ?? "") }) }); }
export function useClearFinancialPayment() { const client = useQueryClient(); return useMutation({ mutationFn: (row: FinancialActivity) => clearFinancialPayment(row), onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.accounting.all }), client.invalidateQueries({ queryKey: ["invoices"] })]) }); }
