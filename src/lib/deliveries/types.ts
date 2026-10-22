import type { Barcode } from "@/lib/barcodes/types";

export type DeliveryReceiverPhone = {
  number: string;
  displayNumber?: string;
  type?: string;
  isPrimary?: boolean;
};

export type DeliveryReceiver = {
  name: string;
  address1: string;
  apartment: string;
  city: string;
  province: string;
  zipcode: string;
  phones: DeliveryReceiverPhone[];
};

/** A pending barcode on one of the signed-in user's daily routes, with its invoice receiver. */
export type AssignedDeliveryBarcode = Barcode & {
  receiver: DeliveryReceiver | null;
};

/** Province is the receiver address `state`; the API orders ties by invoice, then barcode. */
export const DEFAULT_ASSIGNED_DELIVERY_SORT = "receiver.address.state:asc";

export function formatDeliveryAddress(receiver: DeliveryReceiver | null): string {
  if (!receiver) return "";
  return [receiver.address1, receiver.apartment].map((part) => part.trim()).filter(Boolean).join(", ");
}

export function formatDeliveryPhones(receiver: DeliveryReceiver | null): { label: string; dial: string }[] {
  return (receiver?.phones ?? [])
    .map((phone) => {
      const label = (phone.displayNumber || phone.number).trim();
      return { label, dial: (phone.number || label).replace(/[^\d+]/g, "") };
    })
    .filter((phone) => phone.label && phone.dial);
}
