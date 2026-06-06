"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAuditDate } from "@/lib/audit/display";
import {
  getAvailableQuantity,
  getCategoryLabel,
  getLocationLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types";

type InventoryViewSheetProps = {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function InventoryViewSheet({ item, open, onOpenChange, onEdit, onDelete }: InventoryViewSheetProps) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>{item.sku}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge className={getStatusBadgeClass(item.status)}>{getStatusLabel(item.status)}</Badge>
            <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Location" value={getLocationLabel(item.location)} />
            <DetailRow label="On hand" value={`${item.quantity} ${item.unit}`} />
            <DetailRow label="Reserved" value={`${item.reserved} ${item.unit}`} />
            <DetailRow label="Available" value={`${getAvailableQuantity(item)} ${item.unit}`} />
            <DetailRow label="Reorder level" value={`${item.reorderLevel} ${item.unit}`} />
            <DetailRow label="Date created" value={formatAuditDate(item.createdAt)} />
            <DetailRow label="User created" value={item.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(item.updatedAt)} />
          </div>

          {item.notes ? (
            <div className="mt-4 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="mt-2 text-sm leading-relaxed">{item.notes}</p>
            </div>
          ) : null}

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
