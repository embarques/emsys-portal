import {createRoot} from "react-dom/client";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {JournalTransactionsTable} from "@/components/accounting/journal-transactions-table";
const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
const dailyIncome = (window as unknown as {dailyIncome?: boolean}).dailyIncome;
const clearance = (window as unknown as {pendingClearance?: boolean}).pendingClearance;
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><JournalTransactionsTable
 pending={!dailyIncome && !clearance}
 clearance={clearance}
 incomeStatementId={dailyIncome ? 32690 : undefined}
 headerActions={dailyIncome ? <button>Add transaction</button> : undefined}
 onView={dailyIncome ? row => {document.body.dataset.viewedJournal = row.id;} : undefined}
 onPrintReceipt={dailyIncome ? row => {document.body.dataset.receiptJournal = row.id;} : undefined}
/></QueryClientProvider>);
