import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import {
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  coerceCustomerTypeFromApi,
  isCustomerReceiverType,
  isCustomerSenderType,
} from "@/lib/customers/customer-type";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRandomId } from "@/lib/utils/id";
import {
  createDefaultRecordPhones,
  normalizeRecordPhonesFormValues,
  validateRecordPhones,
} from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";

export type CustomerPortalBranch = "usa" | "dr";

/**
 * GeoJSON Point. Coordinates use GeoJSON order: [longitude, latitude].
 */
export type AddressGeoLocation = {
  type: "Point";
  coordinates: [number, number];
};

/** Google verification metadata for an address. */
export type AddressVerification = {
  isVerified: boolean;
  /** ISO timestamp of when the address was verified, or empty when never verified. */
  verifiedAt: string;
};

export type CustomerAddressLabel =
  | "Primary"
  | "Home"
  | "Work"
  | "Billing"
  | "Delivery"
  | "Other";

export type CustomerSearchMatchField = "name" | "phone" | "idNumber" | "email" | "address";

export type CustomerSearchResult = {
  customer: Customer;
  matchedBy?: CustomerSearchMatchField;
  matchedAddressId?: string;
};

export type CustomerCoreAddress = {
  id?: string;
  label?: CustomerAddressLabel;
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  phone?: string;
  /** Whether this entry is the customer's primary address. */
  isPrimary: boolean;
  active?: boolean;
  /** GeoJSON location resolved from Google Places, when available. */
  location: AddressGeoLocation | null;
  /** Google verification metadata, when available. */
  verification: AddressVerification | null;
};

/** Parsed address resolved from a Google Places selection. */
export type ParsedPlaceAddress = {
  address1: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  location: AddressGeoLocation | null;
};

/** customer.Customer.branch — core.BranchDTO (list responses may omit `id`). */
export type CustomerBranch = {
  id: number;
  name: string;
  code: string;
};

export type Customer = {
  id: string;
  /** Legacy numeric customer ID from the EMSYS API. */
  oldID: number | null;
  name: string;
  customerType: number | null;
  phones: RecordPhone[];
  email: string;
  active: boolean;
  IDNumber: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  /** Stored customer balance returned by the API; the portal does not derive it from accounting records. */
  accountBalance: number;
  branch: CustomerBranch;
  createdByID: number | null;
  addresses: CustomerCoreAddress[];
  /** Total address count when the list API omits the full `addresses` array. */
  addressCount?: number;
  /** Linked receiver customer IDs. */
  receivers: string[];
};

/** Legacy phone shape used by orders and party editors. */
export type CustomerPhone = {
  id: string;
  number: string;
  displayNumber?: string;
  label?: string;
};

/** Legacy address shape used by orders and party editors. */
export type CustomerAddress = {
  id: string;
  streetAddress: string;
  apt?: string;
  crossStreet?: string;
  city: string;
  state?: string;
  provinceCountry?: string;
  zipCode?: string;
  isPrimary: boolean;
};

export type ClientType = "sender" | "receiver";

export type CustomerPhoneFormValues = {
  id: string;
  number: string;
  label: string;
};

export type CustomerAddressFormValues = {
  id: string;
  streetAddress: string;
  apt: string;
  crossStreet: string;
  city: string;
  state: string;
  provinceCountry: string;
  zipCode: string;
  isPrimary: boolean;
};

export type CustomerFormValues = {
  id: string;
  oldID: number | null;
  name: string;
  customerType: number | null;
  phones: RecordPhone[];
  email: string;
  active: boolean;
  IDNumber: string;
  notes: string;
  accountBalance: number;
  branch: CustomerBranch;
  addresses: CustomerCoreAddress[];
  receivers: string[];
  createdByID: number | null;
  createdAt: string;
  updatedAt: string;
};

export function validateCustomerFormValues(values: CustomerFormValues): void {
  if (!values.name.trim()) {
    throw new Error("name is required.");
  }

  validateRecordPhones(values.phones);

  if (!values.branch?.id || values.branch.id <= 0) {
    throw new Error("branch is required.");
  }

  if (values.customerType !== CUSTOMER_TYPE_SENDER && values.customerType !== CUSTOMER_TYPE_RECEIVER) {
    throw new Error("customerType is required.");
  }
}

