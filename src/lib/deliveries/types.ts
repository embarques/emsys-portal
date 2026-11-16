import type { Barcode } from "@/lib/barcodes/types";
import { createEmptyCustomerCoreAddress, type CustomerCoreAddress } from "@/lib/customers/types";
import type { RecordPhone, RecordPhoneType } from "@/lib/phones/types";

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

/** Default delivery order is the receiver address `city`; the server sorts and orders ties by invoice, then barcode. */
export const DEFAULT_ASSIGNED_DELIVERY_SORT = "receiver.address.city:asc";

export function formatDeliveryAddress(receiver: DeliveryReceiver | null): string {
  if (!receiver) return "";
  return [receiver.address1, receiver.apartment].map((part) => part.trim()).filter(Boolean).join(", ");
}

function coerceDeliveryPhoneType(value: string | undefined): RecordPhoneType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "business") return "business";
  if (normalized === "home") return "home";
  if (normalized === "other") return "other";
  return "mobile";
}

/** Normalize delivery party phones for PhoneActionRow / TablePhoneCell. */
export function toDeliveryRecordPhones(
  phones: DeliveryReceiverPhone[] | null | undefined,
): RecordPhone[] {
  return (phones ?? [])
    .map((phone) => {
      const number = phone.number.trim();
      if (!number) return null;
      const displayNumber = phone.displayNumber?.trim();
      return {
        type: coerceDeliveryPhoneType(phone.type),
        number,
        ...(displayNumber ? { displayNumber } : {}),
        isPrimary: Boolean(phone.isPrimary),
      } satisfies RecordPhone;
    })
    .filter((phone): phone is RecordPhone => phone != null);
}

/** Full multi-line core address for delivery receiver action rows. */
export function toDeliveryReceiverCoreAddress(
  receiver: DeliveryReceiver | null | undefined,
): CustomerCoreAddress | null {
  if (!receiver) return null;
  const address = createEmptyCustomerCoreAddress(receiver.province ? "DO" : "", true);
  address.address1 = receiver.address1;
  address.apartment = receiver.apartment;
  address.city = receiver.city;
  address.state = receiver.province;
  address.zipcode = receiver.zipcode;
  const hasContent = [address.address1, address.apartment, address.city, address.state, address.zipcode]
    .some((part) => part.trim().length > 0);
  return hasContent ? address : null;
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
