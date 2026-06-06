import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { CustomerAddress, CustomerPhone } from "@/lib/customers/types";
import { createRecordId } from "@/lib/customers/types";

export type OrderBranch = "usa" | "dr";

export type OrderCommentPurpose =
  | "make_estimate"
  | "collect_payment"
  | "take_box"
  | "take_barrel"
  | "take_tape"
  | "take_other"
  | "pickup_box"
  | "pickup_barrel"
  | "pickup_other"
  | "general_comment";

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

export type OrderCommentBase = {
  id: string;
};

export type OrderComment =
  | (OrderCommentBase & { purpose: "make_estimate"; note?: string })
  | (OrderCommentBase & { purpose: "collect_payment"; note?: string })
  | (OrderCommentBase & { purpose: "take_box"; quantity: number })
  | (OrderCommentBase & { purpose: "take_barrel"; quantity: number })
  | (OrderCommentBase & { purpose: "take_tape"; quantity: number })
  | (OrderCommentBase & { purpose: "take_other"; quantity: number; description?: string })
  | (OrderCommentBase & { purpose: "pickup_box"; quantity: number })
  | (OrderCommentBase & { purpose: "pickup_barrel"; quantity: number })
  | (OrderCommentBase & { purpose: "pickup_other"; quantity: number; description?: string })
  | (OrderCommentBase & { purpose: "general_comment"; text: string });

