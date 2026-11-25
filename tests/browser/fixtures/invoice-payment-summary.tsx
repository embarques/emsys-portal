import React from "react";
import { createRoot } from "react-dom/client";
import { InvoiceViewSheet } from "@/components/invoices/invoice-view-sheet";
import type { Invoice, InvoicePaymentSummary } from "@/lib/invoices/types";

declare global {
  interface Window {
    invoicePaymentSummaryFixture: {
      locale: "en" | "es";
      paymentSummary?: InvoicePaymentSummary;
      payment: number;
      balance: number;
      paidStatus: string;
      hasAccountingEntries?: boolean;
      canDelete?: boolean;
    };
  }
}

function Fixture() {
  const state = window.invoicePaymentSummaryFixture;
  const invoice = {
    invoiceId: "68f0000000000000000000a1",
    invoiceNumber: "INV-7001",
    date: "2026-11-20",
    containerId: "1",
    containerName: "Container A",
    paymentLocation: "usa",
    paidStatus: state.paidStatus,
    cost: 1000,
    discount: 0,
    amountPaid: state.payment,
    balance: state.balance,
    paymentSummary: state.paymentSummary,
    hasAccountingEntries: state.hasAccountingEntries,
    sender: { id: "1", name: "Sender Co", phones: [], addresses: [], orderAddressId: "" },
    receiver: null,
    lineItems: [],
    comments: [],
    activity: [],
    payments: [],
    createdAt: "2026-11-20T12:00:00Z",
    createdBy: "Clerk",
    updatedAt: "2026-11-20T12:00:00Z",
  } as unknown as Invoice;

  const noop = () => {};

  return (
    <InvoiceViewSheet
      invoice={invoice}
      open
      onOpenChange={noop}
      onEdit={noop}
      onDelete={noop}
      canDelete={state.canDelete ?? true}
      deleteBlocked={Boolean(state.hasAccountingEntries)}
      onManageItems={noop}
      onPrint={noop}
      onAddComment={noop}
    />
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