export type CustomerBranchFilter = number | "all";

export type CustomerFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

/** @deprecated Chip filters — use CustomerFilterState.rows instead. */
export type CustomerLegacyChipFilterState = {
  query: string;
  branch: CustomerBranchFilter;
  customerType: number | "all";
};

/** Matches GET /customers filter operators from the API spec. */
export type CustomerSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type CustomerSearchField =
  | "id"
  | "name"
  | "phones.number"
  | "email"
  | "IDNumber"
  | "address.address1"
  | "customerType"
  | "branch.id";

export type CustomerSearchFilter = ApiListTextSearch;

export type CustomerListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  /** e.g. `name:asc` or `[{ field: "name", direction: "asc" }, { field: "createdAt", direction: "desc" }]` */
  sort?: ApiListSortInput;
  search?: CustomerSearchFilter;
  filterRows?: TableFilterRowState[];
  branch?: CustomerBranchFilter;
  customerType?: number | "all";
  /** Override the OR fields used for an unscoped bar search (defaults to CUSTOMER_BAR_OR_SEARCH_FIELDS). */
  orFields?: readonly string[];
};

/** GET /customers?page=1&limit=50&offset=0&sort=name:asc */
export const DEFAULT_CUSTOMER_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "name:asc",
} as const satisfies Pick<CustomerListParams, "page" | "limit" | "sort">;

const BRANCH_ID_TO_PORTAL: Record<number, CustomerPortalBranch> = {
  1: "usa",
  2: "dr",
};

const BRANCH_CODE_TO_PORTAL: Record<string, CustomerPortalBranch> = {
  NY: "usa",
  RD: "dr",
  DR: "dr",
  DO: "dr",
};

export const CUSTOMER_PORTAL_BRANCHES: {
  portal: CustomerPortalBranch;
  id: number;
  label: string;
  code: string;
}[] = [
  { portal: "usa", id: 1, label: "USA", code: "NY" },
  { portal: "dr", id: 2, label: "DR", code: "RD" },
];

/** Resolve branch id when the API returns only `name` and `code`. */
export function resolveCustomerBranchId(input: { id?: number | null; code?: string | null } = {}): number {
  const explicitId = input.id;
  if (typeof explicitId === "number" && Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }

  const normalizedCode = String(input.code ?? "").trim().toUpperCase();
  if (normalizedCode) {
    const byCode = CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.code.toUpperCase() === normalizedCode);
    if (byCode) return byCode.id;

    if (normalizedCode === "RD" || normalizedCode === "DR" || normalizedCode === "DO") {
      return CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.portal === "dr")?.id ?? 2;
    }
  }

  return CUSTOMER_PORTAL_BRANCHES[0]!.id;
}

/**
 * Customer search field + operator pairs verified against the live API.
 * Customer list filters use POST /customers/search with the standard advanced-search body.
 * Address filters query virtual `address.*` paths (see address-search-fields.ts).
 */
export const CUSTOMER_GET_SEARCH_CAPABILITIES: {
  field: CustomerSearchField;
  label: string;
  operators: CustomerSearchOperator[];
}[] = [
  { field: "name", label: "Name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "phones.number", label: "Phone", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "email", label: "Email", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "IDNumber", label: "ID number", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.address1", label: "Address 1", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "customerType", label: "Customer type", operators: ["eq", "neq"] },
  { field: "id", label: "Customer ID", operators: ["eq", "neq"] },
];

export const CUSTOMER_SEARCH_FIELDS: { value: CustomerSearchField; label: string }[] =
  CUSTOMER_GET_SEARCH_CAPABILITIES.map(({ field, label }) => ({ value: field, label }));

export const CUSTOMER_SEARCH_OPERATORS: { value: CustomerSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER } from "@/lib/customers/customer-type";

export const CUSTOMER_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: CUSTOMER_TYPE_SENDER, label: "Sender" },
  { value: CUSTOMER_TYPE_RECEIVER, label: "Receiver" },
];

export function normalizeCustomerType(value: number | null | undefined): number {
  return coerceCustomerTypeFromApi(value);
}

