import type { ClientType, Customer, CustomerAddress } from "./types";
import { CLIENT_TYPES, getPrimaryAddress } from "./types";

export function getClientTypeLabel(clientType: ClientType): string {
  return CLIENT_TYPES.find((entry) => entry.value === clientType)?.label ?? clientType;
}

export function getClientTypeBadgeClass(clientType: ClientType): string {
  return clientType === "sender"
    ? "border-transparent bg-primary/15 text-primary"
    : "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export function formatCustomerDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatAddressLine(address: CustomerAddress): string {
  const parts = [
    address.streetAddress,
    address.apt,
    address.city,
    address.state,
    address.provinceCountry,
    address.zipCode,
  ].filter(Boolean);
  return parts.join(", ");
}

export function formatAddressSummary(customer: Customer): string {
  const primary = getPrimaryAddress(customer);
  if (!primary) return "—";
  return formatAddressLine(primary);
}

export function formatPhoneSummary(customer: Customer): string {
  if (customer.phones.length === 0) return "—";
  const first = customer.phones[0];
  const label = first.label ? `${first.label}: ` : "";
  const suffix = customer.phones.length > 1 ? ` (+${customer.phones.length - 1})` : "";
  return `${label}${first.number}${suffix}`;
}

export function formatPhoneList(customer: Customer): string {
  if (customer.phones.length === 0) return "—";
  return customer.phones
    .map((phone) => (phone.label ? `${phone.label}: ${phone.number}` : phone.number))
    .join(" · ");
}

export function truncateClientId(clientId: string): string {
  return `${clientId.slice(0, 8)}…`;
}

export function customerMatchesQuery(customer: Customer, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const phoneText = customer.phones.map((phone) => `${phone.label ?? ""} ${phone.number}`).join(" ");
  const addressText = customer.addresses
    .map((address) =>
      [
        address.streetAddress,
        address.apt,
        address.crossStreet,
        address.city,
        address.state,
        address.provinceCountry,
        address.zipCode,
      ].join(" ")
    )
    .join(" ");

  return [
    customer.clientId,
    customer.name,
    customer.documentId ?? "",
    customer.email ?? "",
    phoneText,
    addressText,
    getClientTypeLabel(customer.clientType),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeCustomerKpis(customers: Customer[]) {
  return {
    total: customers.length,
    senders: customers.filter((customer) => customer.clientType === "sender").length,
    receivers: customers.filter((customer) => customer.clientType === "receiver").length,
    missingDocument: customers.filter((customer) => !customer.documentId).length,
  };
}
