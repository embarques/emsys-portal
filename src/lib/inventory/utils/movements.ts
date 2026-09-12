import type { InventoryDispatch, InventoryReceipt } from "../types/documents";
import type { InventoryMovement } from "../types/movements";

export function movementsFromInventoryDocuments(
  receipts: InventoryReceipt[],
  dispatches: InventoryDispatch[],
): InventoryMovement[] {
  const inbound: InventoryMovement[] = receipts.map((receipt) => ({
    id: `receipt:${receipt.id}`,
    itemId: receipt.itemId,
    direction: "IN",
    quantity: receipt.quantity,
    movementDate: receipt.receivedAt,
    referenceType: "receipt",
    referenceId: receipt.id,
    createdBy: receipt.createdBy,
  }));

  const outbound: InventoryMovement[] = dispatches.map((dispatch) => ({
    id: `dispatch:${dispatch.id}`,
    itemId: dispatch.itemId,
    direction: "OUT",
    quantity: dispatch.quantity,
    movementDate: dispatch.dispatchedAt,
    referenceType: "dispatch",
    referenceId: dispatch.id,
    createdBy: dispatch.createdBy,
  }));

  return [...inbound, ...outbound].sort((left, right) =>
    right.movementDate.localeCompare(left.movementDate),
  );
}
