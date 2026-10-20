"use client";

import type { LucideIcon } from "lucide-react";
import { Edit, Send } from "lucide-react";

import { InventoryDocumentStatusBadge } from "@/components/inventory/inventory-status-badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { InventoryDocumentStatus } from "@/lib/inventory/types/common";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";

type InventoryDocumentMobileRowProps = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  detail: string;
  amount: string;
  amountLabel?: string;
  status: InventoryDocumentStatus;
  onOpen: () => void;
  onEdit?: () => void;
  onPost?: () => void;
};

export function InventoryDocumentMobileRow({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  detail,
  amount,
  amountLabel,
  status,
  onOpen,
  onEdit,
  onPost,
}: InventoryDocumentMobileRowProps) {
  const { t } = useTranslation();

  return (
    <article className="border-b border-border/80 py-5 last:border-b-0">
      <button type="button" className="grid w-full min-w-0 grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-3 text-left" onClick={onOpen}>
        <span className={`flex size-12 items-center justify-center rounded-full ${iconClassName}`}>
          <Icon className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{title}</span>
          <span className="mt-1 block text-base text-muted-foreground">{subtitle}</span>
          <span className="mt-2 block truncate text-sm text-muted-foreground">{detail}</span>
        </span>
        <span className="shrink-0 space-y-1 text-right">
          <span className="block text-xl font-bold tabular-nums">{amount}</span>
          {amountLabel ? <span className="block text-xs text-muted-foreground">{amountLabel}</span> : null}
          <InventoryDocumentStatusBadge status={status} />
        </span>
      </button>
      {onEdit || onPost ? (
        <div className="mt-4 flex justify-end gap-2">
          {onEdit ? (
            <Button variant="outline" className={tableSelectionActionStyles.edit} onClick={onEdit}>
              <Edit className="size-4" />
              {t("common.actions.edit")}
            </Button>
          ) : null}
          {onPost ? (
            <Button onClick={onPost}>
              <Send className="size-4" />
              {t("inventory.actions.post")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
