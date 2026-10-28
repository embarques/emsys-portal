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

export type DeliverySender = {
  name: string;
  phones: DeliveryReceiverPhone[];
};

/** A tenant pending barcode with its invoice receiver; crew membership does not limit visibility. */
export type AssignedDeliveryBarcode = Barcode & {
  receiver: DeliveryReceiver | null;
  sender: DeliverySender | null;
  /** Open balance of the owning invoice (`invoice.balance`); absent when the API omits it. */
  invoiceBalance?: number;
  /** DOP per USD from the row's daily route (`route.rate`); absent when the API omits it. */
  routeRate?: number;
};

/** USD amount converted with a route exchange rate; undefined without a usable rate. */
export function toDopAmount(usd: number, rate: number | undefined): number | undefined {
  if (rate == null || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(usd)) return undefined;
  return Math.round(usd * rate * 100) / 100;
}

/** Default delivery order is the receiver city; sorting stays on the server. */
export const DEFAULT_ASSIGNED_DELIVERY_SORT = "receiver.address.city:asc";

export function formatDeliveryAddress(receiver: DeliveryReceiver | null): string {
  if (!receiver) return "";
  return [receiver.address1, receiver.apartment].map((part) => part.trim()).filter(Boolean).join(", ");
}

export function formatDeliveryPhones(party: { phones: DeliveryReceiverPhone[] } | null): { label: string; dial: string }[] {
  return (party?.phones ?? [])
    .map((phone) => {
      const label = (phone.displayNumber || phone.number).trim();
      return { label, dial: (phone.number || label).replace(/[^\d+]/g, "") };
    })
    .filter((phone) => phone.label && phone.dial);
}

/** Daily-route DOP per USD. Unknown or invalid rates never become a fabricated zero. */
export function formatDeliveryRate(rate: number | undefined): string {
 if (rate == null || !Number.isFinite(rate) || rate <= 0) return "—";
 return new Intl.NumberFormat(undefined,{minimumFractionDigits:0,maximumFractionDigits:4}).format(rate);
}
