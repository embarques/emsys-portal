import { useState } from "react";

const allowed = (name: string) => document.documentElement.dataset[name] !== "false";

export type LoanEntryKind = "issue" | "payment";

export function useLoanEntry() {
  const [kind, setKind] = useState<LoanEntryKind | null>(null);
  const permitted = allowed("loanAccess");
  return {
    kind, scope: "test", pending: false,
    close: () => setKind(null),
    submitCreate: async () => {}, submitPayment: async () => {},
    openCreate: permitted ? () => setKind("issue") : undefined,
    openPayment: permitted ? () => setKind("payment") : undefined,
  };
}

export function useInventoryPaymentEntryAccess() {
  return allowed("inventoryAccess");
}

export function useInventoryPaymentEntry() {
  return undefined;
}
