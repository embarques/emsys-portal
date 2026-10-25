import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
export type FinancialActivity = {
    id: string;
 journalId?:string; sourceType?:string;
    paymentId?: string;
    date?: string;
    recordedAt?: string;
    employee?: {
        id: number;
        name: string;
    };
    branch?: {
        id: number;
        name: string;
    };
    paymentMethod?: {
        name: string;
    };
    invoice?: {
        id: string;
        number: string;
    };
    transactionType: string;
    transactionAmount: number;
    outstandingAmount: number;
    pendingHandoverAmount: number;
    clearingStatus?: string;
    currency: string;
    ageDays: number;
};
export type ActivityEvent = {
    id: string;
    type: string;
    amount: number;
    recordedAt: string;
    performedBy?: {
        id: number;
        name: string;
    };
    fromEmployeeId?: number;
    toEmployeeId?: number;
    handoverId?: string;
    reference?: string;
};
export type EventInput = {
    requestId: string;
    type: string;
    amount: number;
    fromEmployeeId?: number;
    toEmployeeId?: number;
    handoverId?: string;
    reference?: string;
};
export type ActivityFilters = {
    employee: string;
    method: string;
    branch: string;
    from: string;
    through: string;
    minimum: string;
    age: string;
};
export type AutomationSettings = {
    enabled: boolean;
    timezone: string;
    currency: string;
    rate: number;
    branches?: {
        id: number;
        timezone: string;
        currency: string;
        rate: number;
    }[];
};
export function buildActivitySearch(filters: ActivityFilters, page: number) {
    const conditions: {
        field: string;
        operator: string;
        value: string | number;
    }[] = [];
    if (filters.employee.trim())
        conditions.push({ field: "employee.name", operator: "contains", value: filters.employee.trim() });
    if (filters.branch.trim())
        conditions.push({ field: "branch.name", operator: "contains", value: filters.branch.trim() });
    if (filters.method)
        conditions.push({ field: "paymentMethod.name", operator: "eq", value: filters.method });
    if (filters.from)
        conditions.push({ field: "date", operator: "gte", value: `${filters.from}T00:00:00Z` });
    if (filters.through)
        conditions.push({ field: "date", operator: "lte", value: `${filters.through}T23:59:59.999Z` });
    if (filters.minimum !== "" && Number.isFinite(Number(filters.minimum)))
        conditions.push({ field: "outstandingAmount", operator: "gte", value: Number(filters.minimum) });
    if (filters.age !== "" && Number.isFinite(Number(filters.age)))
        conditions.push({ field: "ageDays", operator: "gte", value: Number(filters.age) });
    return { filters: conditions, pagination: { page, limit: 40 }, sort: [{ field: "createdAt", direction: "desc" }] };
}
export async function fetchFinancialActivity(filters: ActivityFilters, page: number, signal?: AbortSignal) {
    const result = await apiClient.post<PaginatedApiEnvelope<FinancialActivity[]>>(`${API_ENDPOINTS.FINANCIAL_ACTIVITY}/search`, buildActivitySearch(filters, page), { signal });
    return { items: result.data ?? [], total: result.total ?? 0 };
}
export async function fetchActivityHistory(id: string, signal?: AbortSignal, directoryOnly=false) { const result = await apiClient.get<PaginatedApiEnvelope<ActivityEvent[]>>(directoryOnly ? `${API_ENDPOINTS.FINANCIAL_ACTIVITY}/payment-events/${id}` : `${API_ENDPOINTS.FINANCIAL_ACTIVITY}/${id}/events`, { signal }); return result.data ?? []; }
export async function recordActivity(id: string, input: EventInput) { return apiClient.post(`${API_ENDPOINTS.FINANCIAL_ACTIVITY}/${id}/events`, input); }
export async function reverseActivity(id: string, requestId: string, reason: string) { return apiClient.post(`${API_ENDPOINTS.ACCOUNTING_JOURNALS}/${id}/reverse`, { requestId, reason }); }
export async function fetchAutomationSettings(signal?: AbortSignal) { const result = await apiClient.get<PaginatedApiEnvelope<AutomationSettings>>(`${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENTS}/automation`, { signal }); if (!result.data)
    throw new Error(result.message ?? "Unable to load settings"); return result.data; }
export async function saveAutomationSettings(settings: AutomationSettings) { return apiClient.put(`${API_ENDPOINTS.ACCOUNTING_INCOME_STATEMENTS}/automation`, settings); }
export function clearingAction(row: FinancialActivity) {
    const method = (row.paymentMethod?.name ?? "").trim().toUpperCase().replace(/_/g, "-");
    const actions: Record<string, {
        path: string;
        name: string;
        resource: string;
    }> = { CHECK: { path: "/checks", name: "canUpdateCheck", resource: "check" }, CHEQUE: { path: "/checks", name: "canUpdateCheck", resource: "check" }, ZELLE: { path: "/zelle-payments", name: "canUpdateZellePayment", resource: "zelle_payment" }, DEPOSIT: { path: "/deposits", name: "canUpdateDeposit", resource: "deposit" }, "CREDIT-CARD": { path: "/credit-card-payments", name: "canUpdateCreditCardPayment", resource: "credit_card_payment" } };
    return row.paymentId && row.clearingStatus?.toUpperCase() !== "CLEARED" ? actions[method] : undefined;
}
export async function clearFinancialPayment(row: FinancialActivity) { const action = clearingAction(row); if (!action || !row.paymentId)
    throw new Error("Payment cannot be cleared"); return apiClient.put(`${action.path}/${row.paymentId}`, { status: "CLEARED" }); }