export function normalizeCustomerFormValues(values: CustomerFormValues): CustomerFormValues {
  return {
    ...applyCustomerTypeBranch({
      ...values,
      active: true,
      customerType: normalizeCustomerType(values.customerType),
      phones: normalizeRecordPhonesFormValues(values.phones),
      receivers: values.receivers.map((entry) => entry.trim()).filter(Boolean),
    }),
    addresses: normalizeCustomerAddresses(values.addresses),
  };
}

/** @deprecated Use customerType from the API. */
export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "sender", label: "Sender" },
  { value: "receiver", label: "Receiver" },
];

export function createRecordId(): string {
  return createRandomId();
}

export function createEmptyCustomerCoreAddress(country = "", isPrimary = false): CustomerCoreAddress {
  return {
    address1: "",
    address2: "",
    apartment: "",
    city: "",
    state: "",
    zipcode: "",
    country,
    location: null,
    verification: null,
    isPrimary,
  };
}

/** True when the address carries a confirmed Google verification. */
export function isAddressVerified(
  address: Pick<CustomerCoreAddress, "verification"> | null | undefined,
): boolean {
  return address?.verification?.isVerified === true;
}

/** Verification metadata stamped at `verifiedAt` (defaults to now). */
export function createAddressVerification(
  isVerified: boolean,
  verifiedAt: string = new Date().toISOString(),
): AddressVerification {
  return {
    isVerified,
    verifiedAt: isVerified ? verifiedAt : "",
  };
}

export function createAddressGeoLocation(longitude: number, latitude: number): AddressGeoLocation {
  return { type: "Point", coordinates: [longitude, latitude] };
}

/**
 * Apply a Google Places selection to an address: fills the resolved components,
 * stores the GeoJSON location, and marks the address as verified.
 * Existing apartment/address2 are preserved (Places rarely returns unit data).
 */
export function applyPlaceToCoreAddress(
  address: CustomerCoreAddress,
  place: ParsedPlaceAddress,
): CustomerCoreAddress {
  return {
    ...address,
    address1: place.address1 || address.address1,
    city: place.city || address.city,
    state: place.state || address.state,
    zipcode: place.zipcode || address.zipcode,
    country: place.country || address.country,
    location: place.location ?? address.location,
    verification: createAddressVerification(true),
  };
}

/**
 * Drop the Google verification (and location) once a verified field is edited by hand,
 * so a "verified" badge never lies about an address that no longer matches Places.
 */
export function clearCoreAddressVerification(address: CustomerCoreAddress): CustomerCoreAddress {
  if (!address.verification && !address.location) return address;
  return { ...address, location: null, verification: null };
}

/** The customer's primary address (`isPrimary` entry, or first with content). */
export function getCustomerPrimaryCoreAddress(
  customer: Pick<Customer, "addresses">,
): CustomerCoreAddress {
  const withContent = customer.addresses.filter(coreAddressHasContent);
  return withContent.find((entry) => entry.isPrimary) ?? withContent[0] ?? createEmptyCustomerCoreAddress();
}

/**
 * True when an address holds a real location worth verifying. The country is
 * auto-set from the customer type, so it's ignored — only a street, city, or
 * zip indicates an address that Google can verify.
 */
export function coreAddressRequiresVerification(address: CustomerCoreAddress): boolean {
  return Boolean(
    address.address1.trim() || address.city.trim() || address.zipcode.trim(),
  );
}

/**
 * True when the customer has a primary address that is real but not yet
 * verified. Only senders use Google verification — receivers pick from a
 * predetermined city list and are never flagged.
 */
export function customerHasUnverifiedPrimaryAddress(
  customer: Pick<Customer, "addresses" | "customerType">,
): boolean {
  if (!isCustomerSenderType(customer.customerType)) return false;
  const primary = getCustomerPrimaryCoreAddress(customer);
  return coreAddressRequiresVerification(primary) && !isAddressVerified(primary);
}

/** Addresses that hold a real location but still need a Google verification. */
export function getUnverifiedCoreAddresses(
  addresses: CustomerCoreAddress[],
): CustomerCoreAddress[] {
  return addresses.filter(
    (address) => coreAddressRequiresVerification(address) && !isAddressVerified(address),
  );
}

export function createCustomerBranchFromPortal(portal: CustomerPortalBranch): CustomerBranch {
  const config = CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.portal === portal) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return {
    id: config.id,
    name: config.label,
    code: config.code,
  };
}

