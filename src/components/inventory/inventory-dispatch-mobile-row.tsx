"use client";

import { Truck } from "lucide-react";

import { formatInventoryDate, formatInventoryMoney, getInventoryDispatchToLabel, getInventoryItemLabel } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import type { InventoryDispatch } from "@/lib/inventory/types/documents";
import { useTranslation } from "@/lib/i18n";

type InventoryDispatchMobileRowProps = {
  dispatch: InventoryDispatch;
  item?: InventoryItem;
  onOpen: (dispatch: InventoryDispatch) => void;
};

export function InventoryDispatchMobileRow({ dispatch, item, onOpen }: InventoryDispatchMobileRowProps) {
  const { t } = useTranslation();

  return (
    <article className="border-b border-border/80 py-5 last:border-b-0">
      <button type="button" className="grid w-full min-w-0 grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-3 text-left" onClick={() => onOpen(dispatch)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <Truck className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight text-foreground">
            {item ? getInventoryItemLabel(item) : dispatch.itemId}
          </span>
          <span className="mt-1 block truncate text-base text-muted-foreground">
            {[getInventoryDispatchToLabel(dispatch.dispatchedTo), formatInventoryDate(dispatch.dispatchedAt)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-xl font-bold tabular-nums">{dispatch.quantity}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{formatInventoryMoney(dispatch.incomeGained)}</span>
        </span>
      </button>
    </article>
  );
}
