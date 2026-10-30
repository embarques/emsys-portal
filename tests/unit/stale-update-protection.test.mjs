import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,"../..");
const version="v1:"+"a".repeat(64);
const newer="v1:"+"b".repeat(64);
function loader(apiClient={}) {
 const cache=new Map();
 function load(relative) {
  const filename=path.isAbsolute(relative)?relative:path.join(root,relative);
  if(cache.has(filename))return cache.get(filename).exports;
  const loadedModule={exports:{}};cache.set(filename,loadedModule);
  const source=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  function localRequire(id) {
   if(id==="@/lib/api/client")return{apiClient};
   if(id==="@/lib/api/axios")return{axiosInstance:{},normalizeApiError:error=>({status:error?.status??error?.response?.status,message:error?.message??"error"})};
   if(id.startsWith("@/")||id.startsWith(".")){
    const target=id.startsWith("@/")?path.join(root,"src",id.slice(2)):path.resolve(path.dirname(filename),id);
    if(target.endsWith(".json"))return JSON.parse(fs.readFileSync(target,"utf8"));
    return load(fs.existsSync(target+".ts")?target+".ts":path.join(target,"index.ts"));
   }
   return require(id);
  }
  new Function("require","module","exports",source)(localRequire,loadedModule,loadedModule.exports);
  return loadedModule.exports;
 }
 return load;
}
test("only a captured revision produces one strong If-Match header",()=>{
 const api=loader()("src/lib/api/mutation-version.ts");
 assert.deepEqual(api.mutationVersionHeaders(version),{"If-Match":'"'+version+'"'});
 for(const value of [undefined,"","1","*",'"'+version+'"',"v1:"+"A".repeat(64)])assert.throws(()=>api.mutationVersionHeaders(value));
 assert.equal(api.isStaleMutation({status:412}),true);
 assert.equal(api.isStaleMutation({status:428}),true);
 assert.equal(api.isStaleMutation({status:409}),false);
});
test("invoice edit uses its original version and does not fetch a new token before saving",async()=>{
 const calls=[];const conflict=Object.assign(new Error("STALE_VERSION"),{status:412});
 const load=loader({put:async(...args)=>{calls.push(args);throw conflict;},get:async()=>{throw new Error("must not refresh the precondition");}});
 const api=load("src/lib/invoices/api/invoices-api.ts");
 const types=load("src/lib/invoices/types.ts");
 const customers=load("src/lib/customers/types.ts");
 const values={...types.createEmptyInvoiceForm(),version,autoGenerateNumber:false,invoiceNumber:"INV-1",date:"2026-10-30",
  sender:{...customers.createEmptyCustomerForm(),id:"customer",name:"Sender"},lineItems:[{...types.createEmptyInvoiceLineItem(),itemName:"Box",quantity:"1",labels:"0",unitPrice:"10",total:"10"}]};
 const context={branch:{id:1,name:"NY",code:"NY"},container:{id:1,name:"Container"}};
 const original=structuredClone(values);
 await assert.rejects(api.updateInvoice("650000000000000000000001",values,context),error=>error===conflict);
 assert.deepEqual(calls[0][2],{headers:{"If-Match":'"'+version+'"'}});
 assert.deepEqual(values,original);
 await assert.rejects(api.updateInvoice("650000000000000000000001",{...values,version:undefined},context));
 assert.equal(calls.length,1);
});
test("customer edit and independently editable address data send the captured parent revision",async()=>{
 const calls=[];const conflict=Object.assign(new Error("STALE_VERSION"),{status:412});
 const load=loader({put:async(...args)=>{calls.push(args);throw conflict;}});
 const api=load("src/lib/customers/api/customers-api.ts");
 const types=load("src/lib/customers/types.ts");
 const values={...types.createEmptyCustomerForm(),id:"650000000000000000000001",version,name:"Customer",phones:[{type:"MOBILE",number:"+13477202093",isPrimary:true}],branch:{id:1,name:"NY",code:"NY"},customerType:1};
 const original=structuredClone(values);
 await assert.rejects(api.updateCustomer(values.id,values),error=>error===conflict);
 assert.deepEqual(calls[0][2],{headers:{"If-Match":'"'+version+'"'}});
 assert.deepEqual(values,original);
 await assert.rejects(api.updateCustomerAddressLocation(values.id,{type:"Point",coordinates:[-73.9,40.8]},version),error=>error===conflict);
 assert.deepEqual(calls[1][2],{headers:{"If-Match":'"'+version+'"'}});
});
test("bulk deletes bind each original row revision and retain partial-success outcomes",async()=>{
 const calls=[];
 const load=loader({delete:async(url,body,config)=>{calls.push([url,body,config]);if(url.endsWith("/two"))throw Object.assign(new Error("STALE_VERSION"),{status:412});return{success:true};}});
 const api=load("src/lib/customers/api/customers-api.ts");
 const result=await api.deleteCustomers([{id:"one",version},{id:"two",version:newer}]);
 assert.deepEqual(result.succeededIds,["one"]);
 assert.deepEqual(result.failedIds,["two"]);
 assert.deepEqual(calls.map(call=>call[2].headers["If-Match"]).sort(),['"'+version+'"','"'+newer+'"'].sort());
 assert.equal(calls.length,2);
});
