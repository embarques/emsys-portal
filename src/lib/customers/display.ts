import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import type { ClientType, Customer, CustomerAddress, CustomerCoreAddress, CustomerPortalBranch } from "./types";
import { isCustomerReceiverType, isCustomerSenderType } from "./customer-type";
import {
  CLIENT_TYPES,
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
  return isCustomerReceiverType(customer.customerType) ? "Receiver" : "Sender";
}

export function getClientTypeBadgeClass(clientType: ClientType): string {
  return clientType === "sender"
    ? "border-transparent bg-primary/15 text-primary"
    : "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
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

function getCustomerCoreAddresses(customer: Customer): CustomerCoreAddress[] {
  const source = customer.addresses.length > 0 ? customer.addresses : [customer.address];

  return source.filter((address) =>
    [address.address1, address.address2, address.apartment, address.city, address.state, address.zipcode, address.country].some(
      (value) => value.trim(),
    ),
  );
}

export function formatAddressSummary(customer: Customer): string {
  const addresses = getCustomerCoreAddresses(customer);
  if (addresses.length === 0) return "—";

  const first = formatCoreAddressLine(addresses[0]);
  const suffix = addresses.length > 1 ? ` (+${addresses.length - 1})` : "";
  return `${first}${suffix}`;
}

export function formatAccountBalance(balance: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(balance);
}

export function formatPhoneSummary(customer: Customer): string {
  const phones = getCustomerPhones(customer);
  if (phones.length === 0) return "—";

  const first = phones[0];
  const label = first.label ? `${first.label}: ` : "";
  const suffix = phones.length > 1 ? ` (+${phones.length - 1})` : "";
  return `${label}${formatPhoneForDisplay(first.number)}${suffix}`;
}

export function formatPhoneList(customer: Customer): string {
  const phones = getCustomerPhones(customer);
  if (phones.length === 0) return "—";

  return phones
    .map((phone) => {
      const formatted = formatPhoneForDisplay(phone.number);
      return phone.label ? `${phone.label}: ${formatted}` : formatted;
    })
    .join(" · ");
}

export function formatCustomerBranchLabel(customer: Customer): string {
  const portalBranch = getCustomerPortalBranch(customer);
  const branchLabel = getCustomerBranchLabel(portalBranch);
  const details = [customer.branch.name, customer.branch.code].filter(Boolean).join(" · ");
  return details ? `${branchLabel} (${details})` : branchLabel;
}

export function formatReceiversSummary(customer: Pick<Customer, "receivers">): string {
  if (customer.receivers.length === 0) return "—";
  if (customer.receivers.length === 1) return truncateCustomerId(customer.receivers[0]!);

  return `${customer.receivers.length} linked`;
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

  const addressFields = getCustomerCoreAddresses(customer).flatMap((address) => [
    address.address1,
    address.address2,
    address.apartment,
    address.city,
    address.state,
    address.zipcode,
    address.country,
  ]);

  return [
    customer.id,
    String(customer.oldID),
    customer.name,
    ...customer.phones.map((phone) => phone.number),
    customer.email,
    customer.IDNumber,
    customer.notes,
    String(customer.accountBalance),
    ...addressFields,
    customer.branch.code,
    customer.branch.name,
    clientType ? getClientTypeLabel(clientType) : "",
    customer.customerType != null ? String(customer.customerType) : "",
    ...customer.receivers,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeCustomerKpis(customers: Customer[]) {
  return {
    total: customers.length,
    senders: customers.filter((customer) => isCustomerSenderType(customer.customerType)).length,
  };
}

export { getPrimaryAddress };
