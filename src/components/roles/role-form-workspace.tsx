"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { RoleForm } from "@/components/roles/role-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateRole,
  useRole,
  useRolePermissionCatalog,
  useUpdateRole,
} from "@/lib/roles/hooks/use-roles";
import { mergePermissionCatalogEntries } from "@/lib/roles/permissions-catalog";
import {
  createEmptyRoleForm,
  roleToFormValues,
  type RoleFormValues,
  areRoleFormValuesEquivalent,
} from "@/lib/roles/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function RoleFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated, notifySuccess } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const permissionCatalogQuery = useRolePermissionCatalog();
  const detailQuery = useRole(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const assignedPermissionCatalog = useMemo(() => {
    if (!editing) return [];

    return editing.permissions
      .filter((permission) => permission.group)
      .map((permission) => ({
        id: permission.id,
        value: permission.value,
        label: permission.label ?? permission.value,
        group: permission.group!,
      }));
  }, [editing]);

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
      updateTabLabel(tabId, t("roles.actions.editNamed", { name: editing.name }));
    }
  }, [editing?.name, isEditing, tabId, t, updateTabLabel]);

  async function save(values: RoleFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        if (areRoleFormValuesEquivalent(values, roleToFormValues(editing))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const next = await updateMutation.mutateAsync({ roleId: editing.roleId, values });
        notifyUpdated(t("roles.entity"), next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("roles.entity"), next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("roles.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("roles.loading.role")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : t("roles.form.notFound");
    return (
      <FormTabShell title={t("roles.form.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? t("roles.form.editTitle") : t("roles.form.addTitle")}
      description={
        isEditing && editing ? editing.name : t("roles.form.addDescription")
      }
    >
      <RoleForm
        key={isEditing ? (editing?.roleId ?? "edit") : `new-${formInstance}`}
        initialValues={isEditing && editing ? roleToFormValues(editing) : createEmptyRoleForm()}
        permissionCatalog={permissionCatalog}
        error={formError}
        isSubmitting={isSaving || permissionCatalogQuery.isLoading}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("roles.actions.add")}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
