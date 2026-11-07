import { translateCurrent } from "@/lib/i18n/translate-current";

export function isDeliveredBarcode(status: { id?: number; name?: string } | null | undefined): boolean {
  return status?.id === 7 || status?.name?.trim().toUpperCase() === "ENTREGADO";
}

/** Omitted route fields preserve the saved route; null explicitly removes it. */
export function assertBarcodeRouteChangeAllowed(
  status: { id?: number; name?: string } | null | undefined,
  current: { id?: string } | null | undefined,
  next: { id?: string } | null | undefined,
): void {
  if (next === undefined || (current?.id?.trim() ?? "") === (next?.id?.trim() ?? "")) return;
  if (isDeliveredBarcode(status)) {
    throw new Error(translateCurrent("labels.errors.deliveredRouteLocked"));
  }
}
