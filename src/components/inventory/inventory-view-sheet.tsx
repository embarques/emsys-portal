"use client";

import { Badge } from "@/components/ui/badge";
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

export function InventoryViewSheet({ item, open, onOpenChange, onEdit, onDelete }: InventoryViewSheetProps) {
  if (!item) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={item.name}
          description={item.sku}
          meta={
            <>
              <Badge className={getStatusBadgeClass(item.status)}>{getStatusLabel(item.status)}</Badge>
              <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Stock">
            <RecordViewSheetDetailRow label="Location" value={getLocationLabel(item.location)} />
            <RecordViewSheetDetailRow label="On hand" value={`${item.quantity} ${item.unit}`} />
            <RecordViewSheetDetailRow label="Reserved" value={`${item.reserved} ${item.unit}`} />
            <RecordViewSheetDetailRow label="Available" value={`${getAvailableQuantity(item)} ${item.unit}`} />
            <RecordViewSheetDetailRow label="Reorder level" value={`${item.reorderLevel} ${item.unit}`} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(item.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={item.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(item.updatedAt)} />
          </RecordViewSheetSection>

          {item.notes ? (
            <RecordViewSheetSection title="Notes" padding="relaxed">
              <p className="text-sm leading-relaxed text-foreground">{item.notes}</p>
            </RecordViewSheetSection>
          ) : null}
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit item" onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
