"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAuditDate } from "@/lib/audit/display";
import { formatItemDate, formatItemPrice, truncateItemId } from "@/lib/items/display";
import type { Item } from "@/lib/items/types";

type ItemViewSheetProps = {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function ItemViewSheet({ item, open, onOpenChange, onEdit, onDelete }: ItemViewSheetProps) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{truncateItemId(item.itemId)}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{item.itemId}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="mb-4 rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
            <p className="mt-2 text-sm">{item.description}</p>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Item ID" value={item.itemId} />
            <DetailRow label="Price" value={formatItemPrice(item.price)} />
            <DetailRow label="Date created" value={formatItemDate(item.createdAt)} />
            <DetailRow label="User created" value={item.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(item.updatedAt)} />
          </div>

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(item)}>
              <Pencil className="h-4 w-4" />
              Edit item
            </Button>
            <Button variant="destructive" onClick={() => onDelete(item)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
