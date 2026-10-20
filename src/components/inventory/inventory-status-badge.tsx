"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { DOCUMENT_STATUS_BADGE_CLASSES, getDocumentStatusLabel } from "@/lib/inventory/display";
import type { InventoryDocumentStatus } from "@/lib/inventory/types/common";
import { cn } from "@/lib/utils";

export function InventoryDocumentStatusBadge({
  status,
  className,
}: {
  status: InventoryDocumentStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(DOCUMENT_STATUS_BADGE_CLASSES[status], className)}>
      {getDocumentStatusLabel(status, t)}
    </Badge>
  );
}

export function InventoryActiveBadge({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={
        isActive
          ? DOCUMENT_STATUS_BADGE_CLASSES.POSTED
          : DOCUMENT_STATUS_BADGE_CLASSES.CANCELLED
      }
    >
      {t(isActive ? "inventory.activeStatuses.active" : "inventory.activeStatuses.inactive")}
    </Badge>
  );
}
