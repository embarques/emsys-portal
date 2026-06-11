import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import {
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  coerceCustomerTypeFromApi,
  isCustomerReceiverType,
} from "@/lib/customers/customer-type";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import {
  createDefaultRecordPhones,
  normalizeRecordPhonesFormValues,
  validateRecordPhones,
} from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";

export type CustomerPortalBranch = "usa" | "dr";

export type CustomerCoreAddress = {
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
};

/** customer.Customer.branch — core.BranchDTO */
export type CustomerBranch = {
  id: number;
  name: string;
  code: string;
};

export type Customer = {
  id: string;
  oldID: number;
  name: string;
  customerType: number | null;
  phones: RecordPhone[];
  email: string;
  active: boolean;
  IDNumber: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  accountBalance: number;
  branch: CustomerBranch;
  createdByID: number | null;
  /** Primary address from the API `address` field. */
  address: CustomerCoreAddress;
  /** Additional addresses from the API `addresses` array. */
  addresses: CustomerCoreAddress[];
  /** Linked receiver customer IDs. */
  receivers: string[];
};

/** Legacy phone shape used by orders and party editors. */
export type CustomerPhone = {
  id: string;
  number: string;
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
  oldID: number;
  name: string;
  customerType: number | null;
  phones: RecordPhone[];
  email: string;
  active: boolean;
  IDNumber: string;
  notes: string;
  accountBalance: number;
  branch: CustomerBranch;
  address: CustomerCoreAddress;
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
  | "name"
  | "phones.number"
  | "email"
  | "IDNumber"
  | "address.address1"
  | "customerType"
  | "branch.id"
  | "oldID";

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
};

/** GET /customers?page=1&limit=40&offset=0&sort=name:asc */
export const DEFAULT_CUSTOMER_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "name:asc",
} as const satisfies Pick<CustomerListParams, "page" | "limit" | "sort">;

const BRANCH_ID_TO_PORTAL: Record<number, CustomerPortalBranch> = {
  1: "usa",
  2: "dr",
};

const BRANCH_CODE_TO_PORTAL: Record<string, CustomerPortalBranch> = {
  NY: "usa",
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
  { portal: "dr", id: 2, label: "DR", code: "DR" },
];

/**
 * GET /customers field + operator pairs verified against the live API.
 * Branch and customerType chips use query params (branchId, customerType).
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
  { field: "oldID", label: "Old ID", operators: ["eq", "neq"] },
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
  return applyCustomerTypeBranch({
    ...values,
    active: true,
    customerType: normalizeCustomerType(values.customerType),
    phones: normalizeRecordPhonesFormValues(values.phones),
    receivers: values.receivers.map((entry) => entry.trim()).filter(Boolean),
  });
}

/** @deprecated Use customerType from the API. */
export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "sender", label: "Sender" },
  { value: "receiver", label: "Receiver" },
];

export function createRecordId(): string {
  return crypto.randomUUID();
}

export function createEmptyCustomerCoreAddress(country = ""): CustomerCoreAddress {
  return {
    address1: "",
    address2: "",
    apartment: "",
    city: "",
    state: "",
    zipcode: "",
    country,
  };
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

  return syncCustomerFormAddresses({
    ...values,
    branch,
    address: {
      ...values.address,
      country: values.address.country.trim() || defaultCountry,
    },
  });
}

export function createEmptyCustomerForm(): CustomerFormValues {
  const branch = createCustomerBranchFromPortal("usa");
  const address = createEmptyCustomerCoreAddress("US");

  return {
    id: "",
    oldID: 0,
    name: "",
    customerType: CUSTOMER_TYPE_SENDER,
    phones: createDefaultRecordPhones(),
    email: "",
    active: true,
    IDNumber: "",
    notes: "",
    accountBalance: 0,
    branch,
    address,
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
}): CustomerListParams {
  const params: CustomerListParams = {
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_CUSTOMER_LIST_PARAMS.limit,
  };

  const search = createCustomerSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter(isCompleteFilterRow);
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
    case "oldID":
      return `oldID:${direction}`;
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

export function getCustomerPortalBranch(customer: Pick<Customer, "branch" | "address">): CustomerPortalBranch {
  if (BRANCH_ID_TO_PORTAL[customer.branch.id]) {
    return BRANCH_ID_TO_PORTAL[customer.branch.id];
  }

  const code = customer.branch.code.trim().toUpperCase();
  if (code && BRANCH_CODE_TO_PORTAL[code]) {
    return BRANCH_CODE_TO_PORTAL[code];
  }

  const country = customer.address.country.trim().toUpperCase();
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
      label: phone.isPrimary ? "Primary" : phone.type,
    }));
}

function coreAddressHasContent(address: CustomerCoreAddress): boolean {
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
  customer: Pick<Customer, "id" | "address" | "addresses">,
): CustomerAddress[] {
  const source =
    customer.addresses.length > 0
      ? customer.addresses
      : coreAddressHasContent(customer.address)
        ? [customer.address]
        : [];

  return source
    .filter(coreAddressHasContent)
    .map((address, index) => coreAddressToLegacyAddress(customer.id, address, index, index === 0));
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  const addresses =
    customer.addresses.length > 0
      ? customer.addresses.map((entry) => ({ ...entry }))
      : [{ ...customer.address }];

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
    address: { ...customer.address },
    addresses,
    receivers: [...customer.receivers],
    createdByID: customer.createdByID,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  });
}

export function syncCustomerFormAddresses(values: CustomerFormValues): CustomerFormValues {
  const addresses =
    values.addresses.length > 0
      ? values.addresses.map((entry, index) =>
          index === 0 ? { ...values.address } : { ...entry },
        )
      : [{ ...values.address }];

  return {
    ...values,
    address: { ...addresses[0] },
    addresses,
  };
}

export function getPrimaryAddress(customer: Customer): CustomerAddress | undefined {
  return getCustomerAddresses(customer)[0];
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