/** Sender → USA branch; receiver → DR branch. */
export function getPortalBranchForCustomerType(customerType: number | null | undefined): CustomerPortalBranch {
  return isCustomerReceiverType(customerType) ? "dr" : "usa";
}

export function getDefaultCountryForPortalBranch(portal: CustomerPortalBranch): string {
  return portal === "dr" ? "DO" : "US";
}

export function applyCustomerTypeBranch(values: CustomerFormValues): CustomerFormValues {
  const portal = getPortalBranchForCustomerType(values.customerType);
  const branch = createCustomerBranchFromPortal(portal);
  const defaultCountry = getDefaultCountryForPortalBranch(portal);

  return {
    ...values,
    branch,
    addresses: values.addresses.map((entry) => ({ ...entry, country: defaultCountry })),
  };
}

export function createEmptyCustomerForm(): CustomerFormValues {
  const branch = createCustomerBranchFromPortal("usa");
  const address = createEmptyCustomerCoreAddress("US", true);

  return {
    id: "",
    oldID: null,
    name: "",
    customerType: CUSTOMER_TYPE_SENDER,
    phones: createDefaultRecordPhones(),
    email: "",
    active: true,
    IDNumber: "",
    notes: "",
    accountBalance: 0,
    branch,
    addresses: [address],
    receivers: [],
    createdByID: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Operators allowed for a GET /customers search field (verified API combinations only). */
export function getCustomerSearchOperatorsForField(field: CustomerSearchField): CustomerSearchOperator[] {
  return CUSTOMER_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === field)?.operators ?? ["eq"];
}

export function getDefaultCustomerSearchOperator(field: CustomerSearchField): CustomerSearchOperator {
  return getCustomerSearchOperatorsForField(field)[0];
}

/** GET /customers filter field name (same as portal field for supported searches). */
export function toApiCustomerSearchField(field: CustomerSearchField): string {
  return field;
}

export function createCustomerSearchFilter(value: string): CustomerSearchFilter | undefined {
  return createListTextSearch(value);
}

/** Plain list params for GET /customers — search and filterRows only when the user applies them. */
export function buildCustomerListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): CustomerListParams {
  const params: CustomerListParams = {
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_CUSTOMER_LIST_PARAMS.sort,
  };

  const search = createCustomerSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function getCustomerSearchSort(
  field: CustomerSearchField,
  direction: "asc" | "desc" = "asc",
): string {
  switch (field) {
    case "id":
      return `id:${direction}`;
    case "phones.number":
      return `phones.number:${direction}`;
    case "email":
      return `email:${direction}`;
    case "IDNumber":
      return `IDNumber:${direction}`;
    case "customerType":
      return `customerType:${direction}`;
    case "branch.id":
      return `branch.id:${direction}`;
    default:
      return `name:${direction}`;
  }
}

export function getCustomerPortalBranch(customer: Pick<Customer, "branch" | "addresses">): CustomerPortalBranch {
  if (BRANCH_ID_TO_PORTAL[customer.branch.id]) {
    return BRANCH_ID_TO_PORTAL[customer.branch.id];
  }

  const code = customer.branch.code.trim().toUpperCase();
  if (code && BRANCH_CODE_TO_PORTAL[code]) {
    return BRANCH_CODE_TO_PORTAL[code];
  }

  const country = getCustomerPrimaryCoreAddress(customer).country.trim().toUpperCase();
  if (country === "DO" || country === "DR") {
    return "dr";
  }

  return "usa";
}

export function portalBranchToId(portal: CustomerPortalBranch): number {
  return CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.portal === portal)?.id ?? 1;
}

export function getCustomerClientType(customer: Pick<Customer, "customerType">): ClientType | null {
  if (isCustomerReceiverType(customer.customerType)) return "receiver";
  if (customer.customerType === CUSTOMER_TYPE_SENDER || customer.customerType == null) return "sender";
  return null;
}

export function getCustomerPhones(customer: Pick<Customer, "phones">): CustomerPhone[] {
  return customer.phones
    .filter((phone) => phone.number.trim())
    .map((phone, index) => ({
      id: `phone-${index}`,
      number: phone.number.trim(),
      ...(phone.displayNumber?.trim() ? { displayNumber: phone.displayNumber.trim() } : {}),
      label: phone.isPrimary ? "Primary" : phone.type,
    }));
}

