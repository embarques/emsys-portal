import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReservedInvoicesWorkspace } from "@/components/invoices/reserved-invoices-workspace";
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><ReservedInvoicesWorkspace /></QueryClientProvider>);
