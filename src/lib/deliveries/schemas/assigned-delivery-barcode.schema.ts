import { z } from "zod";

import { normalizeBarcode } from "@/lib/labels/api/barcodes-api";
import type { AssignedDeliveryBarcode, DeliveryReceiver } from "@/lib/deliveries/types";

const text = z.string().nullish().transform((value) => value?.trim() ?? "");

const receiverPhoneSchema = z.object({
  number: text,
  displayNumber: text,
  type: text,
  isPrimary: z.boolean().nullish(),
});

export const deliveryReceiverSchema = z.object({
  name: text,
  address: z.object({
    address1: text,
    apartment: text,
    city: text,
    state: text,
    zipcode: text,
  }).nullish(),
  phones: z.array(receiverPhoneSchema).nullish(),
});

function toDeliveryReceiver(raw: unknown): DeliveryReceiver | null {
  if (raw == null) return null;
  const receiver = deliveryReceiverSchema.parse(raw);
  return {
    name: receiver.name,
    address1: receiver.address?.address1 ?? "",
    apartment: receiver.address?.apartment ?? "",
    city: receiver.address?.city ?? "",
    province: receiver.address?.state ?? "",
    zipcode: receiver.address?.zipcode ?? "",
    phones: (receiver.phones ?? [])
      .filter((phone) => phone.number || phone.displayNumber)
      .map((phone) => ({
        number: phone.number,
        ...(phone.displayNumber ? { displayNumber: phone.displayNumber } : {}),
        ...(phone.type ? { type: phone.type } : {}),
        ...(phone.isPrimary != null ? { isPrimary: phone.isPrimary } : {}),
      })),
  };
}

export function parseAssignedDeliveryBarcodes(data: unknown): AssignedDeliveryBarcode[] {
  if (!Array.isArray(data)) throw new Error("Invalid assigned deliveries response.");
  return data.map((raw) => {
    const barcode = normalizeBarcode(raw);
    if (!barcode) throw new Error("Invalid assigned delivery barcode.");
    return { ...barcode, receiver: toDeliveryReceiver((raw as { receiver?: unknown }).receiver) };
  });
}
