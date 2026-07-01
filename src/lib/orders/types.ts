import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import type { Customer, CustomerAddress, CustomerPhone } from "@/lib/customers/types";
import { REQUIRED_PHONE_DIGITS, isCompletePhoneNumber } from "@/lib/phones/phones";
import { normalizeStoredPhone } from "@/lib/utils/phone";
import { createRecordId } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
import { ORDER_TABLE_FILTER_FIELDS } from "@/lib/orders/filter-fields";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import type { User } from "@/lib/users/types";

export type PickupBranch = {
  id: number;
  name: string;
  code: string;
};

export type PickupSector = {
  id: number;
  name: string;
};

export type PickupComment = {
  purpose: string;
  unit: string;
  quantity: number;
  description: string;
};

/** EMSYS pickup record from GET /pickups. */
export type Order = {
  id: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  completed: boolean;
  user: User | null;
  branch: PickupBranch;
  employee: Employee | null;
  sender: Customer;
  receiver: Customer | null;
  purpose: string;
  comments: PickupComment[];
  sector: PickupSector | null;
  routeId?: string;
  routeName?: string;
};

export const ORDER_COMMENT_PURPOSES = [
  { value: "PAYMENT", label: "Payment" },
  { value: "ESTIMATE", label: "Estimate" },
  { value: "TAKE", label: "Take" },
  { value: "PICKUP", label: "Pickup" },
  { value: "OTHER", label: "Other" },
] as const;

export type OrderCommentPurpose = (typeof ORDER_COMMENT_PURPOSES)[number]["value"];

export const ORDER_COMMENT_ITEM_TYPES = [
  { value: "box", label: "Box" },
  { value: "barrel", label: "Barrel" },
  { value: "tape", label: "Tape" },
  { value: "other", label: "Other" },
] as const;

export type OrderCommentItemType = (typeof ORDER_COMMENT_ITEM_TYPES)[number]["value"];

const ITEM_PURPOSES = new Set<string>(["TAKE", "PICKUP"]);
const KNOWN_ITEM_VALUES = new Set<string>(["box", "barrel", "tape"]);

/** Map any stored/legacy comment purpose keyword onto a canonical dropdown value. */
const COMMENT_PURPOSE_BY_KEYWORD: Record<string, OrderCommentPurpose> = {
  PAYMENT: "PAYMENT",
  ESTIMATE: "ESTIMATE",
  TAKE: "TAKE",
  PICKUP: "PICKUP",
  OTHER: "OTHER",
  COMMENT: "OTHER",
};

/** TAKE and PICKUP describe a physical item; other purposes only carry free-text comments. */
export function orderCommentPurposeRequiresItem(purpose: string): boolean {
  return ITEM_PURPOSES.has(purpose.trim().toUpperCase());
}

/** Normalize an incoming comment purpose (e.g. legacy lowercase "comment") to a dropdown value. */
export function normalizeOrderCommentPurpose(purpose: string): OrderCommentPurpose | "" {
  const keyword = purpose.trim().toUpperCase();
  if (!keyword) return "";
  return COMMENT_PURPOSE_BY_KEYWORD[keyword] ?? "OTHER";
}

/** Wire value for a comment purpose: the backend stores free-text comments as lowercase "comment". */
export function toApiCommentPurpose(purpose: string): string {
  const keyword = purpose.trim().toUpperCase();
  if (!keyword) return "";
  if (keyword === "OTHER" || keyword === "COMMENT") return "comment";
  return keyword.toLowerCase();
}

export type OrderCommentFormValues = {
  purpose: string;
  itemType: OrderCommentItemType | "";
  customItem: string;
  quantity: string;
  description: string;
};

export type OrderFormValues = {
  id: number;
  date: string;
  completed: boolean;
  purpose: string;
  branchId: number;
  senderId: string;
  receiverId: string;
  sender: Customer | null;
  receiver: Customer | null;
  employeeId: number | "";
  sectorId: number | "";
  comments: OrderCommentFormValues[];
};

export type OrderFormSubmitResult = {
  error: string | null;
};

export type OrderBranchFilter = number | "all";

export type OrderCompletedFilter = boolean | "all";

export type OrderSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type OrderSearchField =
  | "id"
  | "date"
  | "completed"
  | "purpose"
  | "sender.name"
  | "sender.phone1"
  | "receiver.name"
  | "receiver.phone1"
  | "sector.id"
  | "branch.id"
  | "employee.id"
  | "createdBy.name";

export type OrderSearchFilter = ApiListTextSearch;

export type OrderFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

export type OrderListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: OrderSearchFilter;
  filterRows?: TableFilterRowState[];
};

/** Optional sort for pickups list/search when explicitly requested. */
export const DEFAULT_ORDER_LIST_SORT = "date:desc" as const;

export const DEFAULT_ORDER_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: DEFAULT_ORDER_LIST_SORT,
} as const satisfies Pick<OrderListParams, "page" | "limit" | "sort">;

