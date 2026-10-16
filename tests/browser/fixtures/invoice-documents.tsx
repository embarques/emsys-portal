import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoiceDocumentsSection } from "@/components/invoices/invoice-documents-section";
import type { Invoice } from "@/lib/invoices/types";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Invoice INV-456</h1>
      <InvoiceDocumentsSection
        invoice={
          {
            invoiceId: "invoice",
            invoiceNumber: "INV-456",
            containerId: "123",
          } as Invoice
        }
      />
    </main>
  </QueryClientProvider>,
);
