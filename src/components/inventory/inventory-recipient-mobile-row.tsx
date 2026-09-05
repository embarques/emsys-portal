"use client";

import { Check, Edit, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRecipientTypeLabel } from "@/lib/inventory/display";
import type { InventoryRecipient } from "@/lib/inventory/types/recipients";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InventoryRecipientMobileRowProps = {
  recipient: InventoryRecipient;
  selected: boolean;
  selectionMode: boolean;
  onOpen: (recipient: InventoryRecipient) => void;
  onEdit: (recipient: InventoryRecipient) => void;
  onDelete: (recipient: InventoryRecipient) => void;
  onToggleSelected: (recipientId: string, checked: boolean) => void;
};

function recipientInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "-";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export function InventoryRecipientMobileRow({
  recipient,
  selected,
  selectionMode,
  onOpen,
  onEdit,
  onDelete,
  onToggleSelected,
}: InventoryRecipientMobileRowProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  function handleOpen() {
    if (selectionMode) {
      onToggleSelected(recipient.id, !selected);
      return;
    }
    onOpen(recipient);
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
          onClick={() => onToggleSelected(recipient.id, !selected)}
          aria-label={selected ? "Deselect recipient" : "Select recipient"}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>

        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
          onClick={handleOpen}
        >
          {recipientInitials(recipient.name)}
        </button>

        <button type="button" className="min-w-0 text-left" onClick={handleOpen}>
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{recipient.name}</span>
          <span className="mt-2 block">
            <Badge className="rounded-full border-transparent bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {getRecipientTypeLabel(recipient.type, t)}
            </Badge>
          </span>
          <span className="mt-2 block break-words text-sm leading-relaxed text-muted-foreground">
            {recipient.contactInfo || dash}
          </span>
          <span className="mt-1 block line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">
            {recipient.address || dash}
          </span>
        </button>
      </div>

      <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onEdit(recipient)}>
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          onClick={() => onDelete(recipient)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </article>
  );
}
