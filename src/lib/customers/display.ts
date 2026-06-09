import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { ClientType, Customer, CustomerAddress, CustomerCoreAddress, CustomerPortalBranch } from "./types";
import {
  CLIENT_TYPES,
  CUSTOMER_ACTIVE_OPTIONS,
  getCustomerAddresses,
  getCustomerClientType,
  getCustomerPhones,
  getCustomerPortalBranch,
  getPrimaryAddress,
} from "./types";

export function getClientTypeLabel(clientType: ClientType): string {
  return CLIENT_TYPES.find((entry) => entry.value === clientType)?.label ?? clientType;
}

export function getCustomerTypeLabel(customer: Customer): string {
  if (customer.customerType == null) return "—";
  return `Type ${customer.customerType}`;
}

export function getClientTypeBadgeClass(clientType: ClientType): string {
  return clientType === "sender"
    ? "border-transparent bg-primary/15 text-primary"
    : "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export function getCustomerActiveLabel(active: boolean): string {
  return CUSTOMER_ACTIVE_OPTIONS.find((entry) => entry.value === active)?.label ?? (active ? "Active" : "Inactive");
}

export function getCustomerActiveBadgeClass(active: boolean): string {
  return active
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-muted text-muted-foreground";
}

export function getCustomerBranchLabel(branch: CustomerPortalBranch): string {
  return getBranchLabel(branch);
}

export function getCustomerBranchBadgeClass(customer: Customer): string {
  return getBranchBadgeClass(getCustomerPortalBranch(customer));
}

export function formatCustomerDate(iso: string): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatCoreAddressLine(address: CustomerCoreAddress): string {
  const parts = [
    address.address1,
    address.address2,
    address.apartment,
    address.city,
    address.state,
    address.zipcode,
    address.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "—";
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
  return formatCoreAddressLine(customer.address);
}

export function formatPhoneSummary(customer: Customer): string {
  const phones = getCustomerPhones(customer);
  if (phones.length === 0) return "—";

  const first = phones[0];
  const label = first.label ? `${first.label}: ` : "";
  const suffix = phones.length > 1 ? ` (+${phones.length - 1})` : "";
  return `${label}${first.number}${suffix}`;
}

export function formatPhoneList(customer: Customer): string {
  const phones = getCustomerPhones(customer);
  if (phones.length === 0) return "—";

  return phones
    .map((phone) => (phone.label ? `${phone.label}: ${phone.number}` : phone.number))
    .join(" · ");
}

export function formatCustomerBranchLabel(customer: Customer): string {
  const portalBranch = getCustomerPortalBranch(customer);
  const branchLabel = getCustomerBranchLabel(portalBranch);
  const details = [customer.branch.name, customer.branch.code].filter(Boolean).join(" · ");
  return details ? `${branchLabel} (${details})` : branchLabel;
}

export function truncateCustomerId(customerId: string): string {
  return customerId.length > 12 ? `${customerId.slice(0, 8)}…` : customerId;
}

/** @deprecated Use truncateCustomerId */
export const truncateClientId = truncateCustomerId;

export function customerMatchesQuery(customer: Customer, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const clientType = getCustomerClientType(customer);

  return [
    customer.id,
    String(customer.oldID),
    customer.name,
    customer.phone1,
    customer.phone2,
    customer.address.address1,
    customer.address.address2,
    customer.address.apartment,
    customer.address.city,
    customer.address.state,
    customer.address.zipcode,
    customer.address.country,
    customer.branch.code,
    customer.branch.name,
    clientType ? getClientTypeLabel(clientType) : "",
    getCustomerActiveLabel(customer.active),
    customer.customerType != null ? String(customer.customerType) : "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeCustomerKpis(customers: Customer[]) {
  return {
    total: customers.length,
    active: customers.filter((customer) => customer.active).length,
    inactive: customers.filter((customer) => !customer.active).length,
    type1: customers.filter((customer) => customer.customerType === 1).length,
  };
}

export { getPrimaryAddress };
