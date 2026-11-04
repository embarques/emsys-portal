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


const item={id:"68f800000000000000000001",number:"INV-100",claimed:false,allocation:{employeeId:0,token:"version"}};
test("pool list preserves company pool zero, pagination and cancellation",async()=>{
 const calls=[];const controller=new AbortController();
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{get:async(...args)=>{calls.push(args);return {success:true,data:{items:[item],remaining:1,lowThreshold:10}}}});
 const page=await api.fetchInvoicePool(0,"cursor",controller.signal);
 assert.equal(page.items[0].number,"INV-100");assert.equal(calls[0][0],"/invoices/reserved");
 assert.deepEqual(calls[0][1].params,{employeeId:0,after:"cursor",limit:50});assert.equal(calls[0][1].signal,controller.signal);
});
test("mutation preserves operation identity and rejects unsuccessful envelopes",async()=>{
 const request={requestId:"stable",action:"generate",count:50,employeeId:0};let sent;
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{post:async(url,body)=>{sent={url,body};return {success:true,data:[item]}}});
 await api.manageInvoicePool(request);assert.equal(sent.body,request);assert.equal(sent.url,"/invoices/reserved/actions");
 const denied=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{post:async()=>({success:false,message:"Forbidden"})});
 await assert.rejects(()=>denied.manageInvoicePool(request),/Forbidden/);
});
test("malformed success cannot acknowledge an uncertain mutation",async()=>{
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{post:async()=>({success:true,data:[{...item,number:""}]})});
 await assert.rejects(()=>api.manageInvoicePool({requestId:"stable",action:"generate",count:1}));
});
