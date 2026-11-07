"use client";

import { Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

export function EmployeeTitlesButton() {
  const { t } = useTranslation();
  const { openTab } = useWorkspaceTabs();

  return (
    <PermissionGuard permission={PERMISSIONS.employeeTitlesView}>
      <Button type="button" variant="outline" onClick={() => openTab("/employee-titles")}>
        <Briefcase className="size-4" />
        {t("navigation.items.employeeTitles")}
      </Button>
    </PermissionGuard>
  );
}
