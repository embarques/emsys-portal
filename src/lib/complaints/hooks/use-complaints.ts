"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  addComplaintAttachment,
  addComplaintNote,
  createComplaint,
  fetchComplaint,
  fetchComplaintCategories,
  fetchComplaintInsights,
  fetchComplaintNotifications,
  fetchUnresolvedComplaintCount,
  markComplaintNotificationRead,
  patchComplaint,
  reopenComplaint,
  replaceComplaintTargets,
} from "@/lib/complaints/api/complaints-api";
import type {
  Complaint,
  ComplaintAttachmentRequest,
  ComplaintNotification,
  ComplaintPatch,
  ComplaintTarget,
} from "@/lib/complaints/types";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";
import { useUsers } from "@/lib/users/hooks/use-users";

/** Waits for the session and the transport company header to agree before fetching tenant data. */
export function useComplaintsQueryEnabled() {
  const { loading, roleLoading, companyId } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);
  return !loading && !roleLoading && Boolean(idToken && companyId && companyId === transportCompanyId);
}

export function useComplaintAccess() {
  const { hasPermission } = useAuth();
  const can = (permission: { name: string; resourceType: string }) =>
    hasPermission(permission.name, permission.resourceType);
  const canUpdate = can(PERMISSIONS.complaintsUpdate);
  return {
    canView: can(PERMISSIONS.complaintsView),
    canCreate: can(PERMISSIONS.complaintsCreate),
    canUpdate,
    canReopen: canUpdate && can(PERMISSIONS.complaintsReopen),
    canViewUsers: can(PERMISSIONS.usersView),
    canViewEmployees: can(PERMISSIONS.employeesView),
  };
}

/** Red sidebar badge: complaints still open, in progress or awaiting the customer. */
export function useUnresolvedComplaintCount(active = true) {
  const { companyId } = useAuth();
  const ready = useComplaintsQueryEnabled();
  const { canView } = useComplaintAccess();
  const query = useWorkspaceQuery({
    queryKey: queryKeys.complaints.unresolvedCount(companyId),
    queryFn: fetchUnresolvedComplaintCount,
    enabled: active && ready && canView,
    staleTime: 30_000,
  });
  return active ? query.data ?? 0 : 0;
}

export function useComplaint(id: string | null, placeholder?: Complaint) {
  const { companyId } = useAuth();
  const ready = useComplaintsQueryEnabled();
  const { canView } = useComplaintAccess();
  return useWorkspaceQuery({
    queryKey: queryKeys.complaints.detail(companyId, id ?? ""),
    queryFn: ({ signal }) => fetchComplaint(id ?? "", signal),
    enabled: Boolean(id) && ready && canView,
    placeholderData: placeholder && placeholder.id === id ? placeholder : undefined,
  });
}

export function useComplaintCategories(enabled = true) {
  const { companyId } = useAuth();
  const ready = useComplaintsQueryEnabled();
  const { canView } = useComplaintAccess();
  return useWorkspaceQuery({
    queryKey: queryKeys.complaints.categories(companyId),
    queryFn: ({ signal }) => fetchComplaintCategories(signal),
    enabled: enabled && ready && canView,
    staleTime: 5 * 60_000,
  });
}

