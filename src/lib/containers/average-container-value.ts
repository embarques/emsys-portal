export type AverageContainerValueStats = {
  average: number;
  containerCount: number;
};

export function roundContainerMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Average merchandise value per departed container.
 * Containers with no invoices count as $0 so the denominator is every
 * container that departed in the window.
 */
export function computeAverageMerchandiseValuePerContainer(
  containerCount: number,
  totalMerchandiseValue: number,
): number {
  if (containerCount <= 0) return 0;
  return roundContainerMoney(totalMerchandiseValue / containerCount);
}
