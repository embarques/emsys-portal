import { createRoot } from "react-dom/client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const initialValues: DailyIncomeJournalValues = { transactionType: "SALES", amount: 25, accountId: 3, accountName: "Sales", refNumber: "", refNumberMode: "system", description: "Preserve this note", paymentMethodId: 1, paymentMethodName: "CASH" };
function Fixture() {
  const [attempts, setAttempts] = useState(0);
  const [saved, setSaved] = useState("");
  return <QueryClientProvider client={client}>
    <DailyIncomeTransactionForm quickEntry formId="transaction" transactionType="SALES" initialValues={initialValues} employees={[]} accounts={[{id:3,name:"Sales",displayName:"Sales",type:"REVENUE",description:"",systemAccount:false,branchAccount:false,default:false}]} bankAccounts={[]} invoices={[]} paymentMethods={[{id:1,name:"CASH"}]} statementBranchId={1} onSubmit={async values => {
      setAttempts(count=>count+1);
      if (attempts === 0) throw { isAxiosError: true, response: { status: 409, data: { data: { code: "CLOSEOUT_REQUIRED" } } } };
      setSaved(values.description);
    }}/>
    <button id="record" form="transaction" type="submit">Record transaction</button>
    <output id="attempts">{attempts}</output><output id="saved">{saved}</output>
  </QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
