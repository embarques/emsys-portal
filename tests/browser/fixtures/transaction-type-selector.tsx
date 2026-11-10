import React from "react";
import { createRoot } from "react-dom/client";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";

createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-4xl p-4">
    <TransactionTypeSelector
      value={location.hash.includes("expense") ? "EXPENSE" : null}
      appearance={location.hash.includes("phone") ? "phone" : "default"}
      inventoryPaymentEnabled={!location.hash.includes("restricted")}
      loanIssueEnabled={!location.hash.includes("restricted")}
      loanPaymentEnabled={!location.hash.includes("restricted")}
      onChange={(type) => { document.getElementById("selection")!.textContent = type; }}
    />
    <output id="selection" />
  </main>,
);
