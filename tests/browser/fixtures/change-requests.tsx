import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChangeRequestsWorkspace } from "@/components/change-requests/change-requests-workspace";
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><ChangeRequestsWorkspace /></QueryClientProvider>);
