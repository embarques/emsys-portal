import type { Customer } from "@/lib/customers/types";
import { createEmptyCustomerForm, createEmptyCustomerCoreAddress, CUSTOMER_TYPE_SENDER } from "@/lib/customers/types";

export const customer = {
  ...createEmptyCustomerForm(),
  id: "sender", name: "Test sender", customerType: CUSTOMER_TYPE_SENDER, active: true,
  phones: [], addresses: [{ ...createEmptyCustomerCoreAddress("US", true), id: "a1", address1: "123 Main St", city: "New York", state: "NY", zipcode: "10001", country: "US", isPrimary: true }],
} as Customer;
export function useCustomerPicker() { return { data: { items: [customer] }, isFetching: false }; }
export function useCustomerAutocomplete(query: string) {
  return { data: query === "missing" ? [] : [{ customer }], isFetching: false };
}
export function useCustomerDetailsBatch() {}
export function useCustomer() { return { data: customer, isFetching: false }; }
export function useEnsureCustomerDetail() { return async () => customer; }
