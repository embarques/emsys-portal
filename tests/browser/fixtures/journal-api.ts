type TestWindow = Window & {journalCalls: Array<{url:string;body:Record<string,unknown>}>;failApproval?:boolean;approved?:string[]};
const state = () => window as unknown as TestWindow;
const rows = [
 {id:"650000000000000000000001",refNumber:"TXN-A1",transactionType:"PAYMENT",transactionAmount:25,currency:"USD",paymentMethod:{name:"CASH"},reconciliationStatus:"OUTSTANDING"},
 {id:"650000000000000000000002",refNumber:"TXN-B1",transactionType:"PAYMENT",transactionAmount:15,currency:"USD",paymentMethod:{name:"CHECK"},reconciliationStatus:"OUTSTANDING"},
 {id:"650000000000000000000003",refNumber:"TXN-A2",transactionType:"EXPENSE",transactionAmount:5,currency:"USD",paymentMethod:{name:"CASH"},reconciliationStatus:"OUTSTANDING"},
];
export const apiClient = {get: async () => ({data: []}), post: async (url: string, body: Record<string,unknown>) => {
 const current=state();
 current.journalCalls ??= [];
 current.journalCalls.push({url,body});
 if(url.endsWith("/reconcile")) {
  if(current.failApproval) {current.failApproval=false;throw new Error("temporary approval failure");}
  current.approved=body.ids as string[];
  return {success:true,data:{reconciled:body.ids,reconciledAt:new Date().toISOString()}};
 }
 if(url.endsWith("/summary")) {
  const selected = body.ids as string[] | undefined;
  const included=rows.filter(row => (!selected || selected.includes(row.id)) && !current.approved?.includes(row.id));
  const income=included.filter(row=>row.transactionType==="PAYMENT").reduce((sum,row)=>sum+row.transactionAmount,0);
  const expenses=included.filter(row=>row.transactionType==="EXPENSE").reduce((sum,row)=>sum+row.transactionAmount,0);
  return {data:[{currency:"USD",income,expenses,net:income-expenses,count:included.length}]};
 }
 const page=(body.pagination as {page:number})?.page ?? 1;
 return {data: (page===1 ? rows.slice(0,2) : rows.slice(2)).filter(row=>!current.approved?.includes(row.id)),total:current.approved ? 1 : 51};
}};
