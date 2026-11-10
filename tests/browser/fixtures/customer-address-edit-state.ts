import type { Customer } from "@/lib/customers/types";
import { createEmptyCustomerCoreAddress } from "@/lib/customers/types";

declare global {
  interface Window {
    customerAddressFixture: {
      denied: boolean;
      verified: boolean;
      receiver: boolean;
      empty: boolean;
      locale: "en" | "es";
      rowClicks: number;
      rowDoubleClicks: number;
      opened: Array<{ entityId: string; focusAddressIndex?: number; customerFormIntent?: string }>;
    };
  }
}

const blank = { ...createEmptyCustomerCoreAddress("", false), country: "" };
export function customer(): Customer {
  const state = window.customerAddressFixture;
  return {
    id: "customer-1", oldID: null, name: "Fixture Client", customerType: state.receiver ? 2 : 1,
    email: "", phones: [], active: true, IDNumber: "", notes: "", accountBalance: 0,
    branch: { id: 1, name: "USA", code: "NY" }, receivers: [],
    createdAt: "", updatedAt: "", createdBy: null, updatedBy: null,
    addresses: state.empty ? [blank] : [
      blank,
      { ...blank, address1: "1 Other Street", label: "Other", city: "Bronx" },
      { ...blank, address1: "2 Primary Street", label: "Primary", city: "Bronx", isPrimary: true,
        verification: state.verified ? { isVerified: true, verifiedAt: "2026-11-10" } : null },
    ],
  };
}

export function useAuth() { return { hasPermission: () => !window.customerAddressFixture.denied }; }
export function useCustomer() { return { data: customer(), isFetching: false }; }
export function useWorkspaceTabs() {
  return { openFormTab: (params: Window["customerAddressFixture"]["opened"][number]) => window.customerAddressFixture.opened.push(params) };
}
export function useFeedback() { return { notifySuccess: () => {}, notifyError: () => {} }; }
