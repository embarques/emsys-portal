import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PendingInventoryDispatchesPanel } from "@/components/accounting/pending-inventory-dispatches-panel";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><div style={{ padding: 24 }}><PendingInventoryDispatchesPanel /></div></QueryClientProvider>,
);
