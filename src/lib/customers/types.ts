import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

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
  active: boolean;
  createdAt: string;
  updatedAt: string;
  branch: CustomerBranch;
  createdByID: number | null;
  address: CustomerCoreAddress;
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
  active: boolean;
  branch: CustomerBranch;
  address: CustomerCoreAddress;
  createdByID: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFilterState = {
  query: string;
  searchField: CustomerSearchField;
  searchOperator: CustomerSearchOperator;
  branch: CustomerPortalBranch | "all";
  active: boolean | "all";
  customerType: number | "all";
};

/** Matches GET /customers filter operators from the API spec. */
export type CustomerSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type CustomerSearchField =
  | "id"
  | "oldID"
  | "name"
  | "phone1"
  | "phone2"
  | "active"
  | "customerType"
  | "address.address1"
  | "address.address2"
  | "address.apartment"
  | "address.city"
  | "address.state"
  | "address.country"
  | "address.zipcode"
  | "branch.code"
  | "branch.id";

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
  branch?: CustomerPortalBranch | "all";
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

export const CUSTOMER_SEARCH_FIELDS: { value: CustomerSearchField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "phone1", label: "Phone 1" },
  { value: "phone2", label: "Phone 2" },
  { value: "active", label: "Active" },
  { value: "customerType", label: "Customer type" },
  { value: "address.address1", label: "Address 1" },
  { value: "address.address2", label: "Address 2" },
  { value: "address.apartment", label: "Apartment" },
  { value: "address.city", label: "City" },
  { value: "address.state", label: "State" },
  { value: "address.country", label: "Country" },
  { value: "address.zipcode", label: "Zipcode" },
  { value: "branch.code", label: "Branch code" },
  { value: "branch.id", label: "Branch ID" },
  { value: "id", label: "ID" },
  { value: "oldID", label: "Old ID" },
];

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

  return {
    id: "",
    oldID: 0,
    name: "",
    customerType: null,
    phone1: "",
    phone2: "",
    active: true,
    branch,
    address: createEmptyCustomerCoreAddress("US"),
    createdByID: null,
    createdAt: "",
    updatedAt: "",
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

  return { field, operator, value: normalizedValue };
}

export function getCustomerSearchSortField(field: CustomerSearchField): string {
  switch (field) {
    case "oldID":
      return "oldID";
    case "phone1":
      return "phone1";
    case "phone2":
      return "phone2";
    case "active":
      return "active";
    case "customerType":
      return "customerType";
    case "branch.code":
      return "branch.code";
    case "branch.id":
      return "branch.id";
    case "id":
      return "id";
    default:
      return field;
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

export function getCustomerAddresses(customer: Pick<Customer, "id" | "address">): CustomerAddress[] {
  const { address } = customer;
  const hasAddress = [
    address.address1,
    address.address2,
    address.apartment,
    address.city,
    address.state,
    address.zipcode,
    address.country,
  ].some((value) => value.trim());

  if (!hasAddress) return [];

  return [
    {
      id: `${customer.id}-address`,
      streetAddress: address.address1,
      apt: address.apartment || address.address2 || undefined,
      crossStreet: address.address2 || undefined,
      city: address.city,
      state: address.state || undefined,
      provinceCountry: address.country || undefined,
      zipCode: address.zipcode || undefined,
      isPrimary: true,
    },
  ];
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    id: customer.id,
    oldID: customer.oldID,
    name: customer.name,
    customerType: customer.customerType,
    phone1: customer.phone1,
    phone2: customer.phone2,
    active: customer.active,
    branch: { ...customer.branch, address: { ...customer.branch.address } },
    address: { ...customer.address },
    createdByID: customer.createdByID,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
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
