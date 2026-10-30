import {createRoot} from "react-dom/client";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {JournalTransactionsTable} from "@/components/accounting/journal-transactions-table";
const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><JournalTransactionsTable pending/></QueryClientProvider>);
