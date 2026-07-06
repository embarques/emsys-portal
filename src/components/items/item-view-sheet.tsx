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
import { useTranslation } from "@/lib/i18n";
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
  const { t } = useTranslation();

  if (!item) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={truncateItemId(item.itemId)}
          description={<span className="font-mono text-xs">{item.itemId}</span>}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("items.view.description")} padding="relaxed">
            <p className="text-sm leading-relaxed text-foreground">{item.description}</p>
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("items.view.details")}>
            <RecordViewSheetDetailRow label={t("items.view.itemId")} value={item.itemId} />
            <RecordViewSheetDetailRow label={t("items.view.price")} value={formatItemPrice(item.price)} />
            <RecordViewSheetDetailRow
              label={t("items.view.dateCreated")}
              value={formatItemDate(item.createdAt)}
            />
            <RecordViewSheetDetailRow
              label={t("items.view.dateModified")}
              value={formatAuditDate(item.updatedAt)}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("items.view.edit")}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
