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

test("additional loan amount posts to the loan's increase command with the source account", async () => {
 const calls=[];
 const api=loader({post:async(url,body)=>{calls.push([url,body]);return{data:{loan:{id:"42",principalAmount:700,paidAmount:100,balance:600,employee:{id:7,name:"Ana"}}}};}})("src/lib/accounting/loans/api.ts");
 const loan=await api.increaseLoan({employeeId:7,employeeName:"Ana",loanId:"42",sourceAccountId:3,sourceAccountName:"Cash on hand",sourceAccountType:"ASSET",amount:200,transactionDate:"2026-11-11",referenceNumber:"",description:"Extra"});
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],"/loans/42/increases");
 assert.deepEqual(calls[0][1],{employee:{id:7,name:"Ana"},sourceAccount:{id:3,name:"Cash on hand",type:"ASSET"},amount:200,transactionDate:"2026-11-11",referenceNumber:"",description:"Extra"});
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

test("the entry stays hidden until the API ships its increase command", () => {
 const previous=process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED;
 try {
  delete process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED;
  const loans=()=>loader()("src/lib/accounting/daily-income/transaction-type-config.ts").buildTransactionEntryGroups(t).find(group=>group.id==="loans").options.map(option=>option.value);
  assert.deepEqual(loans(),["LOAN-ISSUE","LOAN-PAYMENT"]);
  process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED="true";
  assert.deepEqual(loans(),["LOAN-ISSUE","LOAN-INCREASE","LOAN-PAYMENT"]);
 } finally {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED; else process.env.NEXT_PUBLIC_LOAN_INCREASE_ENABLED=previous;
 }
});