export function useComplaintMutations() {
  const client = useQueryClient();
  const { companyId } = useAuth();

  function applyResult(complaint: Complaint) {
    client.setQueryData(queryKeys.complaints.detail(companyId, complaint.id), complaint);
    void client.invalidateQueries({ queryKey: queryKeys.complaints.pages() });
    void client.invalidateQueries({ queryKey: queryKeys.complaints.unresolvedCounts() });
  }

  /** A stale `If-Match` (412) or closed record (409) means the cached copy is out of date. */
  function refreshOnConflict(error: unknown, complaint: Complaint) {
    const { status } = normalizeApiError(error);
    if (status !== 409 && status !== 412) return;
    void client.invalidateQueries({ queryKey: queryKeys.complaints.detail(companyId, complaint.id) });
    void client.invalidateQueries({ queryKey: queryKeys.complaints.pages() });
  }

  return {
    create: useMutation({ mutationFn: createComplaint, onSuccess: applyResult }),
    patch: useMutation({
      mutationFn: ({ complaint, patch }: { complaint: Complaint; patch: ComplaintPatch }) =>
        patchComplaint(complaint.id, complaint.version, patch),
      onSuccess: applyResult,
      onError: (error, { complaint }) => refreshOnConflict(error, complaint),
    }),
    note: useMutation({
      mutationFn: ({ complaint, body }: { complaint: Complaint; body: string }) =>
        addComplaintNote(complaint.id, complaint.version, body),
      onSuccess: applyResult,
      onError: (error, { complaint }) => refreshOnConflict(error, complaint),
    }),
    reopen: useMutation({
      mutationFn: ({ complaint, reason }: { complaint: Complaint; reason: string }) =>
        reopenComplaint(complaint.id, complaint.version, reason),
      onSuccess: applyResult,
      onError: (error, { complaint }) => refreshOnConflict(error, complaint),
    }),
    targets: useMutation({
      mutationFn: ({ complaint, targets }: { complaint: Complaint; targets: ComplaintTarget[] }) =>
        replaceComplaintTargets(complaint.id, complaint.version, targets),
      onSuccess: (complaint) => {
        applyResult(complaint);
        void client.invalidateQueries({ queryKey: [...queryKeys.complaints.all, "insights"] });
      },
      onError: (error, { complaint }) => refreshOnConflict(error, complaint),
    }),
    attachment: useMutation({
      mutationFn: ({ complaint, attachment }: { complaint: Complaint; attachment: ComplaintAttachmentRequest }) =>
        addComplaintAttachment(complaint.id, complaint.version, attachment),
      onSuccess: applyResult,
      onError: (error, { complaint }) => refreshOnConflict(error, complaint),
    }),
  };
}

export function useComplaintInsights(from: string, to: string, enabled = true) {
  const { companyId } = useAuth();
  const ready = useComplaintsQueryEnabled();
  const { canView } = useComplaintAccess();
  return useWorkspaceQuery({
    queryKey: queryKeys.complaints.insights(companyId, from, to),
    queryFn: ({ signal }) => fetchComplaintInsights(from, to, signal),
    enabled: enabled && ready && canView && Boolean(from && to),
    staleTime: 60_000,
  });
}

/** Unread complaint inbox for the topbar; acknowledgment is per user on the server. */
export function useComplaintNotifications(enabled = true) {
  const { companyId, user, email } = useAuth();
  const ready = useComplaintsQueryEnabled();
  const { canView } = useComplaintAccess();
  return useWorkspaceQuery({
    queryKey: queryKeys.complaints.notifications(companyId, user?.uid ?? email ?? ""),
    queryFn: ({ signal }) => fetchComplaintNotifications(signal),
    enabled: enabled && ready && canView,
    staleTime: 30_000,
  });
}

export function useMarkComplaintNotificationRead() {
  const client = useQueryClient();
  const { companyId, user, email } = useAuth();
  const key = queryKeys.complaints.notifications(companyId, user?.uid ?? email ?? "");
  return useMutation({
    mutationFn: markComplaintNotificationRead,
    onMutate: (id: string) => {
      client.setQueryData<ComplaintNotification[]>(key, (current) => current?.filter((item) => item.id !== id));
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

const PEOPLE_LOOKUP_LIMIT = 200;

/**
 * Display names for the numeric user (assignee, timeline actor) and employee (target) IDs the
 * complaint API returns. Lookups only run with directory access; callers fall back to `#id`.
 */
export function useComplaintPeople(enabled = true) {
  const { canViewUsers, canViewEmployees } = useComplaintAccess();
  const ready = useComplaintsQueryEnabled();
  const users = useUsers(
    { page: 1, limit: PEOPLE_LOOKUP_LIMIT, sort: "name:asc" },
    { enabled: enabled && ready && canViewUsers },
  );
  const employees = useEmployees(
    { ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: PEOPLE_LOOKUP_LIMIT },
    { enabled: enabled && ready && canViewEmployees },
  );

  return useMemo(() => {
    const userItems = users.data?.items ?? [];
    const employeeItems = employees.data?.items ?? [];
    const userNames = new Map(userItems.map((user) => [user.id, user.name || user.email]));
    const employeeNames = new Map(employeeItems.map((employee) => [employee.id, employee.name]));
    return {
      users: userItems,
      employees: employeeItems,
      usersLoading: users.isLoading,
      userName: (id: number) => userNames.get(id),
      employeeName: (id: number) => employeeNames.get(id),
    };
  }, [employees.data?.items, users.data?.items, users.isLoading]);
}
