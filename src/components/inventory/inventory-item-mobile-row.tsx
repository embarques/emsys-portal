"use client";

import { Archive, Check, Edit } from "lucide-react";

import { InventoryActiveBadge } from "@/components/inventory/inventory-status-badge";
import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/inventory/types";
import { useTranslation } from "@/lib/i18n";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type InventoryItemMobileRowProps = {
  item: InventoryItem;
  available: number;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (item: InventoryItem) => void;
  onEdit?: (item: InventoryItem) => void;
  onDeactivate?: (item: InventoryItem) => void;
  onToggleSelected: (itemId: string, checked: boolean) => void;
};

export function InventoryItemMobileRow({
  item,
  available,
  selected,
  selectionMode,
  onOpen,
  onEdit,
  onDeactivate,
  onToggleSelected,
}: InventoryItemMobileRowProps) {
  const { t } = useTranslation();

  function handleOpen() {
    if (selectionMode) {
      onToggleSelected(item.id, !selected);
      return;
    }
    onOpen(item);
  }

  return (
    <article className={cn("border-b border-border/80 py-5 last:border-b-0", selected && "bg-primary/5")}>
      <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-3">
        <button
          type="button"
          className={cn(
            "mt-1 flex size-7 items-center justify-center rounded-full border text-primary",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
          )}
          onClick={() => onToggleSelected(item.id, !selected)}
          aria-label={t(selected ? "inventory.selection.deselect" : "inventory.selection.select", { name: item.name })}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>

        <button type="button" className="min-w-0 text-left" onClick={handleOpen}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="block truncate text-xl font-bold leading-tight text-foreground">{item.name}</span>
            {!item.isActive ? <InventoryActiveBadge isActive={false} /> : null}
          </span>
          {item.sku ? <span className="mt-1 block truncate text-sm text-muted-foreground">{item.sku}</span> : null}
          <span className="mt-1 block text-sm text-muted-foreground">
            {t("inventory.columns.reorderThreshold")}: {item.reorderThreshold}
          </span>
        </button>

        <button type="button" className="shrink-0 text-right" onClick={handleOpen}>
          <span className="block text-xl font-bold tabular-nums">{available}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{t("inventory.columns.available")}</span>
        </button>
      </div>

      {onEdit || (onDeactivate && item.isActive) ? (
        <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              className={cn("h-11 rounded-xl", tableSelectionActionStyles.edit)}
              onClick={() => onEdit(item)}
            >
              <Edit className="size-4" />
              {t("common.actions.edit")}
            </Button>
          ) : null}
          {onDeactivate && item.isActive ? (
            <Button
              type="button"
              variant="outline"
              className={cn("h-11 rounded-xl", tableSelectionActionStyles.delete)}
              onClick={() => onDeactivate(item)}
            >
              <Archive className="size-4" />
              {t("inventory.actions.deactivate")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
