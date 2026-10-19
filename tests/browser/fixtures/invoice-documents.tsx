import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoiceDocumentsButton } from "@/components/invoices/invoice-documents-button";
import { InvoiceDocumentsSection } from "@/components/invoices/invoice-documents-section";
import type { Invoice } from "@/lib/invoices/types";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Invoice INV-456</h1>
      <InvoiceDocumentsButton
        invoice={{ invoiceId: "invoice", invoiceNumber: "INV-456" } as Invoice}
        selectedCount={
          (window as unknown as { multipleDocs?: boolean }).multipleDocs ? 2 : 1
        }
        onOpenMobile={() => {
          (window as unknown as { openedMobile?: boolean }).openedMobile = true;
        }}
      />
      <InvoiceDocumentsSection
        initialFiles={(window as unknown as { wizardUploads?: boolean }).wizardUploads
          ? [new File(["agreement"], "agreement.png", { type: "image/png" }), new File(["receipt"], "retry.pdf", { type: "application/pdf" })]
          : []}
        onUploadsComplete={() => {
          const state = window as unknown as { completedUploads?: number };
          state.completedUploads = (state.completedUploads ?? 0) + 1;
        }}
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
