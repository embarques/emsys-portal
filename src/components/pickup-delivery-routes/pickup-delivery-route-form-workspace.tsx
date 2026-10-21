"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { Button } from "@/components/ui/button";
import { useUserError } from "@/lib/errors/use-user-error";
import { formatActiveRouteRowLabel } from "@/lib/pickup-delivery-routes/display";
import { useActiveRouteById } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useTranslation } from "@/lib/i18n";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import { stashFormTabCreatedId } from "@/lib/layout/form-tab-return";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import type { ActiveRoutesDirectoryVariant } from "@/lib/pickup-delivery-routes/directory-variant";
import {
  DAILY_ROUTES_DIRECTORY_VARIANT,
  PICKUP_ROUTE_FORM_FEATURE,
  PICKUP_ROUTES_DIRECTORY_VARIANT,
} from "@/lib/pickup-delivery-routes/directory-variant";

type ActiveRouteFormWorkspaceProps = WorkspaceFormHostProps & {
  variant: ActiveRoutesDirectoryVariant;
};

export function ActiveRouteFormWorkspace({ tabId, mode, entityId, closeOnSave, variant }: ActiveRouteFormWorkspaceProps) {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();
  const detailQuery = useActiveRouteById(
    isEditing ? (entityId ?? null) : null,
    variant.routeType,
  );
  const copyPrefix = variant.copyPrefix;

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const editingLabel = editing ? formatActiveRouteRowLabel(editing, t("common.empty.dash"), t) : undefined;

  useEffect(() => {
    if (isEditing && editingLabel) {
      updateTabLabel(tabId, t(`routes.${copyPrefix}.editTabLabel`, { name: editingLabel }));
    }
  }, [copyPrefix, editingLabel, isEditing, tabId, t, updateTabLabel]);

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title={t(`routes.${copyPrefix}.editTitle`)}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t(`routes.${copyPrefix}.loading`)}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? toErrorMessage(detailQuery.error)
      : t(`routes.${copyPrefix}.notFound`);
    return (
      <FormTabShell title={t(`routes.${copyPrefix}.editTitle`)}>
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
      className="max-w-6xl"
      title={isEditing ? t(`routes.${copyPrefix}.editTitle`) : t(`routes.${copyPrefix}.title`)}
      description={t(`routes.${copyPrefix}.description`)}
    >
      <ActiveRouteSection
        key={isEditing ? (editing?.id ?? "edit") : `new-${variant.id}`}
        initialRecord={isEditing ? editing : null}
        variant={variant}
        onSaved={(saved) => {
          if (closeOnSave && !isEditing && saved?.id) {
            stashFormTabCreatedId(variant.formFeature, saved.id);
          }
          closeFormTabAndReturn(tabId);
        }}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}

export function DailyRouteFormWorkspace(props: WorkspaceFormHostProps) {
  return <ActiveRouteFormWorkspace {...props} variant={DAILY_ROUTES_DIRECTORY_VARIANT} />;
}

const PICKUP_ROUTE_FORM_VARIANT: ActiveRoutesDirectoryVariant = {
  ...PICKUP_ROUTES_DIRECTORY_VARIANT,
  formFeature: PICKUP_ROUTE_FORM_FEATURE,
};

/** Pickup-only schedule form (no route type or container), opened from invoice "New" route. */
export function PickupRouteFormWorkspace(props: WorkspaceFormHostProps) {
  return <ActiveRouteFormWorkspace {...props} variant={PICKUP_ROUTE_FORM_VARIANT} />;
}
