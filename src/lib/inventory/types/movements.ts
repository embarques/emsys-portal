export type MovementDirection = "IN" | "OUT" | "ADJUSTMENT";

export type MovementReferenceType = "receipt" | "dispatch" | "adjustment";

export type AdjustmentSign = "increase" | "decrease";

export type InventoryMovement = {
  id: string;
  itemId: string;
  direction: MovementDirection;
  quantity: number;
  adjustmentSign?: AdjustmentSign;
  movementDate: string;
  referenceType: MovementReferenceType;
  referenceId: string;
  createdBy: string;
  notes?: string;
};

export type MovementFilterState = {
  query: string;
  itemId: string | "all";
  direction: MovementDirection | "all";
  referenceType: MovementReferenceType | "all";
};

export type AdjustmentReason = "damaged" | "recount" | "lost" | "other";

export type AdjustmentFormValues = {
  itemId: string;
  adjustmentSign: AdjustmentSign;
  quantity: number;
  reason: AdjustmentReason;
  notes: string;
  movementDate: string;
  createdBy: string;
};

export type InventoryAdjustment = {
  id: string;
  itemId: string;
  adjustmentSign: AdjustmentSign;
  quantity: number;
  reason: AdjustmentReason;
  notes?: string;
  movementDate: string;
  createdBy: string;
  createdAt: string;
};

export const ADJUSTMENT_REASONS: { value: AdjustmentReason; label: string }[] = [
  { value: "damaged", label: "Damaged" },
  { value: "recount", label: "Recount" },
  { value: "lost", label: "Lost" },
  { value: "other", label: "Other" },
];
