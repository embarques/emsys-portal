import { createRoot } from "react-dom/client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoanIncreaseForm } from "@/components/accounting/loan-increase-form";
import { LoanViewSheet } from "@/components/accounting/loan-view-sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDecreaseLoan, useLoanTransactions } from "@/lib/accounting/loans/hooks";
import type { LoanDecreaseResult } from "@/lib/accounting/loans/types";
import { fixtureLoan } from "./loan-forgiveness-mocks";
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
const affected=["accounting","loan","42","company-a","actor-a",1];
const unrelated=["accounting","loan","99","company-a","actor-a",1];
const otherTenant=["accounting","loan","42","company-b","actor-a",1];
for(const key of [affected,unrelated,otherTenant,["accounting","income-statement-summary-total",99]])client.setQueryData(key,{});
Object.assign(window,{forgivenessCache:()=>({affected:client.getQueryState(affected)?.isInvalidated,unrelated:client.getQueryState(unrelated)?.isInvalidated,otherTenant:client.getQueryState(otherTenant)?.isInvalidated,summary:client.getQueryState(["accounting","income-statement-summary-total",99])?.isInvalidated})});
function Fixture(){
 const [result,setResult]=useState<LoanDecreaseResult|null>(null);
 const mutation=useDecreaseLoan();const history=useLoanTransactions("42",Boolean(result));
 if(result)return <LoanViewSheet loan={result.loan} open onOpenChange={()=>{}} payments={history.data??[]} paymentsLoading={history.isLoading}/>;
 return <LoanIncreaseForm mode="decrease" employees={[{id:7,name:"Ana"}]} assetAccounts={[]} initialLoan={fixtureLoan} pending={mutation.isPending} onCancel={()=>{}} onSubmit={async values=>{setResult(await mutation.mutateAsync(values));}}/>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><TooltipProvider><Fixture/></TooltipProvider></QueryClientProvider>);
