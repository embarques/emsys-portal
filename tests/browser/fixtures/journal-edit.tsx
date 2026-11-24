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
  async function save(direct: boolean, overrides: Partial<DailyIncomeJournal> = {}, canUpdate = true) {
    const journal = {...(direct ? {...base,incomeStatementId:9,reconciliationStatus:"OUTSTANDING" as const,clearanceStatus:"OUTSTANDING" as const,allowedActions:{edit:true}} : base),...overrides};
    try {
      const result = await workflow.save({ journal,statement,canUpdate,values:{transactionType:"SALES",amount:Number(amount),paymentMethodName:"CASH",autoClear:true,autoReconcile:true,clearPaymentOnSave:true} as DailyIncomeJournalValues });
      setOutcome(result ? `saved:${result.id}` : "cancelled");
    } catch { setOutcome("blocked"); }
  }
  return <>
    <label>Amount<input value={amount} onChange={event=>setAmount(event.target.value)} /></label>
    <button onClick={()=>void save(false)}>Edit protected</button>
    <button onClick={()=>void save(true)}>Edit outstanding</button>
    <button onClick={()=>void save(true,{reconciliationStatus:"RECONCILED",allowedActions:{edit:true,correct:true}})}>Edit reconciled</button>
    <button onClick={()=>void save(true,{clearanceStatus:"CLEARED",allowedActions:{edit:true,correct:true}})}>Edit cleared</button>
    <button onClick={()=>void save(true,{incomeStatementId:8,allowedActions:{edit:true,correct:true}})}>Edit historical</button>
    <button onClick={()=>void save(true,{reconciliationStatus:undefined,allowedActions:{edit:true,correct:true}})}>Edit incomplete</button>
    <button onClick={()=>void save(true,{pendingChange:true,allowedActions:{edit:true,correct:true}})}>Edit pending change</button>
    <button onClick={()=>void save(true,{version:1.5,allowedActions:{edit:true,correct:true}})}>Edit invalid version</button>
    <button onClick={()=>void save(true,{},false)}>Edit without permission</button>
    <button onClick={()=>void save(false,{allowedActions:{edit:true,correct:false}})}>Edit without correction grant</button>
    <p role="status">{outcome}</p>
    <JournalCorrectionDialog workflow={workflow} />
    <JournalLifecycleActions journal={base} variant="toolbar" />
    <JournalLifecycleActions journal={{...base,id:"voidable",reconciliationStatus:"OUTSTANDING",allowedActions:{void:true,reverse:true}}} variant="toolbar" />
  </>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><Fixture /></QueryClientProvider>);
