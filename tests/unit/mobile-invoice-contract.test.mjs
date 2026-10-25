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


const calls=[];
const api=loadFeature("src/lib/invoices/api/invoices-api.ts",{
 get:async(url,config)=>{calls.push({method:"GET",url,config});return {success:true,data:[],total:0};},
 post:async(url,body,config)=>{calls.push({method:"POST",url,body,config});return {success:true,data:[],total:0};}
});
const {mobileInvoiceParams}=loadFeature("src/lib/invoices/mobile-list.ts",{});
const {buildInvoiceListParams}=loadFeature("src/lib/invoices/types.ts",{});
const scenarios=[
 {name:"all",view:"all",query:"",rows:[],expected:120},
 {name:"due",view:"due",query:"",rows:[],expected:60},
 {name:"paid",view:"paid",query:"",rows:[],expected:60},
 {name:"incomplete",view:"incomplete",query:"",rows:[],expected:12},
 {name:"sender",view:"all",query:"Alpha",rows:[],expected:40},
 {name:"number",view:"all",query:"MOBILE-001",rows:[],expected:1},
 {name:"receiver",view:"all",query:"Receiver One",rows:[],expected:60},
 {name:"combined",view:"due",query:"Alpha",rows:[],expected:20},
 {name:"advanced",view:"due",query:"",rows:[{id:"sender",join:"and",field:"sender.name",operator:"contains",value:"Alpha"},{id:"receiver",join:"or",field:"receiver.name",operator:"contains",value:"Receiver One"}],expected:60},
 {name:"empty",view:"all",query:"NoSuchCustomer",rows:[],expected:0},
];
test("real Portal invoice payloads use URL pagination and valid nested search groups",async()=>{
 const contracts=[];
 for(const scenario of scenarios){
  const base=buildInvoiceListParams({page:1,limit:50,query:scenario.query,rows:scenario.rows,paymentLocation:"all"});
  const params=mobileInvoiceParams(base,scenario.view);await api.fetchInvoices(params);
  const request=calls.at(-1);const url=new URL(request.url,"http://fixture");
  assert.equal(url.searchParams.get("limit"),"50");assert.equal(url.searchParams.get("page"),"1");
  if(scenario.name==="all"){assert.equal(request.method,"GET");assert.equal(url.pathname,"/invoices");}
  else {assert.equal(request.method,"POST");assert.equal(url.pathname,"/invoices/search");assert.ok(Array.isArray(request.body.filters));assert.equal("pagination" in request.body,false);}
  contracts.push({name:scenario.name,method:request.method,url:request.url,body:request.body??{},expected:scenario.expected});
 }
 // Optional cross-repository fixture feeds these exact requests into API integration tests.
 if(process.env.EMSYS_INVOICE_CONTRACT_OUTPUT)fs.writeFileSync(process.env.EMSYS_INVOICE_CONTRACT_OUTPUT,JSON.stringify(contracts,null,2));
 const combined=contracts.find(c=>c.name==="combined").body;assert.equal(combined.operator,"and");
 const allLeaves=node=>node.filters?node.filters.flatMap(allLeaves):[node];
 const due=allLeaves(contracts.find(c=>c.name==="due").body).find(f=>f.field==="balance");assert.equal(due.value,0);assert.equal(due.operator,"gt");
 const paid=allLeaves(contracts.find(c=>c.name==="paid").body).find(f=>f.field==="paidStatus");assert.equal(paid.value,"CLOSED");
 const incomplete=allLeaves(contracts.find(c=>c.name==="incomplete").body).find(f=>f.field==="registration");assert.equal(incomplete.value,"PENDING");
});
