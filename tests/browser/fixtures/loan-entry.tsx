import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoanEntryDialog } from "@/components/accounting/loan-entry-dialog";
import { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";
const branch = { id: 1, name: "New York", code: "NY" };
const account = { description: "", systemAccount: false, branchAccount: true, default: false, branch };
function Fixture() {
  const entry = useLoanEntry();
  return <>
    <button onClick={entry.openCreate}>Register new loan</button>
    <button onClick={entry.openPayment}>Register loan payment</button>
    <LoanEntryDialog entry={entry} employees={[{ id: 1, name: "Ana" }]} accounts={[
      { ...account, id: 2, name: "Employee loans", displayName: "Employee loans", type: "LOAN" },
      { ...account, id: 3, name: "Cash", displayName: "Cash", type: "ASSET" },
    ]} />
  </>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