export const ORDER_SEARCH_FIELDS: { value: OrderSearchField; label: string }[] = [
  { value: "id", label: "Order ID" },
  { value: "date", label: "date" },
  { value: "completed", label: "completed" },
  { value: "purpose", label: "purpose" },
  { value: "sender.name", label: "sender.name" },
  { value: "sender.phone1", label: "sender.phone1" },
  { value: "receiver.name", label: "receiver.name" },
  { value: "receiver.phone1", label: "receiver.phone1" },
  { value: "sector.id", label: "sector.id" },
  { value: "branch.id", label: "branch.id" },
  { value: "employee.id", label: "employee.id" },
  { value: "createdBy.name", label: "createdBy.name" },
];

export function getOrderRecordId(order: Pick<Order, "id">): string {
  return String(order.id);
}

export function getOrderSearchOperatorsForField(field: OrderSearchField): OrderSearchOperator[] {
  if (
    field === "completed" ||
    field === "id" ||
    field === "sector.id" ||
    field === "branch.id" ||
    field === "employee.id"
  ) {
    return ["eq", "neq"];
  }

  if (field === "date") {
    return ["eq", "neq", "contains"];
  }

  return ["contains", "startsWith", "eq", "neq"];
}

export function getDefaultOrderSearchOperator(field: OrderSearchField): OrderSearchOperator {
  return getOrderSearchOperatorsForField(field)[0];
}

export function createOrderSearchFilter(value: string): OrderSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildOrderListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): OrderListParams {
  const params: OrderListParams = {
    page: input.page,
    limit: input.limit ?? DEFAULT_ORDER_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_ORDER_LIST_PARAMS.sort,
  };

  const search = createOrderSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) =>
    isCompleteFilterRow(row, ORDER_TABLE_FILTER_FIELDS),
  );
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function createEmptyOrderComment(): OrderCommentFormValues {
  return {
    purpose: "",
    itemType: "",
    customItem: "",
    quantity: "",
    description: "",
  };
}

/** Resolve the unit string sent to the API from the comment's item selection. */
export function resolveOrderCommentUnit(comment: OrderCommentFormValues): string {
  if (!orderCommentPurposeRequiresItem(comment.purpose)) return "";
  if (comment.itemType === "other") return comment.customItem.trim();
  return comment.itemType;
}

/** "OTHER" comments are stored as the legacy "COMMENT" purpose keyword. */
function orderCommentPurposeKeyword(purpose: string): string {
  const keyword = purpose.trim().toUpperCase();
  if (!keyword) return "";
  return keyword === "OTHER" ? "COMMENT" : keyword;
}

/**
 * Build the order-level purpose string from its comments.
 * Each unique comment purpose contributes a keyword in first-seen order,
 * e.g. take 1 box + pickup 3 barrels => "TAKE, PICKUP".
 */
export function deriveOrderPurpose(comments: OrderCommentFormValues[]): string {
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const comment of comments) {
    const keyword = orderCommentPurposeKeyword(comment.purpose);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    keywords.push(keyword);
  }

  return keywords.join(", ");
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyOrderForm(): OrderFormValues {
  return {
    id: 0,
    date: todayDateInputValue(),
    completed: false,
    purpose: "",
    branchId: 1,
    senderId: "",
    receiverId: "",
    sender: null,
    receiver: null,
    employeeId: "",
    sectorId: "",
    comments: [],
  };
}

export function resetOrderFormForNextEntry(previous: OrderFormValues): OrderFormValues {
  const empty = createEmptyOrderForm();

  return {
    ...empty,
    date: previous.date,
    branchId: previous.branchId,
    employeeId: previous.employeeId,
    sectorId: previous.sectorId,
  };
}

export function orderCommentToFormValues(comment: PickupComment): OrderCommentFormValues {
  const unit = comment.unit.trim();
  const requiresItem = orderCommentPurposeRequiresItem(comment.purpose);

  let itemType: OrderCommentItemType | "" = "";
  let customItem = "";

  if (requiresItem && unit) {
    if (KNOWN_ITEM_VALUES.has(unit.toLowerCase())) {
      itemType = unit.toLowerCase() as OrderCommentItemType;
    } else {
      itemType = "other";
      customItem = unit;
    }
  }

  return {
    purpose: normalizeOrderCommentPurpose(comment.purpose),
    itemType,
    customItem,
    quantity: comment.quantity > 0 ? String(comment.quantity) : "",
    description: comment.description,
  };
}

export function orderToFormValues(order: Order): OrderFormValues {
  return {
    id: order.id,
    date: order.date.slice(0, 10),
    completed: order.completed,
    purpose: order.purpose,
    branchId: order.branch.id,
    senderId: order.sender.id,
    receiverId: order.receiver?.id ?? "",
    sender: order.sender,
    receiver: order.receiver,
    employeeId: order.employee?.id ?? "",
    sectorId: order.sector?.id ?? "",
    comments: order.comments.map(orderCommentToFormValues),
  };
}

