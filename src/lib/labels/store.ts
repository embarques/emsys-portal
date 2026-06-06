import type { LabelActivityEntry, ShipmentLabel } from "./types";

let labelsStore: ShipmentLabel[] = [];
let activityStore: LabelActivityEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeLabelsStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLabelsSnapshot(): ShipmentLabel[] {
  return labelsStore;
}

export function getLabelActivitySnapshot(): LabelActivityEntry[] {
  return activityStore;
}

export function setLabelsStore(next: ShipmentLabel[]) {
  labelsStore = next.map((label) => ({ ...label }));
  emit();
}

export function mutateLabelsStore(mutator: (current: ShipmentLabel[]) => ShipmentLabel[]) {
  labelsStore = mutator(labelsStore.map((label) => ({ ...label })));
  emit();
}

export function prependLabelActivity(entries: LabelActivityEntry[]) {
  activityStore = [...entries, ...activityStore].slice(0, 200);
  emit();
}

export function findLabelByBarcode(barcode: string): ShipmentLabel | undefined {
  const normalized = barcode.trim().toUpperCase();
  return labelsStore.find((label) => label.barcode.toUpperCase() === normalized);
}

export function getLabelsForInvoice(invoiceId: string): ShipmentLabel[] {
  return labelsStore
    .filter((label) => label.invoiceId === invoiceId)
    .sort((a, b) => {
      if (a.invoiceLineItemId !== b.invoiceLineItemId) {
        return a.invoiceLineItemId.localeCompare(b.invoiceLineItemId);
      }
      return a.labelSequence - b.labelSequence;
    });
}

export function cloneLabelsFromStore(): ShipmentLabel[] {
  return labelsStore.map((label) => ({ ...label }));
}

export function cloneLabelActivityFromStore(): LabelActivityEntry[] {
  return activityStore.map((entry) => ({ ...entry }));
}
