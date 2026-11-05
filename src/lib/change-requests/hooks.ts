"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { createChange, fetchChanges, fetchChangeTarget, reviewChange, type ChangeResource } from "./api";
const key = "change-requests";
function useChangeScope() { const auth = useAuth(); return { ...auth, scope: [auth.companyId, auth.user?.uid ?? auth.email, auth.roleId, auth.permissions.map(value => `${value.resourceType}:${value.name}`).sort().join("|")] as const, ready: !auth.loading && !auth.roleLoading && Boolean(auth.companyId) }; }
export function useChanges(page: number) { const { hasPermission, scope, ready } = useChangeScope(); return useWorkspaceQuery({ queryKey: [key, ...scope, page], queryFn: ({ signal }) => fetchChanges(page, signal), enabled: ready && (hasPermission("canViewChangeRequest", "change_request") || hasPermission("canCreateChangeRequest", "change_request") || hasPermission("canApproveChangeRequest", "change_request")) }); }
export function useChangeTarget(resource: ChangeResource, id: string, active: boolean) { const { hasPermission, scope, ready } = useChangeScope(); return useWorkspaceQuery({ queryKey: [key, ...scope, "target", resource, id], queryFn: ({ signal }) => fetchChangeTarget(resource, id, signal), enabled: ready && active && Boolean(id.trim()) && hasPermission("canCreateChangeRequest", "change_request") }); }
export function useSubmitChange() { const client = useQueryClient(); const { companyId } = useAuth(); return useMutation({ mutationFn: createChange, retry: false, onSuccess: () => client.invalidateQueries({ queryKey: [key, companyId] }) }); }
export function useReviewChange() { const client = useQueryClient(); const { companyId } = useAuth(); return useMutation({ mutationFn: reviewChange, retry: false, onSuccess: () => client.invalidateQueries({ predicate: query => query.queryKey[0] === key && query.queryKey[1] === companyId || ["accounting", "invoices", "barcodes", "orders", "inventory"].includes(String(query.queryKey[0])) && query.queryKey.includes(companyId) }) }); }
