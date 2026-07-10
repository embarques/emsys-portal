import { getPrimaryRecordPhone, getRecordPhoneDisplayNumber } from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";
import type { Customer, CustomerCoreAddress } from "@/lib/customers/types";

/** Wrap long address strings on word boundaries only (never mid-word). */
export const ADDRESS_TEXT_WRAP_CLASSNAME =
  "min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:break-word]";

function addressHasContent(address: CustomerCoreAddress): boolean {
  return [
    address.address1,
    address.address2,
    address.apartment,
    address.city,
    address.state,
    address.zipcode,
    address.country,
  ].some((value) => value.trim());
}

/** Stable key for deduplicating addresses within a customer. */
export function getAddressKey(address: CustomerCoreAddress): string {
  if (address.id?.trim()) return address.id.trim();
  return [address.address1, address.city, address.state, address.zipcode]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

/** All non-empty addresses on a customer, deduplicated. */
export function getAllAddresses(customer: Pick<Customer, "addresses">): CustomerCoreAddress[] {
  const seen = new Set<string>();
  const ordered: CustomerCoreAddress[] = [];

  for (const candidate of customer.addresses) {
    if (!addressHasContent(candidate)) continue;
    const key = getAddressKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(candidate);
  }

  return ordered;
}

export function getPrimaryAddressIndex(addresses: CustomerCoreAddress[]): number {
  if (addresses.length === 0) return -1;

  const explicitPrimary = addresses.findIndex((address) => address.isPrimary === true);
  if (explicitPrimary >= 0) return explicitPrimary;

  const firstActive = addresses.findIndex((address) => address.active !== false);
  if (firstActive >= 0) return firstActive;

  return 0;
}

/**
 * Primary address resolution:
 * 1. address where isPrimary === true
 * 2. first active address
 * 3. first address
 * 4. undefined
 */
export function getPrimaryAddress(
  customer: Pick<Customer, "addresses">,
): CustomerCoreAddress | undefined {
  const addresses = getAllAddresses(customer);
  if (addresses.length === 0) return undefined;

  const index = getPrimaryAddressIndex(addresses);
  return index >= 0 ? addresses[index] : undefined;
}

export function findAddressById(
  customer: Pick<Customer, "addresses">,
  addressId?: string,
): CustomerCoreAddress | undefined {
  const normalizedId = addressId?.trim();
  if (!normalizedId) return undefined;

  return getAllAddresses(customer).find((address) => address.id?.trim() === normalizedId);
}

export function getMatchedAddress(
  customer: Pick<Customer, "addresses">,
  matchedAddressId?: string,
): CustomerCoreAddress | undefined {
  return findAddressById(customer, matchedAddressId);
}

function trimAddressPart(value?: string): string {
  return String(value ?? "").trim();
}

/** True when the address country is Dominican Republic (DO / DR). */
export function isDominicanRepublicAddressCountry(country?: string): boolean {
  const normalized = trimAddressPart(country).toUpperCase();
  return (
    normalized === "DO" ||
    normalized === "DR" ||
    normalized === "DOM" ||
    normalized === "DOMINICAN REPUBLIC"
  );
}

function formatStreetLine(address: CustomerCoreAddress): string {
  return [address.address1, address.apartment, address.address2]
    .map(trimAddressPart)
    .filter(Boolean)
    .join(" ");
}

function formatUsaLocationLine(city: string, state: string, zipcode: string): string {
  if (city && state && zipcode) return `${city}, ${state} ${zipcode}`;
  if (city && state) return `${city}, ${state}`;
  if (city && zipcode) return `${city} ${zipcode}`;
  return [city, state, zipcode].filter(Boolean).join(", ");
}

function formatDrLocationLine(city: string, state: string): string {
  return [city, state].filter(Boolean).join(", ");
}

function collectFormattedAddressParts(
  address: CustomerCoreAddress,
  style: "short" | "full",
): string[] {
  const street = formatStreetLine(address);
  if (style === "short") {
    return street ? [street] : [];
  }

  const parts: string[] = [];
  if (street) parts.push(street);

  const city = trimAddressPart(address.city);
  const state = trimAddressPart(address.state);
  const zipcode = trimAddressPart(address.zipcode);
  const country = trimAddressPart(address.country);
  const isDr = isDominicanRepublicAddressCountry(address.country);

  const localityLine = isDr
    ? formatDrLocationLine(city, state)
    : formatUsaLocationLine(city, state, zipcode);
  const locationLine = [localityLine, country].filter(Boolean).join(", ");

  if (locationLine) parts.push(locationLine);

  return parts;
}

/** Short or full single-line address for tables and compact dropdown rows. */
export function formatAddressLine(
  address: CustomerCoreAddress,
  style: "short" | "full" = "short",
): string {
  const parts = collectFormattedAddressParts(address, style);
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Grouped address lines (street / city-state-zip or city-province for DR). */
export function formatCoreAddressLines(address: CustomerCoreAddress): string[] {
  return collectFormattedAddressParts(address, "full");
}

/** @deprecated Use formatAddressLine */
export const formatAddress = formatAddressLine;

export function getAddressCountLabel(additionalCount: number): string {
  if (additionalCount <= 0) return "";
  if (additionalCount === 1) return "+1 more address";
  return `+${additionalCount} more addresses`;
}

export function getAddressCountBadgeLabel(count: number): string {
  if (count <= 1) return "";
  return `${count} addresses`;
}

export function orderAddressesForDisplay(
  customer: Pick<Customer, "addresses">,
  matchedAddressId?: string,
): CustomerCoreAddress[] {
  const all = getAllAddresses(customer);
  const primary = getPrimaryAddress(customer);
  const matched = getMatchedAddress(customer, matchedAddressId);
  const ordered: CustomerCoreAddress[] = [];
  const seen = new Set<string>();

  function append(address?: CustomerCoreAddress) {
    if (!address) return;
    const key = getAddressKey(address);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(address);
  }

  append(matched);
  if (primary && (!matched || getAddressKey(primary) !== getAddressKey(matched))) {
    append(primary);
  }
  for (const address of all) {
    append(address);
  }

  return ordered;
}

export function getAddressLabel(address: CustomerCoreAddress, index: number): string {
  if (address.label?.trim()) return address.label.trim();
  if (address.isPrimary) return "Primary";
  if (index === 0) return "Primary";
  return "Other";
}

const ADDRESS_LABEL_KEYS: Record<string, string> = {
  Primary: "customers.addresses.labels.primary",
  Home: "customers.addresses.labels.home",
  Work: "customers.addresses.labels.work",
  Billing: "customers.addresses.labels.billing",
  Delivery: "customers.addresses.labels.delivery",
  Other: "customers.addresses.labels.other",
};

/** i18n key for a display label badge, or undefined if no known mapping. */
export function getAddressLabelKey(address: CustomerCoreAddress, index: number): string {
  const label = getAddressLabel(address, index);
  return ADDRESS_LABEL_KEYS[label] ?? "customers.addresses.labels.other";
}

export function countCustomerAddresses(customer: Pick<Customer, "addresses">): number {
  return getAllAddresses(customer).length;
}

/** Prefer explicit API count when the list payload omits the full addresses array. */
export function resolveCustomerAddressCount(
  customer: Pick<Customer, "addresses" | "addressCount">,
): number {
  const localCount = countCustomerAddresses(customer);
  if (typeof customer.addressCount === "number" && customer.addressCount > localCount) {
    return customer.addressCount;
  }
  return localCount;
}

export function getPrimaryPhone(customer: Pick<Customer, "phones">): RecordPhone | undefined {
  return getPrimaryRecordPhone(customer.phones);
}

export function getPrimaryPhoneDisplay(customer: Pick<Customer, "phones">): string {
  const phone = getPrimaryPhone(customer);
  return phone ? getRecordPhoneDisplayNumber(phone) : "";
}
