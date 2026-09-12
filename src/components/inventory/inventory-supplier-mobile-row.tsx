"use client";

import { Check, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatSupplierList, formatSupplierPhones } from "@/lib/inventory/display";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InventorySupplierMobileRowProps = {
  supplier: InventorySupplier;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (supplier: InventorySupplier) => void;
  onEdit: (supplier: InventorySupplier) => void;
  onDelete: (supplier: InventorySupplier) => void;
  onToggleSelected: (supplierId: string, checked: boolean) => void;
};

function supplierInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "-";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export function InventorySupplierMobileRow({
  supplier,
  selected,
  selectionMode,
  onOpen,
  onEdit,
  onDelete,
  onToggleSelected,
}: InventorySupplierMobileRowProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  function handleOpen() {
    if (selectionMode) {
      onToggleSelected(supplier.id, !selected);
      return;
    }
    onOpen(supplier);
  }

  return (
    <article className={cn("border-b border-border/80 py-5 last:border-b-0", selected && "bg-primary/5")}>
      <div className="grid min-w-0 grid-cols-[2.25rem_3.75rem_minmax(0,1fr)] gap-3">
        <button
          type="button"
          className={cn(
            "mt-1 flex size-7 items-center justify-center rounded-full border text-primary",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
          )}
          onClick={() => onToggleSelected(supplier.id, !selected)}
          aria-label={selected ? "Deselect supplier" : "Select supplier"}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>

        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
          onClick={handleOpen}
        >
          {supplierInitials(supplier.companyName)}
        </button>

        <button type="button" className="min-w-0 text-left" onClick={handleOpen}>
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{supplier.companyName}</span>
          <span className="mt-2 block break-words text-sm leading-relaxed text-muted-foreground">
            {formatSupplierList(supplier.contactNames) || dash}
          </span>
          <span className="mt-1 block break-words text-sm leading-relaxed text-muted-foreground">
            {formatSupplierPhones(supplier) || dash}
          </span>
          <span className="mt-1 block line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
            {formatSupplierList(supplier.emails) || dash}
          </span>
        </button>
      </div>

      <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onEdit(supplier)}>
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          onClick={() => onDelete(supplier)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </article>
  );
}
