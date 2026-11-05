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


const item={id:"68f800000000000000000001",number:"INV-100",claimed:false,allocation:{userId:0,token:"version"}};
test("pool list preserves company pool zero, pagination and cancellation",async()=>{
 const calls=[];const controller=new AbortController();
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{get:async(...args)=>{calls.push(args);return {success:true,data:{items:[item],remaining:1,lowThreshold:10}}}});
 const page=await api.fetchInvoicePool(0,"cursor",controller.signal);
 assert.equal(page.items[0].number,"INV-100");assert.equal(calls[0][0],"/invoices/reserved");
 assert.deepEqual(calls[0][1].params,{userId:0,after:"cursor",limit:50,q:undefined});assert.equal(calls[0][1].signal,controller.signal);
});
test("mutation preserves operation identity and rejects unsuccessful envelopes",async()=>{
 const request={requestId:"stable",action:"generate",count:50,userId:0};let sent;
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{post:async(url,body)=>{sent={url,body};return {success:true,data:[item]}}});
 await api.manageInvoicePool(request);assert.equal(sent.body,request);assert.equal(sent.url,"/invoices/reserved/actions");
 const denied=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{post:async()=>({success:false,message:"Forbidden"})});
 await assert.rejects(()=>denied.manageInvoicePool(request),/Forbidden/);
});
test("malformed success cannot acknowledge an uncertain mutation",async()=>{
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{post:async()=>({success:true,data:[{...item,number:""}]})});
 await assert.rejects(()=>api.manageInvoicePool({requestId:"stable",action:"generate",count:1}));
});

test("user threshold preserves zero, defaults older responses, validates bounds and is saved with preferences", async () => {
 const types = loadFeature("src/lib/configuration/types.ts",{});
 for (const value of [0,10,10000]) assert.equal(types.normalizeInvoicePoolThreshold(value),value);
 for (const value of [undefined,null,-1,10001,1.5]) assert.equal(types.normalizeInvoicePoolThreshold(value),10);
 const {createUserPreferenceSchema} = loadFeature("src/lib/configuration/schema.ts",{});
 const schema = createUserPreferenceSchema(key=>key);
 assert.equal(schema.safeParse({...types.DEFAULT_USER_PREFERENCES,invoicePoolThreshold:0}).success,true);
 assert.equal(schema.safeParse({...types.DEFAULT_USER_PREFERENCES,invoicePoolThreshold:1.5}).success,false);
 let sent;
 const api = loadFeature("src/lib/configuration/api.ts",{put:async(url,body)=>{sent={url,body};return {success:true,data:{...body,id:3,user:{id:3}}};}});
 const saved = await api.updateCurrentUserPreferences({...types.DEFAULT_USER_PREFERENCES,invoicePoolThreshold:0});
 assert.equal(sent.url,"/users/me/preferences");assert.equal(sent.body.invoicePoolThreshold,0);assert.equal(saved.invoicePoolThreshold,0);
});

test("an older API cannot falsely confirm a new warning threshold", async () => {
 const types = loadFeature("src/lib/configuration/types.ts",{});
 for (const data of [{language:"es",theme:"dark",maxWorkspaceTabs:20},{...types.DEFAULT_USER_PREFERENCES,invoicePoolThreshold:10}]) {
  const api = loadFeature("src/lib/configuration/api.ts",{put:async()=>({success:true,data})});
  await assert.rejects(() => api.updateCurrentUserPreferences({...types.DEFAULT_USER_PREFERENCES,invoicePoolThreshold:25}), /could not confirm/);
 }
});

test("ordinary language and theme saves remain compatible with the older fixed-threshold API", async () => {
 const types = loadFeature("src/lib/configuration/types.ts",{});
 const api = loadFeature("src/lib/configuration/api.ts",{put:async()=>({success:true,data:{language:"es",theme:"dark",maxWorkspaceTabs:20}})});
 const saved = await api.updateCurrentUserPreferences({...types.DEFAULT_USER_PREFERENCES,language:"es",theme:"dark"});
 assert.equal(saved.language,"es"); assert.equal(saved.theme,"dark"); assert.equal(saved.invoicePoolThreshold,10);
});

test("pool number search is sent server-side and preserves cancellation",async()=>{
 let options;
 const api=loadFeature("src/lib/invoices/api/invoice-pool-api.ts",{get:async(url,value)=>{options=value;return {success:true,data:{items:[],remaining:0,lowThreshold:10}}}});
 const controller=new AbortController();
 await api.fetchInvoicePool(0,undefined,controller.signal,"  INV-001  ");
 assert.equal(options.params.q,"INV-001");assert.equal(options.params.userId,0);assert.equal(options.signal,controller.signal);
});
