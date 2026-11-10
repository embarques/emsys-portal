import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoiceLineItemsCell } from "@/components/invoices/invoice-line-items-cell";
import { invoice } from "./invoice-line-items-state";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Fixture() {
  const [, render] = useState(0);
  useEffect(() => {
    window.invoiceLineItemsFixture.changeCompany = () => {
      window.invoiceLineItemsFixture.companyId = "other-company";
      render(value => value + 1);
    };
  }, []);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <table className="w-full"><tbody><tr
        onClick={() => window.invoiceLineItemsFixture.rowClicks++}
        onDoubleClick={() => window.invoiceLineItemsFixture.rowDoubleClicks++}
      ><td className="w-64 p-3"><InvoiceLineItemsCell invoice={invoice} /></td></tr></tbody></table>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
