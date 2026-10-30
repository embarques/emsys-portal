import { Provider } from "react-redux";
import { store } from "@/lib/store/store";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FinancialActivityWorkspace } from "@/components/accounting/financial-activity-workspace";
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(<Provider store={store}><QueryClientProvider client={client}><FinancialActivityWorkspace /></QueryClientProvider></Provider>);
