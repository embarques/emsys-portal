import type { Delivery, DeliveryBarcode, DeliveryInvoiceGroup } from "@/lib/deliveries/types";

export function formatDeliveryId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export function formatDeliveryDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getDeliveryCrew(delivery: Delivery): string {
  return [delivery.employee?.name, delivery.helper1?.name, delivery.helper2?.name]
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ") || "-";
}

export function groupDeliveryBarcodes(barcodes: DeliveryBarcode[]): DeliveryInvoiceGroup[] {
  const groups = new Map<string, DeliveryInvoiceGroup>();

  for (const barcode of barcodes) {
    const key = barcode.invoice?.id || barcode.lineItemName || String(barcode.id);
    const current = groups.get(key);
    if (current) {
      current.barcodes.push(barcode);
      current.labels += 1;
      current.quantity += barcode.quantity;
      continue;
    }

    groups.set(key, {
      key,
      invoice: barcode.invoice,
      description: barcode.lineItemName || barcode.invoice?.number || "Delivery package",
      quantity: barcode.quantity,
      labels: 1,
      barcodes: [barcode],
    });
  }

  return Array.from(groups.values());
}

export function computeDeliveryKpis(deliveries: Delivery[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: deliveries.length,
    scheduledToday: deliveries.filter((delivery) => delivery.date.slice(0, 10) === today).length,
    assignedCrew: deliveries.filter((delivery) => delivery.employee != null).length,
  };
}
