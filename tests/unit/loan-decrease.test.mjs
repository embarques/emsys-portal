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
const t=key=>key;
const values={employeeId:7,employeeName:"Ana",loanId:"42",amount:10,transactionDate:"2026-11-20",referenceNumber:"FORGIVE-10",description:"Approved forgiveness"};
const journalId="650000000000000000000001";
const ack=()=>({success:true,data:{loan:{id:42,principalAmount:90,paidAmount:20,balance:70,employee:{id:7,name:"Ana"}},transaction:{id:8,type:"DECREASE",loanId:42,journalEntryId:journalId},journal:{id:journalId,transactionType:"LOAN-DECREASE",incomeStatement:{id:99}}}});

test("forgiveness sends no funding or payment fields, even from a stale shared form",async()=>{
 const calls=[];const api=loader({post:async(url,body)=>{calls.push({url,body});return ack();}})("src/lib/accounting/loans/api.ts");
 const result=await api.decreaseLoan("fixed-uuid",{...values,sourceAccountId:1,sourceAccountName:"Cash",sourceAccountType:"ASSET",paymentMethod:{name:"CASH"}});
 assert.deepEqual(calls,[{url:"/loans/42/decreases",body:{requestId:"fixed-uuid",employee:{id:7,name:"Ana"},amount:10,transactionDate:"2026-11-20",referenceNumber:"FORGIVE-10",description:"Approved forgiveness"}}]);
 assert.equal(result.loan.principalAmount,90);assert.equal(result.loan.paidAmount,20);assert.equal(result.loan.balance,70);assert.equal(result.incomeStatementId,99);
});

test("forgiveness validates positive cents and the open balance without requiring a funding account",()=>{
 const {createLoanDecreaseSchema}=loader()("src/lib/accounting/loans/schemas.ts");
 const schema=createLoanDecreaseSchema(t,80);const input={...values,sourceAccountId:0};
 assert.equal(schema.safeParse(input).success,true);
 for(const amount of [0,-1,0.001,0.000001,10.001,80.01,Infinity,NaN,1e12+1])assert.equal(schema.safeParse({...input,amount}).success,false,String(amount));
 assert.equal(schema.safeParse({...input,amount:80}).success,true);
 assert.equal(createLoanDecreaseSchema(t,0).safeParse(input).success,false);
});

function sessionFixture(post){let n=0;const load=loader({post});return load("src/lib/accounting/loans/loan-decrease-session.ts").createLoanDecreaseSession(undefined,()=>`uuid-${++n}`);}
test("an uncertain forgiveness retains its UUID and frozen payload; completed entries get a new UUID",async()=>{
 let fail=true;const calls=[];const submit=sessionFixture(async(url,body)=>{calls.push(structuredClone({url,body}));if(fail){fail=false;throw Error("Response lost");}return ack();});
 const draft={...values};await assert.rejects(submit("company-a:actor-a",draft),/Response lost/);draft.amount=50;
 await submit("company-a:actor-a",{...values});assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].body.amount,10);
 await submit("company-a:actor-a",values);assert.notEqual(calls[1].body.requestId,calls[2].body.requestId);
});
test("concurrent identical forgiveness shares one command",async()=>{
 let finish;const waiting=new Promise(r=>finish=r);let calls=0;const submit=sessionFixture(async()=>{calls++;await waiting;return ack();});
 const first=submit("company:actor",values);const second=submit("company:actor",{...values});assert.equal(calls,1);finish();assert.deepEqual(await first,await second);
});
test("uncertain forgiveness commands are isolated by company, actor, loan, and payload",async()=>{
 const calls=[];const submit=sessionFixture(async(_url,body)=>{calls.push(structuredClone(body));throw Error("Uncertain");});
 for(const [scope,input]of [["a:actor",values],["b:actor",values],["a:other",values],["a:actor",{...values,loanId:"99"}],["a:actor",{...values,amount:20}]])await assert.rejects(submit(scope,input),/Uncertain/);
 assert.equal(new Set(calls.map(c=>c.requestId)).size,5);await assert.rejects(submit("a:actor",values));assert.deepEqual(calls[0],calls.at(-1));
});
test("missing or mismatched financial acknowledgments never clear the retry identity",async()=>{
 for(const alter of [a=>{a.data.loan.id=99},a=>{delete a.data.journal},a=>{a.data.transaction.type="PAYMENT"},a=>{a.data.journal.transactionType="LOAN-PAYMENT"},a=>{a.data.transaction.journalEntryId="wrong"},a=>{a.data.journal.incomeStatement.id=0}]){
  const calls=[];const submit=sessionFixture(async(_url,body)=>{calls.push(structuredClone(body));const a=ack();alter(a);return a;});
  await assert.rejects(submit("scope",values));await assert.rejects(submit("scope",values));assert.deepEqual(calls[0],calls[1]);
 }
});
test("principal forgiveness remains separate from payment history and keeps its adjustment account",async()=>{
 const api=loader({get:async()=>({data:[{id:9,loanId:42,type:"DECREASE",amount:10,adjustmentAccount:{id:4000000005,name:"LOAN PRINCIPAL REDUCTIONS",type:"EXPENSE"}},{id:8,loanId:42,type:"PAYMENT",amount:20,assetAccount:{id:1,name:"Cash",type:"ASSET"}}]})})("src/lib/accounting/loans/api.ts");
 const rows=await api.fetchLoanTransactions("42");assert.equal(rows[0].type,"DECREASE");assert.equal(rows[0].adjustmentAccount.id,4000000005);assert.equal(rows[0].assetAccount,undefined);assert.equal(rows[1].type,"PAYMENT");
});
