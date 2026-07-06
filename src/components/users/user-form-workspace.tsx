"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { UserForm } from "@/components/users/user-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { createSecondaryFirebaseUser } from "@/lib/auth/firebase/firebase-user-admin";
import { useTranslation } from "@/lib/i18n";
import { useCreateUser, useUpdateUser, useUser } from "@/lib/users/hooks/use-users";
import { createEmptyUserForm, userToFormValues, type UserFormValues } from "@/lib/users/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function UserFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const detailQuery = useUser(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, t("users.actions.editNamed", { name: editing.name }));
    }
  }, [editing?.name, isEditing, tabId, t, updateTabLabel]);

  async function save(values: UserFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ userId: editing.id, values });
        notifyUpdated(t("users.entity"), next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const uid = await createSecondaryFirebaseUser(values.email, values.password);
      try {
        const next = await createMutation.mutateAsync({ values, uid });
        notifyAdded(t("users.entity"), next.name);
        closeFormTabAndReturn(tabId);
      } catch (apiError) {
        throw new Error(
          t("users.errors.firebasePartialCreate", {
            message: normalizeApiError(apiError).message,
          }),
        );
      }
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("users.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("users.loading.user")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : t("users.form.notFound");
    return (
      <FormTabShell title={t("users.form.editTitle")}>
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
      title={isEditing ? t("users.form.editTitle") : t("users.form.addTitle")}
      description={isEditing && editing ? editing.name : t("users.form.addDescription")}
    >
      <UserForm
        key={isEditing ? (editing?.id ?? "edit") : "new"}
        initialValues={isEditing && editing ? userToFormValues(editing) : createEmptyUserForm()}
        isEditing={isEditing}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("users.actions.add")}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
