"use client";

import { PageHeader } from "@/components/app-shell/page-header";
import { PendingInventoryDispatchesPanel } from "@/components/accounting/pending-inventory-dispatches-panel";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";

export function PendingInventoryWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const permission = PERMISSIONS.inventoryDispatchesList;
  if (!hasPermission(permission.name, permission.resourceType)) {
    return <p>{t("common.errors.forbidden")}</p>;
  }
  return <div className="space-y-6">
    <PageHeader title={t("accounting.pendingInventory.title")} description={t("accounting.pendingInventory.description")} />
    <PendingInventoryDispatchesPanel />
  </div>;
}
