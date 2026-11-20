import { useQuery } from "@tanstack/react-query";
export { useQuery as useWorkspaceQuery };
import type { Loan } from "@/lib/accounting/loans/types";
type FixtureState = Window & {forgivenessCalls?:Array<{url:string;body:Record<string,unknown>}>;forgivenessFailure?:boolean;forgivenessSaved?:boolean};
const state=()=>window as unknown as FixtureState;
export const fixtureLoan:Loan={id:"42",employee:{id:7,name:"Ana"},principalAmount:100,paidAmount:20,balance:80,status:"ACTIVE",description:"Employee loan",referenceNumber:"L-42",openedAt:"2026-11-01",createdAt:"2026-11-01",lastActivityAt:"2026-11-01",loanAccount:{id:8,name:"Employee loans",type:"LOAN"}};
export function useAuth(){return {companyId:"company-a",user:{uid:"actor-a"},roleId:1,hasPermission:()=>true};}
export const store={getState:()=>({auth:{companyId:"company-a"}})};
export function normalizeApiError(error:Error){return {message:error.message};}
const journalId="650000000000000000000001";
export const apiClient={
 post:async(url:string,body:Record<string,unknown>)=>{
  const current=state();(current.forgivenessCalls??=[]).push({url,body});
  if(url.endsWith("/decreases")){
   if(current.forgivenessFailure){current.forgivenessFailure=false;throw Error("Temporary forgiveness failure");}
   current.forgivenessSaved=true;
   return {success:true,data:{loan:{...fixtureLoan,principalAmount:90,balance:70},transaction:{id:9,type:"DECREASE",loanId:42,journalEntryId:journalId},journal:{id:journalId,transactionType:"LOAN-DECREASE",incomeStatement:{id:99}}}};
  }
  return {data:[current.forgivenessSaved?{...fixtureLoan,principalAmount:90,balance:70}:fixtureLoan],total:1};
 },
 get:async(url:string)=>url.endsWith("/transactions")?{data:[{id:8,loanId:42,type:"PAYMENT",amount:20,assetAccount:{id:1,name:"Cash",type:"ASSET"},transactionDate:"2026-11-01"},{id:9,loanId:42,type:"DECREASE",amount:10,adjustmentAccount:{id:4000000005,name:"Loan principal reductions",type:"EXPENSE"},transactionDate:"2026-11-20",description:"Approved forgiveness"}]}:{data:fixtureLoan},
};

export function useAppSelector<T>(selector:(state:{auth:{companyId:string;idToken:string}})=>T):T{return selector({auth:{companyId:"company-a",idToken:"fixture-token"}});}
export function useAppDispatch(){return ()=>undefined;}
