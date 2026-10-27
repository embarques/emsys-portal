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
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}



test("closeout creation only sends currency and rate, preserving server date",async()=>{
 const calls=[];const api=loadFeature("src/lib/accounting/daily-income/api.ts",{post:async(url,body)=>{calls.push({url,body});return {success:true,data:{id:72,date:"2026-10-27T03:00:00Z",businessDate:"2026-10-26",timezone:"America/New_York",status:"open",currency:"DOP",rate:60,closedCloseouts:[{id:71,businessDate:"2026-10-25",status:"closed",timezone:"America/New_York"}]}};}});
 const result=await api.createIncomeStatement({date:"2030-01-01",branchId:99,branchCode:"RD",branchName:"Untrusted selection",currency:"DOP",rate:60});
 assert.deepEqual(calls[0].body,{currency:"DOP",rate:60});assert.equal(result.date,"2026-10-26");assert.equal(result.timezone,"America/New_York");assert.equal(result.closedCloseouts[0].id,71);
});
test("closeout calendar preserves nullable current and previous metadata",async()=>{
 const api=loadFeature("src/lib/accounting/daily-income/api.ts",{get:async()=>({data:{today:"2026-10-26",serverTimezone:"America/Santo_Domingo",serverTime:"2026-10-27T02:00:00Z",current:null,previous:{id:71,businessDate:"2026-10-25",timezone:"America/Santo_Domingo",status:"open"},requiredReason:"STALE_OPEN_CLOSEOUT"}})});
 const result=await api.fetchCloseoutCalendar(3);assert.equal(result.current,null);assert.equal(result.today,"2026-10-26");assert.equal(result.previous.date,"2026-10-25");assert.equal(result.serverTimezone,"America/Santo_Domingo");assert.equal(result.requiredReason,"STALE_OPEN_CLOSEOUT");
});
test("only a structured closeout 409 opens rollover recovery",()=>{
 const {isCloseoutRequired}=loadFeature("src/lib/accounting/daily-income/closeout-required.ts",{});
 const error=(status,data)=>({isAxiosError:true,response:{status,data}});
 assert.equal(isCloseoutRequired(error(409,{data:{code:"CLOSEOUT_REQUIRED"}})),true);
 assert.equal(isCloseoutRequired(error(409,{message:"Duplicate payment warning"})),false);
 assert.equal(isCloseoutRequired(error(500,{data:{code:"CLOSEOUT_REQUIRED"}})),false);
});
