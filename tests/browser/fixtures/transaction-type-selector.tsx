import React, { useRef, useState } from "react";
import { FormBody, FormSection } from "@/components/forms/form-shell";
import { TransactionSectionNavigation } from "@/components/accounting/transaction-section-navigation";
import type { TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import { createRoot } from "react-dom/client";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import { useScrollFocusedSectionToTop } from "@/hooks/use-scroll-focused-section-to-top";

function InlineFixture() {
  const [type, setType] = useState<TransactionEntryCategory | null>(null);
  const [extra, setExtra] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useScrollFocusedSectionToTop(formRef, Boolean(type));
  return (
    <main style={{ height: 700 }} className="flex min-h-0 flex-col p-4">
      <TransactionTypeSelector value={type} onChange={setType} onGroupChange={() => setType(null)}>
        {type ? <div className="flex min-h-0 flex-1 flex-col">
          <button type="button" onClick={() => setType(null)}>Change transaction</button>
          <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); document.getElementById("selection")!.textContent = "submitted"; }}>
            <TransactionSectionNavigation formRef={formRef} title="New invoice" />
            <FormBody>
              {["Assignment", "Invoice details", "Invoice amount", "Payment & references", ...(extra ? ["Customers"] : [])].map((title) => (
                <FormSection key={title} title={title} variant="card"><div style={{ height: 256 }}><label>{title} field<input /></label>{title === "Invoice details" ? <label style={{ display: "block", marginTop: 160 }}>Invoice notes field<input /></label> : null}</div></FormSection>
              ))}
            </FormBody>
          </form>
          <button type="button" onClick={() => setExtra(!extra)}>Toggle customers</button>
        </div> : null}
      </TransactionTypeSelector>
      <output id="selection" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(location.hash.includes("inline") ? <InlineFixture /> : (
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
  </main>
));
