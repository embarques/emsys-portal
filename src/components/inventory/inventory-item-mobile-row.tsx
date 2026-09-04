"use client";

import { Check, Edit, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAvailableQuantity,
  getCategoryLabel,
  getLocationLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from "@/lib/inventory/display";
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
  const available = getAvailableQuantity(item);
  const isLowStock = available <= item.reorderLevel;

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
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{item.name}</span>
          <span className="mt-1 block truncate text-base text-muted-foreground">
            {item.sku} | {getCategoryLabel(item.category, t)}
          </span>
          <span className="mt-2 block text-sm text-muted-foreground">{getLocationLabel(item.location, t)}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {t("inventory.columns.onHand")}: {item.quantity} {item.unit}
            {item.reserved > 0 ? ` | ${t("inventory.form.fields.reserved")}: ${item.reserved}` : ""}
          </span>
        </button>

        <button type="button" className="shrink-0 text-right" onClick={handleOpen}>
          <span
            className={cn(
              "block text-xl font-bold tabular-nums",
              isLowStock ? "text-amber-600" : "text-emerald-600",
            )}
          >
            {available}
          </span>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">{item.unit}</span>
          <Badge className={cn("mt-3 rounded-full px-3 py-1 text-xs font-semibold", getStatusBadgeClass(item.status))}>
            {getStatusLabel(item.status, t)}
          </Badge>
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
