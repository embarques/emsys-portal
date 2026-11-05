import { apiClient } from "@/lib/api/client";
export type ChangeResource = "pickup" | "invoice" | "journal" | "labels" | "inventory";
export type ChangeRequest = {
    id: string;
    resourceType: ChangeResource;
    resourceId: string;
    action: "UPDATE" | "VOID";
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    reviewReason?: string;
    originalValues?: Record<string, unknown>;
    proposedChanges?: Record<string, unknown>;
    requestedBy: {
        id: number;
        name: string;
    };
    reviewedBy?: {
        id: number;
        name: string;
    };
};
export type TargetContext = {
    resourceType: ChangeResource;
    resourceId: string;
    version: string;
    allowedActions: {
        request_update?: boolean;
        request_void?: boolean;
        approve_change?: boolean;
    };
};
export type NewChange = {
    requestId: string;
    resourceType: ChangeResource;
    resourceId: string;
    action: "UPDATE" | "VOID";
    expectedVersion: string;
    reason: string;
    proposedChanges?: Record<string, unknown>;
};
export async function fetchChanges(page: number, signal?: AbortSignal) { return apiClient.get<{
    data: ChangeRequest[];
    total: number;
}>(`/change-requests?page=${page}&limit=25&sort=createdAt:desc`, { signal }); }
export async function fetchChangeTarget(resourceType: ChangeResource, resourceId: string, signal?: AbortSignal) { return apiClient.get<{
    data: TargetContext;
}>(`/change-requests/target?${new URLSearchParams({ resourceType, resourceId })}`, { signal }); }
export async function createChange(input: NewChange) { return apiClient.post<{
    data: ChangeRequest;
}>("/change-requests", input); }
export async function reviewChange(input: {
    id: string;
    approve: boolean;
    reason: string;
}) { return apiClient.post<{
    data: ChangeRequest;
}>(`/change-requests/${encodeURIComponent(input.id)}/${input.approve ? "approve" : "reject"}`, { reason: input.reason }); }
