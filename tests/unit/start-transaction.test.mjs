import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(fs.readFileSync(new URL("../../src/lib/accounting/daily-income/use-start-transaction.ts", import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const open={id:7,status:"OPEN",date:"2026-10-27",branch:{id:2},currency:"USD",rate:1};
function harness({code="US",current=null,denied=[],create=async()=>open,fetchFailure}={}) {
 const calls=[];const states=[];const cleanup=[];const ready=[];
 const deps={
  react:{useRef:(current)=>({current}),useState:(initial)=>{const i=states.length;states.push(initial);return [initial,(next)=>{states[i]=next;}];},useEffect:(effect)=>{cleanup.push(effect());}},
  "@tanstack/react-query":{useMutation:({mutationFn})=>({mutateAsync:mutationFn,isPending:false}),useQueryClient:()=>({fetchQuery:async()=>{calls.push("fetch");if(fetchFailure)throw fetchFailure;return current;},setQueryData:(key,value)=>calls.push(["cache",key,value]),invalidateQueries:async()=>{calls.push("invalidate");}})},
  "@/lib/auth/hooks/use-auth":{useAuth:()=>({companyId:"company",hasPermission:(name)=>!denied.includes(name)})},
  "@/lib/api/api-error":{normalizeApiError:(error)=>error},
  "@/lib/i18n":{useTranslation:()=>({t:(key)=>key})},
  "@/lib/query/query-keys":{queryKeys:{accounting:{all:["accounting"],incomeStatementById:(id)=>["accounting","income-statement-by-id",id]}}},
  "@/lib/pickup-delivery-routes/types":{isDeliveryBranchCode:(code)=>["RD","DR","DO"].includes(code)},
  "./api":{fetchCurrentIncomeStatement:()=>{},createTodayIncomeStatement:async(branch,setup)=>{calls.push(["create",branch,setup]);return create();}},
 };
 const loaded={exports:{}};
 new Function("require","module","exports",source)((name)=>{assert.ok(deps[name],name);return deps[name];},loaded,loaded.exports);
 const hook=loaded.exports.useStartTransaction({id:2,code,name:"Branch"},(statement)=>ready.push(statement));
 return {hook,calls,states,ready,cleanup};
}
test("Add transaction proceeds on the current open closeout without creating another",async()=>{
 const h=harness({current:open});await h.hook.start();assert.deepEqual(h.ready,[open]);assert.equal(h.calls.filter(Array.isArray).length,0);
});
test("missing and closed US closeouts create today at USD/1 then continue",async()=>{
 for(const current of [null,{...open,status:"CLOSED"}]){const h=harness({current});await h.hook.start();assert.deepEqual(h.calls.find((c)=>c[0]==="create")[2],{currency:"USD",rate:1});assert.deepEqual(h.ready,[open]);}
});
test("RD waits for currency setup and preserves the dialog on failure",async()=>{
 const h=harness({code:"RD",create:async()=>{throw new Error("creation failed");}});await h.hook.start();assert.equal(h.states[0],true);assert.equal(h.calls.some((c)=>c[0]==="create"),false);await h.hook.start({currency:"DOP",rate:60});assert.equal(h.states[0],true);assert.equal(h.states[1],"creation failed");assert.deepEqual(h.ready,[]);
});
test("missing create permission and failed lookups do not create a closeout",async()=>{
 for(const options of [{denied:["canCreateIncomeStatement"]},{fetchFailure:{status:403,message:"forbidden"}}]){const h=harness(options);await h.hook.start();assert.equal(h.calls.some((c)=>c[0]==="create"),false);assert.deepEqual(h.ready,[]);assert.ok(h.states[1]);}
});
test("missing journal permission blocks the action before any request",async()=>{
 const h=harness({denied:["canCreateJournal"]});assert.equal(h.hook.canStart,false);await h.hook.start();assert.deepEqual(h.calls,[]);
});
test("rapid clicks create once and context cleanup prevents navigation and cache updates",async()=>{
 let resolve;const h=harness({create:()=>new Promise((done)=>{resolve=done;})});const first=h.hook.start();await new Promise((done)=>setImmediate(done));await h.hook.start();h.cleanup.forEach((fn)=>fn?.());resolve(open);await first;assert.equal(h.calls.filter((c)=>c[0]==="create").length,1);assert.deepEqual(h.ready,[]);assert.equal(h.calls.some((c)=>c[0]==="cache"),false);
});

test("RD setup creates with the selected rate and then continues",async()=>{
 const h=harness({code:"RD"});await h.hook.start();await h.hook.start({currency:"DOP",rate:62});assert.deepEqual(h.calls.find((c)=>c[0]==="create")[2],{currency:"DOP",rate:62});assert.equal(h.states[0],false);assert.deepEqual(h.ready,[open]);
});
test("a missing current closeout reported as 404 allows creation",async()=>{
 const h=harness({fetchFailure:{status:404,message:"not found"}});await h.hook.start();assert.equal(h.calls.filter((c)=>c[0]==="create").length,1);assert.deepEqual(h.ready,[open]);
});
test("a current closeout from another branch cannot be used",async()=>{
 const h=harness({current:{...open,branch:{id:99}}});await h.hook.start();assert.deepEqual(h.ready,[]);assert.equal(h.calls.some((c)=>c[0]==="create"),false);assert.ok(h.states[1]);
});
