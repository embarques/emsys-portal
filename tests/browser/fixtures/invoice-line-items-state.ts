import type { Invoice } from "@/lib/invoices/types";

declare global {
  interface Window {
    invoiceLineItemsFixture: {
      requests: number;
      failNext: boolean;
      empty: boolean;
      denied: boolean;
      companyId: string;
      rowClicks: number;
      rowDoubleClicks: number;
      locale: "en" | "es";
      changeCompany: () => void;
    };
  }
}

export const invoice: Invoice = {
  invoiceId: "650000000000000000000001", invoiceNumber: "INV-123", date: "2026-11-10", containerId: "1", paymentLocation: "NY",
  sender: { id: "sender", name: "Fixture Sender", phones: [], addresses: [], orderAddressId: "" }, receiver: null,
  lineItems: [
    { id: "item-1", itemName: "Box with household goods", description: "Kitchen supplies and clothing", quantity: 2, labelCount: 2, unitPrice: 25, lineTotal: 50,
      barcodes: [{ id: "piece-1", number: "INV-123-1", statusName: "EN TRANSITO", containerName: "67-26" }] },
    { id: "item-2", itemName: "Small parcel", quantity: 1, labelCount: 1, unitPrice: 10.5, lineTotal: 10.5 },
  ],
  comments: [], activity: [], payments: [], discount: 0, amountPaid: 0, createdAt: "", createdBy: "", updatedAt: "",
};

export function useAuth() {
  const state = window.invoiceLineItemsFixture;
  return {
    isAuthenticated: true, companyId: state.companyId, user: { uid: "fixture-user" }, email: "fixture@example.invalid", roleId: 1,
    permissionsLoading: false, permissions: state.denied ? [] : [{ name: "canViewInvoice", resourceType: "invoice" }],
    hasPermission: () => !state.denied,
  };
}

export async function fetchInvoiceById(id: string, signal?: AbortSignal): Promise<Invoice> {
  const state = window.invoiceLineItemsFixture;
  state.requests++;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 50);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
  if (state.failNext) { state.failNext = false; throw new Error("Fixture invoice unavailable"); }
  if (id !== invoice.invoiceId) throw new Error("Unexpected invoice");
  return { ...invoice, lineItems: state.empty ? [] : invoice.lineItems };
}
