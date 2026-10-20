import { toDateTimeLocalInput } from "@/lib/inventory/utils/date-time";

import type { InventoryStockCondition } from "./common";

export type AdjustmentSign = "increase" | "decrease";

export type AdjustmentReason = "damaged" | "recount" | "lost" | "other";

export const ADJUSTMENT_REASONS: { value: AdjustmentReason }[] = [
  { value: "damaged" },
  { value: "recount" },
  { value: "lost" },
  { value: "other" },
];

/** Quick single-item correction posted as an `inventory.StockAdjustment`. */
export type AdjustmentFormValues = {
  holderId: string;
  itemId: string;
  condition: InventoryStockCondition;
  adjustmentSign: AdjustmentSign;
  quantity: string;
  reason: AdjustmentReason;
  notes: string;
  /** `datetime-local` value; sent as a UTC instant. */
  occurredAt: string;
};

export function createEmptyAdjustmentForm(): AdjustmentFormValues {
  return {
    holderId: "",
    itemId: "",
    condition: "AVAILABLE",
    adjustmentSign: "increase",
    quantity: "1",
    reason: "recount",
    notes: "",
    occurredAt: toDateTimeLocalInput(),
  };
}