export type Order = {
  orderId: string;
  sender: OrderParty;
  receivers: OrderParty[];
  date: string;
  containerId: string;
  pending: OrderBranch;
  branch: OrderBranch;
  routeId: string;
  routeAssignmentId: string;
  comments: OrderComment[];
  completed: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
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

export type OrderCommentFormValues = {
  id: string;
  purpose: OrderCommentPurpose;
  note: string;
  quantity: string;
  description: string;
  text: string;
};

export type OrderFormValues = {
  orderId: string;
  sender: OrderPartyFormValues;
  receivers: OrderPartyFormValues[];
  date: string;
  containerId: string;
  pending: OrderBranch;
  branch: OrderBranch;
  routeId: string;
  routeAssignmentId: string;
  comments: OrderCommentFormValues[];
  completed: boolean;
  createdBy: string;
};

export type OrderFormSubmitResult = {
  error: string | null;
};

export type OrderFilterState = {
  query: string;
  branch: OrderBranch | "all";
};

export const ORDER_BRANCHES: { value: OrderBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const ORDER_COMMENT_PURPOSES: {
  value: OrderCommentPurpose;
  label: string;
  requiresQuantity: boolean;
  requiresDescription: boolean;
  requiresText: boolean;
  allowsNote: boolean;
}[] = [
  { value: "make_estimate", label: "Make an estimate", requiresQuantity: false, requiresDescription: false, requiresText: false, allowsNote: true },
  { value: "collect_payment", label: "Collect payment", requiresQuantity: false, requiresDescription: false, requiresText: false, allowsNote: true },
  { value: "take_box", label: "Take box", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "take_barrel", label: "Take barrel", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "take_tape", label: "Take tape", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "take_other", label: "Take other", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "pickup_box", label: "Pickup box", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "pickup_barrel", label: "Pickup barrel", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "pickup_other", label: "Pickup other", requiresQuantity: true, requiresDescription: false, requiresText: false, allowsNote: false },
  { value: "general_comment", label: "Comment only", requiresQuantity: false, requiresDescription: false, requiresText: true, allowsNote: false },
];

export function createOrderId(): string {
  return createRecordId();
}

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

export function createEmptyOrderComment(): OrderCommentFormValues {
  return {
    id: createRecordId(),
    purpose: "make_estimate",
    note: "",
    quantity: "1",
    description: "",
    text: "",
  };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyOrderForm(createdBy = DEFAULT_CREATED_BY): OrderFormValues {
  return {
    orderId: createOrderId(),
    sender: createEmptyOrderParty(),
    receivers: [],
    date: todayDateInputValue(),
    containerId: "",
    pending: "usa",
    branch: "usa",
    routeId: "",
    routeAssignmentId: "",
    comments: [],
    completed: false,
    createdBy,
  };
}

export function resetOrderFormForNextEntry(previous: OrderFormValues): OrderFormValues {
  const empty = createEmptyOrderForm(previous.createdBy);

  return {
    ...empty,
    date: previous.date,
    containerId: previous.containerId,
    pending: previous.pending,
  };
}

function normalizePartyPhones(phones: OrderPartyPhoneFormValues[]): CustomerPhone[] {
  return phones
    .map((phone) => ({
      id: phone.id,
      number: phone.number.trim(),
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

function normalizeOrderComment(values: OrderCommentFormValues): OrderComment {
  const meta = ORDER_COMMENT_PURPOSES.find((entry) => entry.value === values.purpose)!;

  if (meta.requiresText && !values.text.trim()) {
    throw new Error("Comment text is required for comment-only entries.");
  }

  if (meta.requiresQuantity) {
    const quantity = Number(values.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Quantity is required for "${meta.label}".`);
    }

    if (values.purpose === "take_other" || values.purpose === "pickup_other") {
      return {
        id: values.id,
        purpose: values.purpose,
        quantity,
        description: values.description.trim() || undefined,
      };
    }

    return { id: values.id, purpose: values.purpose, quantity } as OrderComment;
  }

  if (values.purpose === "general_comment") {
    return { id: values.id, purpose: values.purpose, text: values.text.trim() };
  }

  return {
    id: values.id,
    purpose: values.purpose,
    note: values.note.trim() || undefined,
  } as OrderComment;
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
            number: phone.number,
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

export function orderCommentToFormValues(comment: OrderComment): OrderCommentFormValues {
  const base = {
    id: comment.id,
    purpose: comment.purpose,
    note: "",
    quantity: "1",
    description: "",
    text: "",
  };

  switch (comment.purpose) {
    case "make_estimate":
    case "collect_payment":
      return { ...base, note: comment.note ?? "" };
    case "take_box":
    case "take_barrel":
    case "take_tape":
    case "pickup_box":
    case "pickup_barrel":
      return { ...base, quantity: String(comment.quantity) };
    case "take_other":
    case "pickup_other":
      return { ...base, quantity: String(comment.quantity), description: comment.description ?? "" };
    case "general_comment":
      return { ...base, text: comment.text };
    default:
      return base;
  }
}

export function orderToFormValues(order: Order): OrderFormValues {
  return {
    orderId: order.orderId,
    sender: orderPartyToFormValues(order.sender),
    receivers: order.receivers.map(orderPartyToFormValues),
    date: order.date.slice(0, 10),
    containerId: order.containerId,
    pending: order.pending,
    branch: order.branch,
    routeId: order.routeId,
    routeAssignmentId: order.routeAssignmentId,
    comments: order.comments.map(orderCommentToFormValues),
    completed: order.completed,
    createdBy: order.createdBy,
  };
}

export function formValuesToOrder(
  values: OrderFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): Order {
  if (!values.routeId) {
    throw new Error("A route is required.");
  }

  if (!values.routeAssignmentId) {
    throw new Error("A route assignment is required.");
  }

  if (!values.containerId) {
    throw new Error("A container is required.");
  }

  const sender = normalizeOrderParty(values.sender, "Sender");
  const receivers = values.receivers.map((receiver, index) =>
    normalizeOrderParty(receiver, `Receiver ${index + 1}`)
  );
  const comments = values.comments.map(normalizeOrderComment);

  return {
    orderId: values.orderId,
    sender,
    receivers,
    date: values.date,
    containerId: values.containerId,
    pending: values.pending,
    branch: values.branch,
    routeId: values.routeId,
    routeAssignmentId: values.routeAssignmentId,
    comments,
    completed: values.completed,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function getOrderPartyAddress(party: OrderParty): CustomerAddress | undefined {
  return party.addresses.find((address) => address.id === party.orderAddressId) ?? party.addresses[0];
}

export function ordersShareSender(a: OrderParty, b: OrderParty): boolean {
  if (a.clientId && b.clientId && a.clientId === b.clientId) return true;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

export function getSenderOrderHistory(orders: Order[], sender: OrderParty): Order[] {
  return orders
    .filter((order) => ordersShareSender(order.sender, sender))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
