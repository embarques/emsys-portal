import type { InventoryMovement } from "../types/movements";

export function computeStockFromMovements(itemId: string, movements: InventoryMovement[]): number {
  return movements
    .filter((movement) => movement.itemId === itemId)
    .reduce((sum, movement) => {
      if (movement.direction === "IN") return sum + movement.quantity;
      if (movement.direction === "OUT") return sum - movement.quantity;
      if (movement.direction === "ADJUSTMENT") {
        return movement.adjustmentSign === "decrease"
          ? sum - movement.quantity
          : sum + movement.quantity;
      }
      return sum;
    }, 0);
}

export function computeStockMap(movements: InventoryMovement[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const movement of movements) {
    const current = stock.get(movement.itemId) ?? 0;
    if (movement.direction === "IN") {
      stock.set(movement.itemId, current + movement.quantity);
    } else if (movement.direction === "OUT") {
      stock.set(movement.itemId, current - movement.quantity);
    } else if (movement.direction === "ADJUSTMENT") {
      stock.set(
        movement.itemId,
        movement.adjustmentSign === "decrease"
          ? current - movement.quantity
          : current + movement.quantity,
      );
    }
  }
  return stock;
}
