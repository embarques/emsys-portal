"use client";

import { Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatAuditDateTime } from "@/lib/audit/display";
import { getDispatchStatusLabel } from "@/lib/inventory/display";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";
import type { InventoryRecipient } from "@/lib/inventory/types/recipients";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InventoryDispatchMobileRowProps = {
  dispatch: InventoryDispatch;
  recipient?: InventoryRecipient;
  lineCount: number;
  onOpen: (dispatch: InventoryDispatch) => void;
};

function getDispatchStatusBadgeClass(status: InventoryDispatch["status"]) {
  switch (status) {
    case "pending":
      return "border-transparent bg-amber-100 text-amber-700";
    case "sent":
      return "border-transparent bg-blue-100 text-blue-700";
    case "confirmed":
      return "border-transparent bg-emerald-100 text-emerald-700";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function InventoryDispatchMobileRow({
  dispatch,
  recipient,
  lineCount,
  onOpen,
}: InventoryDispatchMobileRowProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  return (
    <article className="border-b border-border/80 py-5 last:border-b-0">
      <button type="button" className="grid w-full min-w-0 grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-3 text-left" onClick={() => onOpen(dispatch)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Truck className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight text-foreground">
            {recipient?.name ?? dispatch.recipientId}
          </span>
          <span className="mt-1 block text-base text-muted-foreground">{formatAuditDateTime(dispatch.dispatchDate)}</span>
          <span className="mt-2 block truncate text-sm text-muted-foreground">
            {t("inventory.columns.dispatchedBy")}: {dispatch.dispatchedBy || dash}
          </span>
          <span className="mt-1 block truncate text-sm text-muted-foreground">
            {t("inventory.columns.invoiceNumber")}: {dispatch.invoiceNumber || dash}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", getDispatchStatusBadgeClass(dispatch.status))}>
            {getDispatchStatusLabel(dispatch.status, t)}
          </Badge>
          <span className="mt-2 block text-xs font-medium text-muted-foreground">
            {lineCount} {t("inventory.view.lines").toLowerCase()}
          </span>
        </span>
      </button>
    </article>
  );
}