export function coreAddressHasContent(address: CustomerCoreAddress): boolean {
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

function coreAddressToLegacyAddress(
  customerId: string,
  address: CustomerCoreAddress,
  index: number,
  isPrimary: boolean,
): CustomerAddress {
  return {
    id: `${customerId}-address-${index}`,
    streetAddress: address.address1,
    apt: address.apartment || address.address2 || undefined,
    crossStreet: address.address2 || undefined,
    city: address.city,
    state: address.state || undefined,
    provinceCountry: address.country || undefined,
    zipCode: address.zipcode || undefined,
    isPrimary,
  };
}

export function getCustomerAddresses(
  customer: Pick<Customer, "id" | "addresses">,
): CustomerAddress[] {
  return customer.addresses
    .filter(coreAddressHasContent)
    .map((address, index) =>
      coreAddressToLegacyAddress(customer.id, address, index, address.isPrimary),
    );
}

/** Ensure exactly one address is marked primary; default first when none flagged. */
export function normalizeCustomerAddresses(addresses: CustomerCoreAddress[]): CustomerCoreAddress[] {
  const cloned = addresses.map((entry) => ({ ...entry }));
  if (cloned.length === 0) {
    return [createEmptyCustomerCoreAddress("", true)];
  }

  const primaryIndex = cloned.findIndex((entry) => entry.isPrimary);
  const resolvedPrimary = primaryIndex >= 0 ? primaryIndex : 0;

  return cloned.map((entry, index) => ({
    ...entry,
    isPrimary: index === resolvedPrimary,
  }));
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return normalizeCustomerFormValues({
    id: customer.id,
    oldID: customer.oldID,
    name: customer.name,
    customerType: customer.customerType,
    phones: customer.phones.map((phone) => ({ ...phone })),
    email: customer.email,
    active: customer.active,
    IDNumber: customer.IDNumber,
    notes: customer.notes,
    accountBalance: customer.accountBalance,
    branch: { ...customer.branch },
    addresses: customer.addresses.map((entry) => ({ ...entry })),
    receivers: [...customer.receivers],
    createdByID: customer.createdByID,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  });
}

/** Mark one address as primary without changing list order. */
export function setCustomerFormPrimaryAddress(
  values: CustomerFormValues,
  index: number,
): CustomerFormValues {
  if (index < 0 || index >= values.addresses.length) return values;

  return {
    ...values,
    addresses: values.addresses.map((entry, addressIndex) => ({
      ...entry,
      isPrimary: addressIndex === index,
    })),
  };
}

export function getPrimaryAddress(customer: Customer): CustomerAddress | undefined {
  return getCustomerAddresses(customer).find((entry) => entry.isPrimary) ?? getCustomerAddresses(customer)[0];
}

/** @deprecated Orders still reference clientId. */
export function getCustomerClientId(customer: Pick<Customer, "id">): string {
  return customer.id;
}

/** @deprecated Use getCustomerClientType instead. */
export function getCustomerLegacyClientType(customer: Customer): ClientType {
  return getCustomerClientType(customer) ?? "sender";
}

/** @deprecated Legacy form helpers retained for order flows only. */
export function createEmptyPhone(): CustomerPhoneFormValues {
  return { id: createRecordId(), number: "", label: "" };
}

/** @deprecated Legacy form helpers retained for order flows only. */
export function createEmptyAddress(isPrimary = false): CustomerAddressFormValues {
  return {
    id: createRecordId(),
    streetAddress: "",
    apt: "",
    crossStreet: "",
    city: "",
    state: "",
    provinceCountry: "",
    zipCode: "",
    isPrimary,
  };
}

/** @deprecated Legacy form helper retained for order flows only. */
export function createEmptyCustomerLegacyForm() {
  return {
    clientId: createRecordId(),
    clientType: "sender" as ClientType,
    name: "",
    documentId: "",
    phones: [createEmptyPhone()],
    email: "",
    notes: "",
    addresses: [createEmptyAddress(true)],
    createdBy: DEFAULT_CREATED_BY,
  };
}
