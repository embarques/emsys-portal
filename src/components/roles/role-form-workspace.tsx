"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { RoleForm } from "@/components/roles/role-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useCreateRole,
  useRoleKpis,
  useRolePermissionCatalog,
  useUpdateRole,
} from "@/lib/roles/hooks/use-roles";
import { mergePermissionCatalogEntries } from "@/lib/roles/permissions-catalog";
import {
  createEmptyRoleForm,
  roleToFormValues,
  type RoleFormValues,
} from "@/lib/roles/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function RoleFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const permissionCatalogQuery = useRolePermissionCatalog();
  // Roles has no get-by-id; the KPI query loads the full role set (with permissions).
  const kpiQuery = useRoleKpis();

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = useMemo(
    () => (isEditing ? (kpiQuery.items.find((role) => role.roleId === entityId) ?? null) : null),
    [entityId, isEditing, kpiQuery.items],
  );
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const assignedPermissionCatalog = useMemo(() => {
    const entries = kpiQuery.items.flatMap((role) =>
      role.permissions
        .filter((permission) => permission.group)
        .map((permission) => ({
          id: permission.id,
          value: permission.value,
          label: permission.label ?? permission.value,
          group: permission.group!,
        })),
    );

    return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
  }, [kpiQuery.items]);

  const basePermissionCatalog = useMemo(() => {
    if (permissionCatalogQuery.data) return permissionCatalogQuery.data;
    if (permissionCatalogQuery.isError) return assignedPermissionCatalog;
    return [];
  }, [assignedPermissionCatalog, permissionCatalogQuery.data, permissionCatalogQuery.isError]);

  const permissionCatalog = useMemo(() => {
    if (!editing) return basePermissionCatalog;
    return mergePermissionCatalogEntries(basePermissionCatalog, editing.permissions);
  }, [basePermissionCatalog, editing]);

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, `Edit ${editing.name}`);
    }
  }, [editing?.name, isEditing, tabId, updateTabLabel]);

  async function save(values: RoleFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ roleId: editing.roleId, values });
        notifyUpdated("Role", next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded("Role", next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && kpiQuery.isLoading) {
    return (
      <FormTabShell title="Edit role">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading role…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (kpiQuery.isError || !editing)) {
    const message = kpiQuery.isError
      ? "This role could not be loaded."
      : "This role could not be found.";
    return (
      <FormTabShell title="Edit role">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            Close
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? "Edit role" : "Add role"}
      description={
        isEditing && editing
          ? editing.name
          : "Name the role and choose the permissions it should have."
      }
    >
      <RoleForm
        key={isEditing ? (editing?.roleId ?? "edit") : `new-${formInstance}`}
        initialValues={isEditing && editing ? roleToFormValues(editing) : createEmptyRoleForm()}
        permissionCatalog={permissionCatalog}
        error={formError}
        isSubmitting={isSaving || permissionCatalogQuery.isLoading}
        submitLabel={isEditing ? "Save changes" : "Add role"}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
