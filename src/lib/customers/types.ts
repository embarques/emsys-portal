import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { normalizeStoredPhone } from "@/lib/utils/phone";

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

export type CustomerBranchSettings = {
  labelPrefix: string;
  invoiceCreatedThruIncomeStatement: boolean;
  printLabelCount: boolean;
  roundDecimalPlaces: number;
  defaultLabelStatus: number;
  s3Profile: string;
  s3BucketName: string;
  s3BucketFolder: string;
  s3ShareLinkExpireMinutes: number;
  imageResampleBy: number;
};

export type CustomerBranch = {
  id: number;
  name: string;
  code: string;
  address: CustomerCoreAddress;
  phone1: string;
  logo: string;
  settings: CustomerBranchSettings;
};

export type Customer = {
  id: string;
  oldID: number;
  name: string;
  customerType: number | null;
  phone1: string;
  phone2: string;
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
  phone1: string;
  phone2: string;
  email: string;
  active: boolean;
  IDNumber: string;
  notes: string;
  accountBalance: number;
  branch: CustomerBranch;
  address: CustomerCoreAddress;
  addresses: CustomerCoreAddress[];
  createdByID: number | null;
  createdAt: string;
  updatedAt: string;
};

export function validateCustomerFormValues(values: CustomerFormValues): void {
  if (!values.name.trim()) {
    throw new Error("name is required.");
  }

  if (!values.phone1.trim()) {
    throw new Error("phone1 is required.");
  }

  if (!values.branch?.id || values.branch.id <= 0) {
    throw new Error("branch is required.");
  }
}

export type CustomerBranchFilter = number | "all";

export type CustomerFilterState = {
  query: string;
  searchField: CustomerSearchField;
  searchOperator: CustomerSearchOperator;
  branch: CustomerBranchFilter;
  active: boolean | "all";
  customerType: number | "all";
};

/** Matches GET /customers filter operators from the API spec. */
export type CustomerSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type CustomerSearchField =
  | "name"
  | "phone1"
  | "phone2"
  | "email"
  | "IDNumber"
  | "active"
  | "customerType"
  | "branch.id"
  | "oldID";

export type CustomerSearchFilter = {
  field: CustomerSearchField;
  operator: CustomerSearchOperator;
  value: string;
};

export type CustomerListParams = {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  search?: CustomerSearchFilter;
  branch?: CustomerBranchFilter;
  active?: boolean | "all";
  customerType?: number | "all";
};

/** GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc */
export const DEFAULT_CUSTOMER_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sortField: "name",
  sortDirection: "asc",
} as const satisfies Pick<CustomerListParams, "page" | "limit" | "sortField" | "sortDirection">;

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
 * Nested address / branch.code / id filters return 400 on GET — use POST /customers/search instead.
 */
export const CUSTOMER_GET_SEARCH_CAPABILITIES: {
  field: CustomerSearchField;
  label: string;
  operators: CustomerSearchOperator[];
}[] = [
  { field: "name", label: "Name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "phone1", label: "Phone 1", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "phone2", label: "Phone 2", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "email", label: "Email", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "IDNumber", label: "ID number", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "active", label: "Active", operators: ["eq", "neq"] },
  { field: "customerType", label: "Customer type", operators: ["eq", "neq"] },
  { field: "branch.id", label: "Branch ID", operators: ["eq", "neq"] },
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

export const CUSTOMER_ACTIVE_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Active" },
  { value: false, label: "Inactive" },
];

export const CUSTOMER_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Type 1" },
  { value: 2, label: "Type 2" },
];

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

export function createEmptyCustomerBranchSettings(): CustomerBranchSettings {
  return {
    labelPrefix: "",
    invoiceCreatedThruIncomeStatement: false,
    printLabelCount: false,
    roundDecimalPlaces: 0,
    defaultLabelStatus: 0,
    s3Profile: "",
    s3BucketName: "",
    s3BucketFolder: "",
    s3ShareLinkExpireMinutes: 0,
    imageResampleBy: 0,
  };
}

export function createCustomerBranchFromPortal(portal: CustomerPortalBranch): CustomerBranch {
  const config = CUSTOMER_PORTAL_BRANCHES.find((entry) => entry.portal === portal) ?? CUSTOMER_PORTAL_BRANCHES[0];

  return {
    id: config.id,
    name: config.label,
    code: config.code,
    address: createEmptyCustomerCoreAddress(portal === "dr" ? "DO" : "US"),
    phone1: "",
    logo: "",
    settings: createEmptyCustomerBranchSettings(),
  };
}

export function createEmptyCustomerForm(): CustomerFormValues {
  const branch = createCustomerBranchFromPortal("usa");
  const address = createEmptyCustomerCoreAddress("US");

  return {
    id: "",
    oldID: 0,
    name: "",
    customerType: null,
    phone1: "",
    phone2: "",
    email: "",
    active: true,
    IDNumber: "",
    notes: "",
    accountBalance: 0,
    branch,
    address,
    addresses: [address],
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

export function normalizeCustomerSearchFilter(search: CustomerSearchFilter): CustomerSearchFilter {
  const allowedOperators = getCustomerSearchOperatorsForField(search.field);
  const operator = allowedOperators.includes(search.operator)
    ? search.operator
    : getDefaultCustomerSearchOperator(search.field);

  return {
    field: search.field,
    operator,
    value: search.value,
  };
}

export function createCustomerSearchFilter(
  value: string,
  field: CustomerSearchField = "name",
  operator: CustomerSearchOperator = "startsWith",
): CustomerSearchFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let normalizedValue = trimmed;
  if (field === "active") {
    const lower = trimmed.toLowerCase();
    if (["active", "true", "yes"].includes(lower)) normalizedValue = "true";
    if (["inactive", "false", "no"].includes(lower)) normalizedValue = "false";
  }

  return normalizeCustomerSearchFilter({ field, operator, value: normalizedValue });
}

export function getCustomerSearchSortField(field: CustomerSearchField): string {
  switch (field) {
    case "oldID":
      return "oldID";
    case "phone1":
      return "phone1";
    case "phone2":
      return "phone2";
    case "email":
      return "email";
    case "IDNumber":
      return "IDNumber";
    case "active":
      return "active";
    case "customerType":
      return "customerType";
    case "branch.id":
      return "branch.id";
    default:
      return "name";
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
  if (customer.customerType === 1) return "sender";
  if (customer.customerType === 2) return "receiver";
  return null;
}

export function getCustomerPhones(customer: Pick<Customer, "phone1" | "phone2">): CustomerPhone[] {
  const phones: CustomerPhone[] = [];

  if (customer.phone1.trim()) {
    phones.push({ id: "phone1", number: customer.phone1.trim(), label: "Phone 1" });
  }

  if (customer.phone2.trim()) {
    phones.push({ id: "phone2", number: customer.phone2.trim(), label: "Phone 2" });
  }

  return phones;
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

  return {
    id: customer.id,
    oldID: customer.oldID,
    name: customer.name,
    customerType: customer.customerType,
    phone1: normalizeStoredPhone(customer.phone1),
    phone2: normalizeStoredPhone(customer.phone2),
    email: customer.email,
    active: customer.active,
    IDNumber: customer.IDNumber,
    notes: customer.notes,
    accountBalance: customer.accountBalance,
    branch: { ...customer.branch, address: { ...customer.branch.address } },
    address: { ...customer.address },
    addresses,
    createdByID: customer.createdByID,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
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
