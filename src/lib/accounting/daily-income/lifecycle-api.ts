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
    const url = `/journals/${encodeURIComponent(input.id)}/${input.action}`;
    if (input.action === "note")
        return apiClient.patch(url, { expectedVersion: input.expectedVersion, description: input.description });
    return apiClient.post(url, { requestId: input.requestId, reason: input.reason, expectedVersion: input.expectedVersion });
}
