import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import type { Customer, CustomerAddress, CustomerPhone } from "@/lib/customers/types";
import { normalizeStoredPhone } from "@/lib/utils/phone";
import { createRecordId } from "@/lib/customers/types";
import type { Employee } from "@/lib/employees/types";
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
  oldID: number;
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
};

export type OrderCommentFormValues = {
  purpose: string;
  unit: string;
  quantity: string;
  description: string;
};

export type OrderFormValues = {
  id: number;
  oldID: number;
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
  | "oldID"
  | "date"
  | "completed"
  | "purpose"
  | "sender.name"
  | "sender.phone1"
  | "sender.oldID"
  | "receiver.name"
  | "receiver.phone1"
  | "receiver.oldID"
  | "sector.id"
  | "branch.id"
  | "employee.id"
  | "user.id";

export type OrderSearchFilter = ApiListTextSearch;

export type OrderFilterState = {
  query: string;
  branch: OrderBranchFilter;
  completed: OrderCompletedFilter;
};

export type OrderListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: OrderSearchFilter;
  branch?: OrderBranchFilter;
  completed?: OrderCompletedFilter;
};

export const DEFAULT_ORDER_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "date:asc",
} as const satisfies Pick<OrderListParams, "page" | "limit" | "sort">;

export const ORDER_SEARCH_FIELDS: { value: OrderSearchField; label: string }[] = [
  { value: "id", label: "Order ID" },
  { value: "oldID", label: "oldID" },
  { value: "date", label: "date" },
  { value: "completed", label: "completed" },
  { value: "purpose", label: "purpose" },
  { value: "sender.name", label: "sender.name" },
  { value: "sender.phone1", label: "sender.phone1" },
  { value: "sender.oldID", label: "sender.oldID" },
  { value: "receiver.name", label: "receiver.name" },
  { value: "receiver.phone1", label: "receiver.phone1" },
  { value: "receiver.oldID", label: "receiver.oldID" },
  { value: "sector.id", label: "sector.id" },
  { value: "branch.id", label: "branch.id" },
  { value: "employee.id", label: "employee.id" },
  { value: "user.id", label: "user.id" },
];

export function getOrderRecordId(order: Pick<Order, "id">): string {
  return String(order.id);
}

export function getOrderSearchOperatorsForField(field: OrderSearchField): OrderSearchOperator[] {
  if (
    field === "completed" ||
    field === "id" ||
    field === "oldID" ||
    field === "sender.oldID" ||
    field === "receiver.oldID" ||
    field === "sector.id" ||
    field === "branch.id" ||
    field === "employee.id" ||
    field === "user.id"
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

export function createEmptyOrderComment(): OrderCommentFormValues {
  return {
    purpose: "",
    unit: "",
    quantity: "0",
    description: "",
  };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyOrderForm(): OrderFormValues {
  return {
    id: 0,
    oldID: 0,
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
  return {
    purpose: comment.purpose,
    unit: comment.unit,
    quantity: String(comment.quantity),
    description: comment.description,
  };
}

export function orderToFormValues(order: Order): OrderFormValues {
  return {
    id: order.id,
    oldID: order.oldID,
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

export function ordersShareSender(
  a: Pick<Customer, "id" | "name">,
  b: Pick<Customer, "id" | "name">,
): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

export function getSenderOrderHistory(
  orders: Order[],
  sender: Pick<Customer, "id" | "name">,
): Order[] {
  return orders
    .filter((order) => ordersShareSender(order.sender, sender))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
