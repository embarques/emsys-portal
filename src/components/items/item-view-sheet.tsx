"use client";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
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

export function ItemViewSheet({ item, open, onOpenChange, onEdit, onDelete }: ItemViewSheetProps) {
  if (!item) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={truncateItemId(item.itemId)}
          description={<span className="font-mono text-xs">{item.itemId}</span>}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Description" padding="relaxed">
            <p className="text-sm leading-relaxed text-foreground">{item.description}</p>
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Details">
            <RecordViewSheetDetailRow label="Item ID" value={item.itemId} />
            <RecordViewSheetDetailRow label="Price" value={formatItemPrice(item.price)} />
            <RecordViewSheetDetailRow label="Date created" value={formatItemDate(item.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={item.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(item.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit item" onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