// --- Legacy party types used by invoices ---

export type OrderBranch = "usa" | "dr";

export type OrderParty = {
  id: string;
  clientId?: string;
  name: string;
  documentId?: string;
  email?: string;
  phones: CustomerPhone[];
  addresses: CustomerAddress[];
  orderAddressId: string;
};

export type OrderPartyPhoneFormValues = {
  id: string;
  number: string;
  label: string;
};

export type OrderPartyAddressFormValues = {
  id: string;
  streetAddress: string;
  apt: string;
  crossStreet: string;
  city: string;
  state: string;
  provinceCountry: string;
  zipCode: string;
};

export type OrderPartyFormValues = {
  id: string;
  clientId: string;
  name: string;
  documentId: string;
  email: string;
  phones: OrderPartyPhoneFormValues[];
  addresses: OrderPartyAddressFormValues[];
  orderAddressId: string;
};

export function createEmptyOrderPartyPhone(): OrderPartyPhoneFormValues {
  return { id: createRecordId(), number: "", label: "" };
}

export function createEmptyOrderPartyAddress(): OrderPartyAddressFormValues {
  return {
    id: createRecordId(),
    streetAddress: "",
    apt: "",
    crossStreet: "",
    city: "",
    state: "",
    provinceCountry: "",
    zipCode: "",
  };
}

export function createEmptyOrderParty(): OrderPartyFormValues {
  const address = createEmptyOrderPartyAddress();
  return {
    id: createRecordId(),
    clientId: "",
    name: "",
    documentId: "",
    email: "",
    phones: [createEmptyOrderPartyPhone()],
    addresses: [address],
    orderAddressId: address.id,
  };
}

function normalizePartyPhones(phones: OrderPartyPhoneFormValues[]): CustomerPhone[] {
  return phones
    .map((phone) => ({
      id: phone.id,
      number: normalizeStoredPhone(phone.number),
      label: phone.label.trim() || undefined,
    }))
    .filter((phone) => phone.number.length > 0);
}

function normalizePartyAddresses(addresses: OrderPartyAddressFormValues[]): CustomerAddress[] {
  return addresses
    .map((address) => ({
      id: address.id,
      streetAddress: address.streetAddress.trim(),
      apt: address.apt.trim() || undefined,
      crossStreet: address.crossStreet.trim() || undefined,
      city: address.city.trim(),
      state: address.state.trim() || undefined,
      provinceCountry: address.provinceCountry.trim() || undefined,
      zipCode: address.zipCode.trim() || undefined,
      isPrimary: false,
    }))
    .filter((address) => address.streetAddress || address.city);
}

export function normalizeOrderParty(values: OrderPartyFormValues, label: string): OrderParty {
  const phones = normalizePartyPhones(values.phones);
  const addresses = normalizePartyAddresses(values.addresses);

  if (!values.name.trim()) {
    throw new Error(`${label} name is required.`);
  }

  if (phones.length === 0) {
    throw new Error(`${label} must have at least one phone number.`);
  }

  if (phones.some((phone) => !isCompletePhoneNumber(phone.number))) {
    throw new Error(`${label} phone numbers must have ${REQUIRED_PHONE_DIGITS} digits.`);
  }

  if (addresses.length === 0) {
    throw new Error(`${label} must have at least one address with street and city.`);
  }

  const orderAddressId = addresses.some((address) => address.id === values.orderAddressId)
    ? values.orderAddressId
    : addresses[0].id;

  return {
    id: values.id,
    clientId: values.clientId.trim() || undefined,
    name: values.name.trim(),
    documentId: values.documentId.trim() || undefined,
    email: values.email.trim() || undefined,
    phones,
    addresses,
    orderAddressId,
  };
}

export function orderPartyToFormValues(party: OrderParty): OrderPartyFormValues {
  return {
    id: party.id,
    clientId: party.clientId ?? "",
    name: party.name,
    documentId: party.documentId ?? "",
    email: party.email ?? "",
    phones:
      party.phones.length > 0
        ? party.phones.map((phone) => ({
            id: phone.id,
            number: normalizeStoredPhone(phone.number),
            label: phone.label ?? "",
          }))
        : [createEmptyOrderPartyPhone()],
    addresses:
      party.addresses.length > 0
        ? party.addresses.map((address) => ({
            id: address.id,
            streetAddress: address.streetAddress,
            apt: address.apt ?? "",
            crossStreet: address.crossStreet ?? "",
            city: address.city,
            state: address.state ?? "",
            provinceCountry: address.provinceCountry ?? "",
            zipCode: address.zipCode ?? "",
          }))
        : (() => {
            const empty = createEmptyOrderPartyAddress();
            return [empty];
          })(),
    orderAddressId: party.orderAddressId,
  };
}

export function getOrderPartyAddress(party: OrderParty): CustomerAddress | undefined {
  return party.addresses.find((address) => address.id === party.orderAddressId) ?? party.addresses[0];
}
