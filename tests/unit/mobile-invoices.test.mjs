import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

function load(file, dependencies={}) {
 const loaded={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function("require","module","exports",source)(name=>{if(name in dependencies)return dependencies[name];throw new Error(`Unexpected import ${name}`);},loaded,loaded.exports);
 return loaded.exports;
}
const model=load("src/lib/invoices/mobile-list.ts");
test("mobile filters use server-side financial and registration fields with stable ordering",()=>{
 const base={page:9,offset:400,limit:200,filterRows:[{id:"branch",field:"branch.id",operator:"eq",value:"3",join:"and"}]};
 for(const view of ["all","due","paid","incomplete"]){const params=model.mobileInvoiceParams(base,view);assert.equal(params.page,1);assert.equal(params.offset,undefined);assert.equal(params.limit,50);assert.equal(params.sort,"date:desc,id:desc");assert.equal(params.filterRows[0].field,"branch.id");if(view!=="all") assert.equal(params.filterRows.at(-1).field,view==="incomplete"?"registration":"balance");}
 assert.equal(model.mobileInvoiceParams(base,"incomplete").filterRows.at(-1).value,"PENDING");
 assert.equal(base.filterRows.length,1);
});
test("continuous pagination stops at the total or empty pages and deduplicates without reordering",()=>{
 assert.equal(model.nextMobileInvoicePage({items:[{}],total:101},1),2);
 assert.equal(model.nextMobileInvoicePage({items:[{}],total:100},2),undefined);
 assert.equal(model.nextMobileInvoicePage({items:[],total:1000},1),undefined);
 const a={invoiceId:"a"},b={invoiceId:"b"},c={invoiceId:"c"};
 assert.deepEqual(model.uniqueMobileInvoices([{items:[a,b]},{items:[b,c]}]),[a,b,c]);
});
test("mobile query scopes cached pages to tenant and actor, gates access, and forwards cancellation",async()=>{
 let captured;let auth={companyId:"tenares",user:{uid:"elk"},loading:false,roleLoading:false,hasPermission:()=>true};const calls=[];
 const hook=load("src/lib/invoices/hooks/use-mobile-invoices.ts",{
  "@tanstack/react-query":{useInfiniteQuery:options=>{captured=options;return options;}},
  "@/lib/layout/workspace-tab-scope":{useWorkspaceTabQueriesEnabled:()=>true},
  "@/lib/auth/hooks/use-auth":{useAuth:()=>auth},
  "@/lib/invoices/api/invoices-api":{fetchInvoices:async(...args)=>{calls.push(args);return {items:[],total:0};}},
  "@/lib/invoices/mobile-list":model,
 });
 hook.useMobileInvoices({limit:50},true);const first=captured.queryKey;assert.equal(captured.enabled,true);
 const controller=new AbortController();await captured.queryFn({pageParam:2,signal:controller.signal});assert.equal(calls[0][0].page,2);assert.equal(calls[0][1],controller.signal);
 auth={...auth,companyId:"other"};hook.useMobileInvoices({limit:50},true);assert.notDeepEqual(captured.queryKey,first);
 auth={...auth,hasPermission:()=>false};hook.useMobileInvoices({},true);assert.equal(captured.enabled,false);
});
