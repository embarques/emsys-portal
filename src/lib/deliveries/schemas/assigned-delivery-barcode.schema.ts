import { z } from "zod";

import { normalizeBarcode } from "@/lib/labels/api/barcodes-api";
import type {
  AssignedDeliveryBarcode,
  DeliveryReceiver,
  DeliveryReceiverPhone,
  DeliverySender,
} from "@/lib/deliveries/types";

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

const deliverySenderSchema = z.object({
  name: text,
  phones: z.array(receiverPhoneSchema).nullish(),
});

function toDeliveryPhones(phones: z.infer<typeof receiverPhoneSchema>[] | null | undefined): DeliveryReceiverPhone[] {
  return (phones ?? [])
    .filter((phone) => phone.number || phone.displayNumber)
    .map((phone) => ({
      number: phone.number,
      ...(phone.displayNumber ? { displayNumber: phone.displayNumber } : {}),
      ...(phone.type ? { type: phone.type } : {}),
      ...(phone.isPrimary != null ? { isPrimary: phone.isPrimary } : {}),
    }));
}

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
    phones: toDeliveryPhones(receiver.phones),
  };
}

function toDeliverySender(raw: unknown): DeliverySender | null {
  if (raw == null) return null;
  const sender = deliverySenderSchema.parse(raw);
  return { name: sender.name, phones: toDeliveryPhones(sender.phones) };
}

const invoiceBalanceSchema = z.object({
  invoice: z.object({ balance: z.union([z.number(), z.string()]).nullish() }).nullish(),
});

function toInvoiceBalance(raw: unknown): number | undefined {
  const parsed = invoiceBalanceSchema.safeParse(raw);
  const value = parsed.success ? parsed.data.invoice?.balance : undefined;
  if (value == null || value === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : undefined;
}

const routeRateSchema = z.object({
  route: z.object({ rate: z.union([z.number(), z.string()]).nullish() }).nullish(),
});

function toRouteRate(raw: unknown): number | undefined {
  const parsed = routeRateSchema.safeParse(raw);
  const value = parsed.success ? parsed.data.route?.rate : undefined;
  if (value == null || value === "") return undefined;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

export function parseAssignedDeliveryBarcodes(data: unknown): AssignedDeliveryBarcode[] {
  if (!Array.isArray(data)) throw new Error("Invalid assigned deliveries response.");
  return data.map((raw) => {
    const barcode = normalizeBarcode(raw);
    if (!barcode) throw new Error("Invalid assigned delivery barcode.");
    const invoiceBalance = toInvoiceBalance(raw);
    const routeRate = toRouteRate(raw);
    return {
      ...barcode,
      receiver: toDeliveryReceiver((raw as { receiver?: unknown }).receiver),
      sender: toDeliverySender((raw as { sender?: unknown }).sender),
      ...(invoiceBalance != null ? { invoiceBalance } : {}),
      ...(routeRate != null ? { routeRate } : {}),
    };
  });
}
