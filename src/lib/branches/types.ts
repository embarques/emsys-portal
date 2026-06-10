import type { ApiListSortInput } from "@/lib/api/list-query";
import { normalizeStoredPhone } from "@/lib/utils/phone";

export type BranchAddress = {
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  country: string;
  state: string;
  zipcode: string;
};

export type BranchSettings = {
  defaultLabelStatus: number;
  imageResampleBy: number;
  invoiceCreatedThruIncomeStatement: boolean;
  labelPrefix: string;
  printLabelCount: boolean;
  roundDecimalPlaces: number;
  s3BucketFolder: string;
  s3BucketName: string;
  s3Profile: string;
  s3ShareLinkExpireMinutes: number;
};

export type Branch = {
  id: number;
  name: string;
  code: string;
  type: string;
  phone1: string;
  phone2: string;
  logo: string;
  disclaimer: string;
  created: string;
  address: BranchAddress;
  settings: BranchSettings;
};

export type BranchFormValues = {
  id: number;
  name: string;
  code: string;
  type: string;
  phone1: string;
  phone2: string;
  logo: string;
  disclaimer: string;
  created: string;
  address: BranchAddress;
  settings: BranchSettings;
};

export type BranchSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type BranchSearchField =
  | "id"
  | "name"
  | "code"
  | "type"
  | "phone1"
  | "phone2"
  | "disclaimer"
  | "logo"
  | "address.address1"
  | "address.address2"
  | "address.apartment"
  | "address.city"
  | "address.state"
  | "address.country"
  | "address.zipcode"
  | "settings.labelPrefix";

export type BranchSearchFilter = {
  field: BranchSearchField;
  operator: BranchSearchOperator;
  value: string;
};

export type BranchFilterState = {
  query: string;
  searchField: BranchSearchField;
  searchOperator: BranchSearchOperator;
  type: string;
};

export type BranchListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: BranchSearchFilter;
  type?: string;
};

/** GET /branches?page=1&limit=40&offset=0&sort=name:asc */
export const DEFAULT_BRANCH_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "name:asc",
} as const satisfies Pick<BranchListParams, "page" | "limit" | "sort">;

export const BRANCH_SEARCH_FIELDS: { value: BranchSearchField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "code", label: "Code" },
  { value: "type", label: "Type" },
  { value: "phone1", label: "Phone 1" },
  { value: "phone2", label: "Phone 2" },
  { value: "disclaimer", label: "Disclaimer" },
  { value: "address.city", label: "City" },
  { value: "address.state", label: "State" },
  { value: "address.country", label: "Country" },
  { value: "settings.labelPrefix", label: "Label prefix" },
  { value: "id", label: "ID" },
];

export const BRANCH_SEARCH_OPERATORS: { value: BranchSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export function createEmptyBranchAddress(): BranchAddress {
  return {
    address1: "",
    address2: "",
    apartment: "",
    city: "",
    country: "",
    state: "",
    zipcode: "",
  };
}

export function createEmptyBranchSettings(): BranchSettings {
  return {
    defaultLabelStatus: 1,
    imageResampleBy: 0,
    invoiceCreatedThruIncomeStatement: false,
    labelPrefix: "",
    printLabelCount: false,
    roundDecimalPlaces: 2,
    s3BucketFolder: "",
    s3BucketName: "",
    s3Profile: "",
    s3ShareLinkExpireMinutes: 0,
  };
}

export function createEmptyBranchForm(): BranchFormValues {
  return {
    id: 0,
    name: "",
    code: "",
    type: "",
    phone1: "",
    phone2: "",
    logo: "",
    disclaimer: "",
    created: "",
    address: createEmptyBranchAddress(),
    settings: createEmptyBranchSettings(),
  };
}

export function createBranchSearchFilter(
  value: string,
  field: BranchSearchField = "name",
  operator: BranchSearchOperator = "startsWith",
): BranchSearchFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return { field, operator, value: trimmed };
}

export function branchToFormValues(branch: Branch): BranchFormValues {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    type: branch.type,
    phone1: normalizeStoredPhone(branch.phone1),
    phone2: normalizeStoredPhone(branch.phone2),
    logo: branch.logo,
    disclaimer: branch.disclaimer,
    created: branch.created,
    address: { ...branch.address },
    settings: { ...branch.settings },
  };
}
