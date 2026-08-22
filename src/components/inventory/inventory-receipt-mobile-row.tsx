"use client";

import { PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatAuditDateTime } from "@/lib/audit/display";
import type { InventoryReceipt } from "@/lib/inventory/types/documents";
import { useTranslation } from "@/lib/i18n";

type InventoryReceiptMobileRowProps = {
  receipt: InventoryReceipt;
  lineCount: number;
  onOpen: (receipt: InventoryReceipt) => void;
};

export function InventoryReceiptMobileRow({ receipt, lineCount, onOpen }: InventoryReceiptMobileRowProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  return (
    <article className="border-b border-border/80 py-5 last:border-b-0">
      <button type="button" className="grid w-full min-w-0 grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-3 text-left" onClick={() => onOpen(receipt)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <PackageCheck className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight text-foreground">{receipt.source || dash}</span>
          <span className="mt-1 block text-base text-muted-foreground">{formatAuditDateTime(receipt.receiptDate)}</span>
          <span className="mt-2 block truncate text-sm text-muted-foreground">
            {t("inventory.columns.receivedBy")}: {receipt.receivedBy || dash}
          </span>
          {receipt.notes ? (
            <span className="mt-1 block line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
              {receipt.notes}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-right">
          <Badge className="rounded-full border-transparent bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {lineCount} {t("inventory.view.lines").toLowerCase()}
          </Badge>
        </span>
      </button>
    </article>
  );
}
