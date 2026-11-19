import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { InvoicePaymentTransactionForm } from "@/components/invoices/invoice-payment-transaction-form";
import { createEmptyInvoiceForm, createEmptyInvoiceLineItem } from "@/lib/invoices/types";
import type { InvoicePaymentDraft } from "@/lib/invoices/invoice-daily-income-context";
import type { DailyIncomeStatement } from "@/lib/accounting/daily-income/types";

function Fixture() {
  const [visible, setVisible] = useState(true);
  const [employee, setEmployee] = useState("88");
  const [refresh, setRefresh] = useState(0);
  const draftRef = useRef<InvoicePaymentDraft | null>(null);
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const invoice = { ...createEmptyInvoiceForm(), invoiceNumber: "00042", pickupSource: "office" as const, pickupEmployeeId: employee, pickupEmployeeName: `Merchandise ${employee}`,
    lineItems: [{ ...createEmptyInvoiceLineItem(), itemName: "Box", quantity: "1", labelCount: "1", unitPrice: "100", lineTotal: "100" }] };
  return <main data-refresh={refresh}>
    <button type="button" onClick={() => setVisible((value) => !value)}>Toggle step</button>
    <button type="button" onClick={() => setEmployee("77")}>Change invoice party</button>
    <button type="button" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
    {visible ? <InvoicePaymentTransactionForm statement={{ id: 1, status: "OPEN", branch: { id: 1 }, currency: "USD", rate: 1 } as DailyIncomeStatement}
      invoice={invoice} draftRef={draftRef} submitRef={submitRef} onRegistered={() => {}} onSkip={() => {}} /> : null}
    <button type="button" onClick={() => void submitRef.current?.()}>Post</button>
    <output id="posted" /><output id="error" />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
