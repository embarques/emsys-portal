"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateEmployee,
  useEmployee,
  useUpdateEmployee,
} from "@/lib/employees/hooks/use-employees";
import {
  createEmptyEmployeeForm,
  employeeToFormValues,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function EmployeeFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const detailQuery = useEmployee(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isEditing && editing?.name) {
      updateTabLabel(tabId, t("employees.actions.editNamed", { name: editing.name }));
    }
  }, [editing?.name, isEditing, tabId, t, updateTabLabel]);

  async function save(values: EmployeeFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({
          employeeId: String(editing.id),
          values,
        });
        notifyUpdated(t("employees.entity"), next.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("employees.entity"), next.name);
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("employees.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("employees.loading.employee")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : t("employees.form.notFound");
    return (
      <FormTabShell title={t("employees.form.editTitle")}>
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
      title={isEditing ? t("employees.form.editTitle") : t("employees.form.addTitle")}
      description={isEditing && editing ? editing.name : t("employees.form.addDescription")}
    >
      <EmployeeForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editing ? employeeToFormValues(editing) : createEmptyEmployeeForm()
        }
        isEditing={isEditing}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("employees.actions.add")}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
