import type { ApiSearchFilterNode } from "@/lib/api/search-query";
import { isApiSearchFilter } from "@/lib/api/search-query";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";

export const CUSTOMER_COUNTRY_FILTER_USA = "usa";
export const CUSTOMER_COUNTRY_FILTER_DO = "do";

export const CUSTOMER_ADDRESS_COUNTRY_FILTER_OPTIONS: TableFilterFieldOption[] = [
  { value: CUSTOMER_COUNTRY_FILTER_USA, label: "USA" },
  { value: CUSTOMER_COUNTRY_FILTER_DO, label: "Dominican Republic" },
];

export function isCustomerAddressCountryField(field: string): boolean {
  return field.trim() === "address.country";
}

function isDominicanRepublicPortalValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === CUSTOMER_COUNTRY_FILTER_DO ||
    normalized === "do" ||
    normalized === "dr" ||
    normalized === "dominican republic"
  );
}

/** Portal filter value → EMSYS API `address.country` search value. */
export function portalCustomerCountryToApiFilterValue(portalValue: string): string {
  return isDominicanRepublicPortalValue(portalValue) ? "Do" : "us";
}

function countryUsaSearchNode(): ApiSearchFilterNode {
  return { field: "address.country", operator: "eq", value: "us" };
}

function countryDoSearchNode(): ApiSearchFilterNode {
  return { field: "address.country", operator: "eq", value: "Do" };
}

/** Maps portal address.country filters to API-friendly operators/values. */
export function expandCustomerCountrySearchNode(node: ApiSearchFilterNode): ApiSearchFilterNode {
  if ("filters" in node) {
    return {
      ...node,
      filters: node.filters.map(expandCustomerCountrySearchNode),
    };
  }

  if (!isApiSearchFilter(node) || !isCustomerAddressCountryField(node.field)) {
    return node;
  }

  const isDo = isDominicanRepublicPortalValue(String(node.value));

  if (node.operator === "eq" && isDo) {
    return countryDoSearchNode();
  }

  if (node.operator === "eq" && !isDo) {
    return countryUsaSearchNode();
  }

  if (node.operator === "neq" && isDo) {
    return countryUsaSearchNode();
  }

  if (node.operator === "neq" && !isDo) {
    return countryDoSearchNode();
  }

  return {
    ...node,
    value: portalCustomerCountryToApiFilterValue(String(node.value)),
  };
}
