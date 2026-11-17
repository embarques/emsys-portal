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
const t = key => key;
const values = {employeeId:7,employeeName:"Ana",loanId:"42",sourceAccountId:3,sourceAccountName:"Cash on hand",sourceAccountType:"ASSET",amount:200,transactionDate:"2026-11-11",referenceNumber:"",description:"Extra"};
const requestId = "55c7647d-4a55-444d-81a8-c8076804af17";

test("additional loan amount posts to the loan's increase command with the source account", async () => {
 const calls=[];
 const api=loader({post:async(url,body)=>{calls.push([url,body]);return{data:{loan:{id:"42",principalAmount:700,paidAmount:100,balance:600,employee:{id:7,name:"Ana"}}}};}})("src/lib/accounting/loans/api.ts");
 const loan=await api.increaseLoan(requestId, values);
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],"/loans/42/increases");
 assert.deepEqual(calls[0][1],{requestId,employee:{id:7,name:"Ana"},sourceAccount:{id:3,name:"Cash on hand",type:"ASSET"},amount:200,transactionDate:"2026-11-11",referenceNumber:"",description:"Extra"});
 assert.equal(loan.balance,600);
});

test("additional loan amount requires a loan and a positive amount", () => {
 const {createLoanIncreaseSchema}=loader()("src/lib/accounting/loans/schemas.ts");
 const schema=createLoanIncreaseSchema(t);
 const valid={employeeId:7,loanId:"42",sourceAccountId:3,amount:200,transactionDate:"2026-11-11",referenceNumber:"",description:""};
 assert.equal(schema.safeParse(valid).success,true);
 const missingLoan=schema.safeParse({...valid,loanId:""});
 assert.equal(missingLoan.error.issues[0].message,"accounting.loans.validation.loanRequired");
 const zero=schema.safeParse({...valid,amount:0});
 assert.equal(zero.error.issues[0].message,"accounting.loans.validation.increaseAmountPositive");
});

test("principal decrease cannot exceed the open loan balance", () => {
 const {createLoanDecreaseSchema,createLoanPaymentSchema}=loader()("src/lib/accounting/loans/schemas.ts");
 const decrease=createLoanDecreaseSchema(t,100);
 const valid={employeeId:7,loanId:"42",sourceAccountId:3,amount:100,transactionDate:"2026-11-11",referenceNumber:"",description:""};
 assert.equal(decrease.safeParse(valid).success,true);
 assert.equal(decrease.safeParse({...valid,amount:100.01}).success,false);
 assert.equal(
  decrease.safeParse({...valid,amount:100.01}).error.issues[0].message,
  "accounting.loans.validation.decreaseExceedsBalance",
 );
 const payment=createLoanPaymentSchema(t,40);
 const pay={employeeId:7,loanId:"42",receivedAccountId:3,amount:40,transactionDate:"2026-11-11",referenceNumber:"",description:""};
 assert.equal(payment.safeParse(pay).success,true);
 assert.equal(payment.safeParse({...pay,loanId:""}).error.issues[0].message,"accounting.loans.validation.loanRequired");
 assert.equal(payment.safeParse({...pay,amount:40.01}).error.issues[0].message,"accounting.loans.validation.paymentExceedsBalance");
});

test("the increase entry stays hidden until the increase lifecycle is verified", () => {
 const previous=process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED;
 try {
  delete process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED;
  const loans=()=>loader()("src/lib/accounting/daily-income/transaction-type-config.ts").buildTransactionEntryGroups(t).find(group=>group.id==="loans").options.map(option=>option.value);
  assert.deepEqual(loans(),["LOAN-ISSUE","LOAN-DECREASE","LOAN-PAYMENT"]);
  process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED="true";
  assert.deepEqual(loans(),["LOAN-ISSUE","LOAN-INCREASE","LOAN-DECREASE","LOAN-PAYMENT"]);
 } finally {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED; else process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED=previous;
 }
});

function sessionFixture(post) {
 const load = loader({post});
 const {createLoanIncreaseSession} = load("src/lib/accounting/loans/loan-increase-session.ts");
 let sequence = 0;
 return createLoanIncreaseSession(undefined, () => `55c7647d-4a55-444d-81a8-${String(++sequence).padStart(12,"0")}`);
}

test("lost increase response retries the same command, then a new completed entry gets a new UUID", async () => {
 const calls=[], receipts=new Set();
 let lost=true;
 const submit=sessionFixture(async(url,body)=>{
  calls.push({url,body:structuredClone(body)});
  receipts.add(body.requestId);
  if(lost){lost=false;throw new Error("Response lost after commit");}
  return {data:{loan:{id:42,balance:600}}};
 });
 await assert.rejects(submit("company-a:actor-a",values),/Response lost/);
 await submit("company-a:actor-a",{...values});
 assert.deepEqual(calls[0],calls[1]);
 assert.equal(receipts.size,1);
 await submit("company-a:actor-a",values);
 assert.notEqual(calls[2].body.requestId,calls[0].body.requestId);
});

test("concurrent identical submissions share one frozen wire request", async () => {
 let finish;
 const waiting=new Promise(resolve=>{finish=resolve;});
 const calls=[];
 const submit=sessionFixture(async(url,body)=>{calls.push({url,body:structuredClone(body)});await waiting;return{data:{loan:{id:42}}};});
 const draft={...values};
 const first=submit("company:actor",draft);
 const second=submit("company:actor",{...draft});
 draft.amount=999;
 draft.loanId="99";
 assert.equal(calls.length,1);
 assert.equal(calls[0].body.amount,200);
 finish();
 const results=await Promise.all([first,second]);
 assert.deepEqual(results[0],results[1]);
});

test("uncertain commands are isolated by scope, loan and every submitted field", async () => {
 const calls=[];
 const submit=sessionFixture(async(url,body)=>{calls.push({url,body:structuredClone(body)});throw Error("Uncertain");});
 for(const [scope,input] of [
  ["company-a:actor-a",values], ["company-b:actor-a",values], ["company-a:actor-b",values],
  ...["loanId","employeeId","employeeName","sourceAccountId","sourceAccountName","sourceAccountType","amount","transactionDate","referenceNumber","description"].map(field=>[
   "company-a:actor-a",{...values,[field]:typeof values[field]==="number"?values[field]+1:`${values[field]}-changed`},
  ]),
 ]) await assert.rejects(submit(scope,input),/Uncertain/);
 assert.equal(new Set(calls.map(call=>call.body.requestId)).size,calls.length);
 await assert.rejects(submit("company-a:actor-a",values),/Uncertain/);
 assert.deepEqual(calls.at(-1),calls[0],"returning to the original draft retains its uncertain identity");
});

test("missing or mismatched loan success stays uncertain and reuses the UUID", async () => {
 for(const data of [{},{loan:{id:99}}]) {
  const calls=[];
  const submit=sessionFixture(async(_url,body)=>{calls.push(structuredClone(body));return{success:true,data};});
  await assert.rejects(submit("company:actor",values));
  await assert.rejects(submit("company:actor",values));
  assert.deepEqual(calls[0],calls[1]);
 }
});
