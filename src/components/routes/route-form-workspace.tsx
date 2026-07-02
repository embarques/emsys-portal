"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { RouteForm } from "@/components/routes/route-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateRoute,
  useRoute,
  useUpdateRoute,
} from "@/lib/routes/hooks/use-routes";
import {
  createEmptyRouteForm,
  routeToFormValues,
  type RouteFormValues,
} from "@/lib/routes/types";
import { formatRouteName } from "@/lib/routes/display";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function RouteFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateRoute();
  const updateMutation = useUpdateRoute();
  const detailQuery = useRoute(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const editingLabel = editing ? formatRouteName(editing) : undefined;

  useEffect(() => {
    if (isEditing && editingLabel) {
      updateTabLabel(tabId, t("routes.form.editTabLabel", { name: editingLabel }));
    }
  }, [editingLabel, isEditing, tabId, t, updateTabLabel]);

  async function save(values: RouteFormValues) {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({ recordId: editing.id, values });
        notifyUpdated(t("routes.form.entityLabel"), formatRouteName(next));
        closeFormTabAndReturn(tabId);
        return;
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded(t("routes.form.entityLabel"), formatRouteName(next));
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t("routes.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("routes.form.loading")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : t("routes.form.notFound");
    return (
      <FormTabShell title={t("routes.form.editTitle")}>
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
      title={isEditing ? t("routes.form.editTitle") : t("routes.form.addTitle")}
      description={
        isEditing && editingLabel
          ? editingLabel
          : t("routes.form.addDescription")
      }
    >
      <RouteForm
        key={isEditing ? (editing?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editing
            ? routeToFormValues(editing)
            : createEmptyRouteForm()
        }
        isEditing={isEditing}
        submitLabel={
          isEditing ? t("common.actions.saveChanges") : t("routes.form.addTitle")
        }
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={save}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
