import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/axios") return { axiosInstance: {} };
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}


test("pending activity defaults to all dates and keeps filters on the server",()=>{
 const api=loadFeature("src/lib/accounting/financial-activity/api.ts",{});
 const empty={employee:"",branch:"",method:"",from:"",through:"",minimum:"",age:""};const base=api.buildActivitySearch(empty,2);
 assert.deepEqual(base.filters,[]);assert.deepEqual(base.pagination,{page:2,limit:40});
 const filtered=api.buildActivitySearch({...empty,employee:"Maria",method:"CHECK",minimum:"0",age:"7"},1);
 assert.ok(filtered.filters.some(filter=>filter.field==="employee.name"&&filter.value==="Maria"));
 assert.ok(filtered.filters.some(filter=>filter.field==="outstandingAmount"&&filter.value===0));
 assert.ok(filtered.filters.some(filter=>filter.field==="ageDays"&&filter.value===7));
});
test("ordinary new journal omits historical period selection and its date",async()=>{
 const calls=[];const api=loadFeature("src/lib/accounting/daily-income/api.ts",{post:async(url,body)=>{calls.push([url,body]);return{success:true,data:{id:"68f800000000000000000001",transactionType:"SALES",transactionAmount:10}};}});
 await api.createDailyIncomeJournal({id:123,date:"2020-01-01",status:"CLOSED",branch:{id:3},currency:"USD",rate:1},{transactionType:"SALES",amount:"10",accountId:4,accountName:"Income",accountType:"REVENUE",paymentMethodName:"CASH",refNumberMode:"system"});
 assert.equal(calls[0][0],"/journals");assert.equal("incomeStatementId" in calls[0][1],false);assert.equal("incomeStatement" in calls[0][1],false);assert.equal("date" in calls[0][1],false);assert.deepEqual(calls[0][1].branch,{id:3});
});
test("central clearing retains method-specific endpoint and immutable status direction",async()=>{
 const calls=[];const api=loadFeature("src/lib/accounting/financial-activity/api.ts",{put:async(...args)=>{calls.push(args);return{success:true};}});
 await api.clearFinancialPayment({id:"journal",paymentId:"payment",paymentMethod:{name:"CHECK"},clearingStatus:"OUTSTANDING"});
 assert.deepEqual(calls,[["/checks/payment",{status:"CLEARED"}]]);
 assert.equal(api.clearingAction({paymentId:"payment",paymentMethod:{name:"CHECK"},clearingStatus:"CLEARED"}),undefined);
});


test("invoice list requests have a deadline and propagate cancellation on both endpoints", async () => {
 const calls=[];
 const api=loadFeature("src/lib/invoices/api/invoices-api.ts", {
   get:async (...args)=>{calls.push(args);return {success:true,data:[],total:0};},
   post:async (...args)=>{calls.push(args);return {success:true,data:[],total:0};},
 });
 const controller=new AbortController();
 await api.fetchInvoices({},controller.signal);
 await api.fetchInvoices({search:{field:"invoice",value:"123"}},controller.signal);
 assert.equal(calls.length,2);
 for(const args of calls){const config=args.at(-1);assert.equal(config.timeout,60000);assert.equal(config.signal,controller.signal);}
});

test("pending financial activity opens as a desktop workspace tab", () => {
 const filename=path.join(root,"src/lib/layout/workspace-registry.ts");
 const source=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const components=new Map();
 function boundary(specifier){
   if(specifier.includes("-workspace")){if(!components.has(specifier)) components.set(specifier,new Proxy({}, {get:(target,name)=>target[name]??(target[name]=function Workspace(){return String(name);})}));return components.get(specifier);}
   return {};
 }
 const loaded={exports:{}};
 new Function("require","module","exports",source)(boundary,loaded,loaded.exports);
 const registry=loaded.exports;
 assert.equal(registry.isWorkspaceRoute("/accounting/pending-financial-activity"),true);
 assert.equal(registry.resolveWorkspaceComponent("/accounting/pending-financial-activity?tab=8"),components.get("@/components/accounting/financial-activity-workspace").FinancialActivityWorkspace);
});
