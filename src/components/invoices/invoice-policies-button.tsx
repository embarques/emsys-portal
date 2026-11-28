"use client";

import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

export function InvoicePoliciesButton() {
  const { t } = useTranslation();
  const { openTab } = useWorkspaceTabs();

  return (
    <PermissionGuard permission={PERMISSIONS.invoicePoliciesList}>
      <Button type="button" variant="outline" onClick={() => openTab("/invoice-policies")}>
        <ScrollText className="size-4" />
        {t("navigation.items.invoicePolicies")}
      </Button>
    </PermissionGuard>
  );
}
