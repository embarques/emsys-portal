import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { translateCurrent } from "@/lib/i18n/translate-current";
import { apiClient } from "@/lib/api/client";
export type JournalLifecycleCommand = {
    id: string;
    action: "reverse" | "void" | "note";
    requestId: string;
    expectedVersion: number;
    reason: string;
    description: string;
    invoiceId?: string;
};
export async function applyJournalLifecycle(input: JournalLifecycleCommand) {
    const url = `${API_ENDPOINTS.ACCOUNTING_JOURNALS}/${encodeURIComponent(input.id)}/${input.action}`;
    if (input.action === "note")
        return apiClient.patch(url, { expectedVersion: input.expectedVersion, description: input.description });
    const response = await apiClient.post<{ success?: boolean; message?: string; data?: { id?: string } }>(url, { requestId: input.requestId, reason: input.reason, expectedVersion: input.expectedVersion });
    if (response.success === false || !response.data?.id) throw new Error(response.message || translateCurrent("accounting.journalLifecycle.cancellationUnconfirmed"));
    return response;
}
