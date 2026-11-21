import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJournalEdit } from "@/lib/accounting/daily-income/use-journal-edit";
import { JournalCorrectionDialog } from "@/components/accounting/journal-correction-dialog";
import { JournalLifecycleActions } from "@/components/accounting/journal-lifecycle-actions";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement } from "@/lib/accounting/daily-income/types";

const statement = { id:9,date:"2026-11-21",currency:"USD",rate:1,status:"OPEN" } as DailyIncomeStatement;
const base: DailyIncomeJournal = {date:"2026-11-20",refNumber:"TXN-1",currency:"USD",rate:1,id:"original",version:7,transactionType:"SALES",description:"Original",amount:150,accounts:[],incomeStatementId:8,reconciliationStatus:"RECONCILED",allowedActions:{correct:true,reverse:true}};
function Fixture() {
  const workflow = useJournalEdit();
  const [amount,setAmount] = useState("105");
  const [outcome,setOutcome] = useState("");
  async function save(direct: boolean) {
    const journal = direct ? {...base,incomeStatementId:9,reconciliationStatus:"OUTSTANDING" as const,allowedActions:{edit:true}} : base;
    const result = await workflow.save({ journal,statement,canUpdate:true,values:{transactionType:"SALES",amount:Number(amount),paymentMethodName:"CASH",autoClear:true,autoReconcile:true,clearPaymentOnSave:true} as DailyIncomeJournalValues });
    setOutcome(result ? `saved:${result.id}` : "cancelled");
  }
  return <>
    <label>Amount<input value={amount} onChange={event=>setAmount(event.target.value)} /></label>
    <button onClick={()=>void save(false)}>Edit protected</button>
    <button onClick={()=>void save(true)}>Edit outstanding</button>
    <p role="status">{outcome}</p>
    <JournalCorrectionDialog workflow={workflow} />
    <JournalLifecycleActions journal={base} variant="toolbar" />
    <JournalLifecycleActions journal={{...base,id:"voidable",reconciliationStatus:"OUTSTANDING",allowedActions:{void:true,reverse:true}}} variant="toolbar" />
  </>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><Fixture /></QueryClientProvider>);
