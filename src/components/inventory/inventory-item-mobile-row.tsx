"use client";

import { Check, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/inventory/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InventoryItemMobileRowProps = {
  item: InventoryItem;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onToggleSelected: (itemId: string, checked: boolean) => void;
};

export function InventoryItemMobileRow({
  item,
  selected,
  selectionMode,
  onOpen,
  onEdit,
  onDelete,
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
          aria-label={selected ? "Deselect inventory item" : "Select inventory item"}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>

        <button type="button" className="min-w-0 text-left" onClick={handleOpen}>
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{item.item}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {t("inventory.columns.reorderThreshold")}: {item.reorderThreshold}
          </span>
        </button>

        <button type="button" className="shrink-0 text-right" onClick={handleOpen}>
          <span className="block text-xl font-bold tabular-nums">{item.quantity}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{t("inventory.columns.quantityLeft")}</span>
        </button>
      </div>

      <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onEdit(item)}>
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </article>
  );
}
