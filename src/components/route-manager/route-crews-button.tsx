"use client";

import { Users } from "lucide-react";

import { fieldEntityActionClassName } from "@/components/forms/field-entity-actions";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

export function RouteCrewsButton({ compact = false, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  const { t } = useTranslation();
  const { openTab } = useWorkspaceTabs();

  return (
    <PermissionGuard permission={PERMISSIONS.dispatchView}>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "sm" : "default"}
        className={compact ? fieldEntityActionClassName : undefined}
        onClick={() => {
          onOpen?.();
          openTab("/routes");
        }}
      >
        <Users className={compact ? "size-3.5" : "size-4"} />
        {t("navigation.items.routeCrews")}
      </Button>
    </PermissionGuard>
  );
}
