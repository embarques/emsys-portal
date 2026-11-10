type TestWindow = Window & {partialAcknowledgement?:boolean;journalCalls: Array<{url:string;body:Record<string,unknown>}>;failApproval?:boolean;approved?:string[];pendingClearance?:boolean;cleared?:string[];failClearance?:boolean};
const state = () => window as unknown as TestWindow;
const rows = [
 {id:"650000000000000000000001",refNumber:"TXN-A1",transactionType:"PAYMENT",transactionAmount:25,currency:"USD",paymentMethod:{name:"CASH"},reconciliationStatus:"OUTSTANDING",date:"2026-11-04",createdAt:"2026-11-04T17:26:16Z",invoice:{number:"INV-26-001475",cost:100,discount:20,balance:55}},
 {id:"650000000000000000000002",refNumber:"TXN-B1",transactionType:"PAYMENT",transactionAmount:15,currency:"USD",paymentMethod:{name:"CHECK"},reconciliationStatus:"OUTSTANDING"},
 {id:"650000000000000000000003",refNumber:"TXN-A2",transactionType:"EXPENSE",transactionAmount:5,currency:"USD",paymentMethod:{name:"CASH"},reconciliationStatus:"OUTSTANDING"},
];
const clearanceRows = rows.map((row,index) => ({...row,
 paymentMethod:{name:index === 1 ? "ZELLE" : "CHECK"},
 reconciliationStatus:index === 0 ? "RECONCILED" : "OUTSTANDING",
 clearanceStatus:"OUTSTANDING", allowedActions:{clear:index !== 1},
 ...(index === 0 ? {paymentReference:"004521"} : {}),
 incomeStatement:{id:32600,status:"CLOSED"},
}));
export const apiClient = {get: async () => ({data: []}), post: async (url: string, body: Record<string,unknown>) => {
 const current=state();
 current.journalCalls ??= [];
 current.journalCalls.push({url,body});
 const sourceRows = current.pendingClearance ? clearanceRows : rows;
 if(url.endsWith("/clear")) {
  if(current.failClearance) {current.failClearance=false;throw new Error("temporary clearance failure");}
  current.cleared=body.ids as string[];
  return {success:true,data:{cleared:body.ids,clearedAt:new Date().toISOString()}};
 }
 if(url.endsWith("/reconcile")) {
  if(current.failApproval) {current.failApproval=false;throw new Error("temporary approval failure");}
  if(current.partialAcknowledgement) {
   current.partialAcknowledgement=false;
   const first=(body.ids as string[]).slice(0,1);
   current.approved=first;
   return {success:true,data:{reconciled:first,reconciledAt:new Date().toISOString()}};
  }
  current.approved=body.ids as string[];
  return {success:true,data:{reconciled:body.ids,reconciledAt:new Date().toISOString()}};
 }
 if(url.endsWith("/summary")) {
  const selected = body.ids as string[] | undefined;
  const included=sourceRows.filter(row => (!selected || selected.includes(row.id)) && !current.approved?.includes(row.id));
  const income=included.filter(row=>row.transactionType==="PAYMENT").reduce((sum,row)=>sum+row.transactionAmount,0);
  const expenses=included.filter(row=>row.transactionType==="EXPENSE").reduce((sum,row)=>sum+row.transactionAmount,0);
  return {data:[{currency:"USD",income,expenses,net:income-expenses,count:included.length}]};
 }
 const page=(body.pagination as {page:number})?.page ?? 1;
 return {data: (page===1 ? sourceRows.slice(0,2) : sourceRows.slice(2)).filter(row=>!current.approved?.includes(row.id)&&!current.cleared?.includes(row.id)),total:current.approved || current.cleared ? 1 : 51};
}};
