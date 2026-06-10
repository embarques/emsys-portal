import type { ApiSearchFilterNode } from "@/lib/api/search-query";
import { isApiSearchFilter } from "@/lib/api/search-query";

/** API wire values: 0 = Sender, 1 = Receiver. */
export const CUSTOMER_TYPE_SENDER = 0;
export const CUSTOMER_TYPE_RECEIVER = 1;

export function isCustomerTypeFilterActive(value: number | "all" | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isCustomerReceiverType(value: number | null | undefined): boolean {
  return value === CUSTOMER_TYPE_RECEIVER;
}

export function isCustomerSenderType(value: number | null | undefined): boolean {
  return value == null || value === CUSTOMER_TYPE_SENDER;
}

/** Form/filter default when API omits customerType — treat as sender (0). */
export function coerceCustomerTypeFromApi(value: number | string | null | undefined): number {
  if (value == null || value === "") {
    return CUSTOMER_TYPE_SENDER;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return CUSTOMER_TYPE_SENDER;
  }

  return parsed === CUSTOMER_TYPE_RECEIVER ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER;
}

/** Portal filter/form value → API query param / filter value (same 0/1 model). */
export function portalCustomerTypeToApiFilterValue(portalType: number): number {
  return coerceCustomerTypeFromApi(portalType);
}

/** Portal form value → API write payload value (same 0/1 model). */
export function portalCustomerTypeToApiWriteValue(portalType: number): number {
  return coerceCustomerTypeFromApi(portalType);
}

export function isCustomerTypeField(field: string): boolean {
  return field.trim() === "customerType";
}

export function customerTypeSenderSearchNode(): ApiSearchFilterNode {
  return {
    field: "customerType",
    operator: "eq",
    value: CUSTOMER_TYPE_SENDER,
  };
}

export function customerTypeReceiverSearchNode(): ApiSearchFilterNode {
  return {
    field: "customerType",
    operator: "eq",
    value: CUSTOMER_TYPE_RECEIVER,
  };
}

/** Maps portal customerType filters to API-friendly operators/values. */
export function expandCustomerTypeSearchNode(node: ApiSearchFilterNode): ApiSearchFilterNode {
  if ("filters" in node) {
    return {
      ...node,
      filters: node.filters.map(expandCustomerTypeSearchNode),
    };
  }

  if (!isApiSearchFilter(node) || !isCustomerTypeField(node.field)) {
    return node;
  }

  const parsed = typeof node.value === "number" ? node.value : Number(node.value);
  if (!Number.isFinite(parsed)) {
    return node;
  }

  const portalType = coerceCustomerTypeFromApi(parsed);

  if (node.operator === "eq" && portalType === CUSTOMER_TYPE_SENDER) {
    return customerTypeSenderSearchNode();
  }

  if (node.operator === "eq" && portalType === CUSTOMER_TYPE_RECEIVER) {
    return customerTypeReceiverSearchNode();
  }

  if (node.operator === "neq" && portalType === CUSTOMER_TYPE_SENDER) {
    return customerTypeReceiverSearchNode();
  }

  if (node.operator === "neq" && portalType === CUSTOMER_TYPE_RECEIVER) {
    return customerTypeSenderSearchNode();
  }

  return {
    ...node,
    value: portalCustomerTypeToApiFilterValue(portalType),
  };
}

export function toApiCustomerTypeChipFilter(value: number): ApiSearchFilterNode {
  return expandCustomerTypeSearchNode({
    field: "customerType",
    operator: "eq",
    value: coerceCustomerTypeFromApi(value),
  });
}

export function appendCustomerTypeFilterGroup(
  groups: { operator: "and" | "or"; filters: ApiSearchFilterNode[] }[],
  customerType: number,
): void {
  const node = toApiCustomerTypeChipFilter(customerType);
  groups.push({ operator: "and", filters: [node] });
}
