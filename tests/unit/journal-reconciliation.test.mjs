import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
function loader(apiClient = {}) {
 const cache = new Map();
 function load(relative) {
  const filename = path.isAbsolute(relative) ? relative : path.join(root,relative);
  if(cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = {exports:{}}; cache.set(filename,loadedModule);
  const source = ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  function localRequire(id) {
   if(id === "@/lib/api/client") return {apiClient};
   if(id === "@/lib/api/axios") return {axiosInstance:{}};
   if(id.startsWith("@/") || id.startsWith(".")) {
    const file=id.startsWith("@/") ? path.join(root,"src",id.slice(2)) : path.resolve(path.dirname(filename),id);
    if(file.endsWith(".json")) return JSON.parse(fs.readFileSync(file,"utf8"));
    return load(fs.existsSync(file+".ts") ? file+".ts" : path.join(file,"index.ts"));
   }
   return require(id);
  }
  new Function("require","module","exports",source)(localRequire,loadedModule,loadedModule.exports);
  return loadedModule.exports;
 }
 return load;
}
const leaves = nodes => nodes.flatMap(node => "field" in node ? [node] : leaves(node.filters));
test("pending search is server paginated, all dates, with immutable Outstanding scope", () => {
 const {buildJournalSearchBody} = loader()("src/lib/accounting/daily-income/journal-search.ts");
 const body=buildJournalSearchBody({incomeStatementId:0,pending:true,page:3,limit:50});
 assert.equal(body.operator,"and");
 assert.deepEqual(body.pagination,{page:3,limit:50,offset:100});
 assert.deepEqual(leaves(body.filters),[{field:"reconciliationStatus",operator:"eq",value:"OUTSTANDING"}]);
});

test("clearance scope is independent of reconciliation and cannot be bypassed with user OR filters", () => {
 const {buildJournalSearchBody} = loader()("src/lib/accounting/daily-income/journal-search.ts");
 const body=buildJournalSearchBody({pendingClearance:true,page:2,limit:50,filterRows:[
  {id:"1",join:"or",field:"clearanceStatus",operator:"eq",value:"CLEARED"},
  {id:"2",join:"or",field:"reconciliationStatus",operator:"eq",value:"RECONCILED"},
 ]});
 assert.equal(body.operator,"and");
 const paths=[];
 function findScope(nodes,path) {
  for (const node of nodes) {
   if ("filters" in node) findScope(node.filters,[...path,node.operator]);
   else if(node.field==="clearanceStatus"&&node.value==="OUTSTANDING") paths.push(path);
  }
 }
 findScope(body.filters,[body.operator]);
 assert.equal(paths.length,1);
 assert.ok(paths[0].every(operator=>operator==="and"));
 assert.ok(!leaves(body.filters).some(f=>f.field==="incomeStatement.id"));
 assert.deepEqual(body.pagination,{page:2,limit:50,offset:50});
});

test("clearance action requires explicit server eligibility independently of reconciliation", () => {
 const {isJournalQueueActionable} = loader()("src/lib/accounting/daily-income/journal-queue.ts");
 const row={clearanceStatus:"OUTSTANDING",reconciliationStatus:"RECONCILED",allowedActions:{clear:true}};
 assert.equal(isJournalQueueActionable(row,"clearance"),true);
 assert.equal(isJournalQueueActionable(row,"reconciliation"),false);
 assert.equal(isJournalQueueActionable({...row,allowedActions:undefined},"clearance"),false);
 assert.equal(isJournalQueueActionable({...row,allowedActions:{clear:false}},"clearance"),false);
 assert.equal(isJournalQueueActionable({...row,clearanceStatus:"CLEARED"},"clearance"),false);
 assert.equal(isJournalQueueActionable({...row,clearanceStatus:"NOT_REQUIRED"},"clearance"),false);
 assert.equal(isJournalQueueActionable({...row,reversedAt:"2026-11-04"},"clearance"),false);
 assert.equal(isJournalQueueActionable({...row,reconciliationStatus:"OUTSTANDING",clearanceStatus:"CLEARED"},"reconciliation"),true);
});

test("queue block reasons explain why a row cannot be processed", () => {
 const {getJournalQueueBlockReason} = loader()("src/lib/accounting/daily-income/journal-queue.ts");
 const row={clearanceStatus:"OUTSTANDING",reconciliationStatus:"RECONCILED",allowedActions:{clear:true}};
 assert.equal(getJournalQueueBlockReason(row,"clearance"),null);
 assert.equal(getJournalQueueBlockReason({...row,allowedActions:undefined},"clearance"),"notAuthorized");
 assert.equal(getJournalQueueBlockReason({...row,allowedActions:{clear:false}},"clearance"),"notAuthorized");
 assert.equal(getJournalQueueBlockReason({...row,clearanceStatus:"CLEARED"},"clearance"),"notOutstanding");
 assert.equal(getJournalQueueBlockReason({...row,transactionStatus:"VOIDED"},"clearance"),"inactive");
 assert.equal(getJournalQueueBlockReason(row,"reconciliation"),"notOutstanding");
 assert.equal(getJournalQueueBlockReason({...row,reconciliationStatus:"OUTSTANDING"},"reconciliation"),"awaitingClearance");
 assert.equal(getJournalQueueBlockReason({...row,reconciliationStatus:"OUTSTANDING",clearanceStatus:"CLEARED"},"reconciliation"),null);
 assert.equal(getJournalQueueBlockReason({...row,reconciliationStatus:"OUTSTANDING",clearanceStatus:"NOT_REQUIRED"},"reconciliation"),null);
});

test("clearance fields and explicit false action grants survive journal normalization", async () => {
 const api=loader({post:async()=>({total:1,data:[{id:"id",transactionType:"PAYMENT",transactionAmount:80,clearanceStatus:"CLEARED",clearedAt:"2026-11-04T18:00:00Z",clearedBy:{id:1,name:"Admin"},allowedActions:{edit:false,clear:false},reconciliationStatus:"OUTSTANDING"}]})})("src/lib/accounting/daily-income/api.ts");
 const {items:[row]}=await api.fetchDailyIncomeJournals({pendingClearance:true,page:1,limit:50});
 assert.equal(row.clearanceStatus,"CLEARED");
 assert.equal(row.reconciliationStatus,"OUTSTANDING");
 assert.equal(row.allowedActions.edit,false);
 assert.equal(row.allowedActions.clear,false);
 assert.equal(row.clearedBy.name,"Admin");
});

test("voided entries keep NOT_REQUIRED for both clearance and reconciliation", async () => {
 const api=loader({post:async()=>({total:1,data:[{id:"id",transactionType:"PAYMENT",transactionAmount:80,transactionStatus:"VOIDED",clearanceStatus:"NOT_REQUIRED",reconciliationStatus:"NOT_REQUIRED"}]})})("src/lib/accounting/daily-income/api.ts");
 const {items:[row]}=await api.fetchDailyIncomeJournals({incomeStatementId:1,page:1,limit:50});
 assert.equal(row.clearanceStatus,"NOT_REQUIRED");
 assert.equal(row.reconciliationStatus,"NOT_REQUIRED");
});

test("clearance command and badge use their own endpoint and filter with a stable request ID", async () => {
 const calls=[];
 const api=loader({post:async(url,body)=>{calls.push([url,body]);return{data:[],total:3};}})("src/lib/accounting/daily-income/reconciliation-api.ts");
 const command={requestId:"stable-clearance-request",ids:["j1"]};
 await api.clearJournals(command); await api.clearJournals(command);
 assert.equal(await api.fetchOutstandingJournalCount(undefined,"clearance"),3);
 assert.deepEqual(calls.slice(0,2),[["/journals/clear",command],["/journals/clear",command]]);
 assert.deepEqual(calls[2][1].filters,[{field:"clearanceStatus",operator:"eq",value:"OUTSTANDING"}]);
 assert.equal(calls[2][1].pagination.limit,1);
});
test("daily filters preserve closeout, leading-zero check numbers and numeric coercion", () => {
 const {buildJournalSearchBody} = loader()("src/lib/accounting/daily-income/journal-search.ts");
 const body=buildJournalSearchBody({incomeStatementId:42,page:2,limit:50,filterRows:[
  {id:"1",join:"and",field:"paymentReference",operator:"startsWith",value:"000"},
  {id:"2",join:"or",field:"transactionAmount",operator:"gte",value:"25.5"},
  {id:"3",join:"and",field:"employee.id",operator:"eq",value:"73"},
  {id:"4",join:"and",field:"employee.id",operator:"startsWith",value:"007"},
 ]});
 const filters=leaves(body.filters);
 assert.ok(filters.some(f=>f.field==="incomeStatement.id"&&f.value===42));
 assert.ok(filters.some(f=>f.field==="paymentReference"&&f.value==="000"));
 assert.ok(filters.some(f=>f.field==="transactionAmount"&&f.value===25.5));
 assert.ok(filters.some(f=>f.field==="employee.id"&&f.operator==="eq"&&f.value===73));
 assert.ok(filters.some(f=>f.field==="employee.id"&&f.operator==="startsWith"&&f.value==="007"));
 assert.equal(body.operator,"and");
});
test("journal pages use requested server page rather than a 500-row browser slice", async () => {
 const calls=[];
 const api=loader({post:async(url,body)=>{calls.push([url,body]);return{total:1200,data:[{id:"id",transactionType:"PAYMENT",transactionAmount:25,reconciliationStatus:"OUTSTANDING",autoReconciled:false}]};}})("src/lib/accounting/daily-income/api.ts");
 const page=await api.fetchDailyIncomeJournals({incomeStatementId:42,page:4,limit:50});
 assert.equal(calls.length,1);
 assert.equal(calls[0][1].pagination.page,4);
 assert.equal(calls[0][1].pagination.limit,50);
 assert.equal(page.items.length,1);
 assert.equal(page.total,1200);
 assert.equal(page.items[0].reconciliationStatus,"OUTSTANDING");
});
test("summary, selection and reconciliation use canonical journal endpoints", async () => {
 const calls=[];
 const api=loader({post:async(url,body)=>{calls.push([url,body]);return{data:[],total:7};}})("src/lib/accounting/daily-income/reconciliation-api.ts");
 await api.fetchJournalSummary({ids:["one","two"]});
 const command={requestId:"6f1c2a0e-6c55-4c1e-9a3e-2d1f0b7c9e11",ids:["one","two"]};
 await api.reconcileJournals(command); await api.reconcileJournals(command);
 assert.equal(await api.fetchOutstandingJournalCount(),7);
 assert.deepEqual(calls.slice(0,3),[["/journals/summary",{ids:["one","two"]}],["/journals/reconcile",command],["/journals/reconcile",command]]);
 assert.equal(calls[3][1].pagination.limit,1);
 assert.deepEqual(calls[3][1].filters,[{field:"reconciliationStatus",operator:"eq",value:"OUTSTANDING"}]);
});
test("auto approval uses only the explicit journal permission for every transaction",()=>{
 const {getAutoClearPermission,isAutoClearEligible}=loader()("src/lib/accounting/daily-income/auto-clear.ts");
 for(const transactionType of ["INITIAL-PAYMENT","PAYMENT","SALES","EXPENSE","DISCOUNT","SURCHARGE","TRANSFER","INVENTORY","LOAN"]) {
  assert.equal(isAutoClearEligible({transactionType,amount:0,paymentMethodName:"CASH"}),true);
  assert.deepEqual(getAutoClearPermission("CASH"),{name:"canReconcileJournal",resourceType:"journal"});
 }
});

test("financial auto-clear uses the explicit clearance permission, independently of reconciliation", () => {
 const {getPaymentClearancePermission,isBankInvoicePayment}=loader()("src/lib/accounting/daily-income/auto-clear.ts");
 assert.deepEqual(getPaymentClearancePermission(),{name:"canClearJournal",resourceType:"journal"});
 assert.equal(isBankInvoicePayment({transactionType:"PAYMENT",paymentMethodName:"ZELLE"}),true);
 assert.equal(isBankInvoicePayment({transactionType:"INITIAL-PAYMENT",paymentMethodName:"CHECK"}),true);
 assert.equal(isBankInvoicePayment({transactionType:"PAYMENT",paymentMethodName:"CASH"}),false);
 assert.equal(isBankInvoicePayment({transactionType:"EXPENSE",paymentMethodName:"ZELLE"}),false);
});

test("bank invoice payments never auto-reconcile on save", () => {
 const {isAutoClearEligible}=loader()("src/lib/accounting/daily-income/auto-clear.ts");
 assert.equal(isAutoClearEligible({transactionType:"PAYMENT",paymentMethodName:"ZELLE",amount:20}),false);
 assert.equal(isAutoClearEligible({transactionType:"INITIAL-PAYMENT",paymentMethodName:"CHECK",amount:20}),false);
 assert.equal(isAutoClearEligible({transactionType:"PAYMENT",paymentMethodName:"CASH",amount:20}),true);
});

test("financial clearance stays off by default and follows creation only when explicitly requested", async () => {
 const {createJournalWithClearance}=loader()("src/lib/accounting/daily-income/create-journal-with-clearance.ts");
 const journal={id:"new-entry",clearanceStatus:"OUTSTANDING",reconciliationStatus:"OUTSTANDING"};
 const commands=[];
 const dependencies={canClear:true,canReconcile:true,newRequestId:()=>"fixed-request",create:async()=>{commands.push("create");return journal;},clear:async command=>{commands.push(["clear",command]);return {data:{cleared:["new-entry"],clearedAt:"2026-11-11T18:00:00Z"}};},reconcile:async command=>{commands.push(["reconcile",command]);return {data:{reconciled:["new-entry"],reconciledAt:"2026-11-11T18:00:01Z"}};}};
 const input={statement:{id:1},values:{transactionType:"PAYMENT",paymentMethodName:"ZELLE",amount:20,autoClear:true}};
 assert.equal(await createJournalWithClearance(input,dependencies),journal);
 assert.deepEqual(commands,["create"]);
 commands.length=0;
 const result=await createJournalWithClearance({...input,values:{...input.values,clearPaymentOnSave:true}},dependencies);
 assert.equal(result.clearanceStatus,"CLEARED");
 assert.equal(result.reconciliationStatus,"RECONCILED");
 assert.deepEqual(commands,["create",["clear",{requestId:"fixed-request",ids:["new-entry"]}],["reconcile",{requestId:"fixed-request",ids:["new-entry"]}]]);
});

test("bank payments reconcile only after a confirmed clearance", async () => {
 const {createJournalWithClearance}=loader()("src/lib/accounting/daily-income/create-journal-with-clearance.ts");
 const journal={id:"entry",clearanceStatus:"OUTSTANDING",reconciliationStatus:"OUTSTANDING"};
 const input={statement:{id:1},values:{transactionType:"PAYMENT",paymentMethodName:"ZELLE",amount:20,clearPaymentOnSave:true}};
 let reconciles=0;
 const base={canClear:true,canReconcile:true,newRequestId:()=>"id",create:async()=>journal,reconcile:async()=>{reconciles++;return {data:{reconciled:["entry"],reconciledAt:"t"}};}};
 const unconfirmed=await createJournalWithClearance(input,{...base,clear:async()=>({data:{cleared:[],clearedAt:"t"}})});
 assert.equal(unconfirmed.reconciliationStatus,"OUTSTANDING");
 assert.equal(reconciles,0);
 const withoutGrant=await createJournalWithClearance(input,{...base,canReconcile:false,clear:async()=>({data:{cleared:["entry"],clearedAt:"t"}})});
 assert.equal(withoutGrant.clearanceStatus,"CLEARED");
 assert.equal(withoutGrant.reconciliationStatus,"OUTSTANDING");
 assert.equal(reconciles,0);
 const failed=await createJournalWithClearance(input,{...base,clear:async()=>({data:{cleared:["entry"],clearedAt:"t"}}),reconcile:async()=>{throw new Error("Network failure");}});
 assert.equal(failed.clearanceStatus,"CLEARED");
 assert.equal(failed.reconciliationStatus,"OUTSTANDING");
});

test("clearance failure keeps the saved journal and never retries creation", async () => {
 const {createJournalWithClearance}=loader()("src/lib/accounting/daily-income/create-journal-with-clearance.ts");
 let creates=0, clears=0;
 const journal={id:"saved-entry",clearanceStatus:"OUTSTANDING"};
 const input={statement:{id:1},values:{transactionType:"PAYMENT",paymentMethodName:"ZELLE",amount:20,clearPaymentOnSave:true}};
 const dependencies={canClear:true,canReconcile:true,newRequestId:()=>"fixed-request",create:async()=>{creates++;return journal;},clear:async()=>{clears++;throw new Error("Network failure");},reconcile:async()=>{throw new Error("Must not reconcile an uncleared payment");}};
 assert.equal(await createJournalWithClearance(input,dependencies),journal);
 assert.equal(creates,1);
 assert.equal(clears,1);
 await assert.rejects(createJournalWithClearance(input,{...dependencies,canClear:false}),/permission/);
 assert.equal(creates,1);
 await assert.rejects(createJournalWithClearance(input,{...dependencies,create:async()=>{throw new Error("Create failed");}}),/Create failed/);
 assert.equal(clears,1);
});

test("bank income and expenses clear instead of auto-reconciling on creation", async () => {
 const {isBankTransaction,isAutoClearEligible}=loader()("src/lib/accounting/daily-income/auto-clear.ts");
 const {createJournalWithClearance}=loader()("src/lib/accounting/daily-income/create-journal-with-clearance.ts");
 for (const transactionType of ["SALES","EXPENSE"]) {
  for (const paymentMethodName of ["ZELLE","CHECK","DEPOSIT","WIRE","DEBIT-CARD","CREDIT-CARD"]) {
   assert.equal(isBankTransaction({transactionType,paymentMethodName}),true);
   assert.equal(isAutoClearEligible({transactionType,paymentMethodName,amount:20}),false);
  }
  assert.equal(isAutoClearEligible({transactionType,paymentMethodName:"CASH",amount:20}),true);
  const calls=[];
  const journal={id:"bank-entry",clearanceStatus:"OUTSTANDING",reconciliationStatus:"OUTSTANDING"};
  const dependencies={canClear:true,canReconcile:true,newRequestId:()=>"id",create:async()=>{calls.push("create");return journal;},clear:async()=>{calls.push("clear");return {data:{cleared:[journal.id],clearedAt:"t"}};},reconcile:async()=>{calls.push("reconcile");return {data:{reconciled:[journal.id],reconciledAt:"t"}};}};
  const input={statement:{id:1},values:{transactionType,paymentMethodName:"ZELLE",amount:20}};
  await createJournalWithClearance(input,dependencies);
  assert.deepEqual(calls,["create"]);
  calls.length=0;
  const cleared=await createJournalWithClearance({...input,values:{...input.values,clearPaymentOnSave:true}},dependencies);
  assert.deepEqual(calls,["create","clear","reconcile"]);
  assert.equal(cleared.clearanceStatus,"CLEARED");
 }
});
