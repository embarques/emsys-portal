import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadFeature(relative, client = {}) {
  const cache = new Map();
  function load(filename) {
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient: client };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        return load(target.endsWith(".json") ? target : fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}


const policy = loadFeature("src/lib/accounting/daily-income/responsibility.ts");
const invoicePolicy = loadFeature("src/lib/invoices/responsibility.ts");
const { createEmptyInvoiceForm } = loadFeature("src/lib/invoices/types.ts");
const route = (supervisorId) => ({ id:"650000000000000000000001", employees:[{id:supervisorId,name:"Supervisor",role:"supervisor"},{id:9,name:"Driver",role:"driver"}] });

test("invoice registration and later payments require different exact assignment grants", () => {
 assert.deepEqual(policy.responsibilityPermission("INITIAL-PAYMENT"), { name:"canAssignInvoiceResponsibility",resourceType:"invoice_responsibility" });
 for (const type of ["PAYMENT","DISCOUNT","SURCHARGE","REFUND"]) assert.deepEqual(policy.responsibilityPermission(type), { name:"canAssignPaymentResponsibility",resourceType:"payment_responsibility" });
 for (const type of ["EXPENSE","SALES","INVENTORY"]) assert.equal(policy.responsibilityPermission(type),null);
 const { permissionKey, permissionIsGranted }=loadFeature("src/lib/auth/permissions.ts");
 for (const permission of [policy.responsibilityPermission("PAYMENT"),policy.responsibilityPermission("INITIAL-PAYMENT")]) {
  assert.equal(permissionIsGranted(permission,new Set(["daily_route_work:canmanagedailyrouterecords","employee:canupdateemployee"])),false);
  assert.equal(permissionIsGranted(permission,new Set([permissionKey(permission)])),true);
 }
});

test("membership does not permit assigning another supervisor", () => {
 assert.equal(policy.canSelectResponsibleRoute(route(5),false,9),false);
 assert.equal(policy.canSelectResponsibleRoute(route(5),false,5),true);
 assert.equal(policy.canSelectResponsibleRoute(route(5),false,undefined),false);
 assert.equal(policy.canSelectResponsibleRoute(route(5),true,9),true);
 assert.equal(policy.canSelectResponsibleRoute({...route(5), employees:[{id:5,role:"supervisor"},{id:9,role:"supervisor"}]},false,5),false);
});

test("self attribution removes stale employee, route and supervisor before posting", async () => {
 let payload;
 const api=loadFeature("src/lib/accounting/daily-income/api.ts", {post:async (_url,body)=>{payload=body;return {data:{id:"journal1"}};}});
 await api.createDailyIncomeJournal({id:1,branch:{id:2},currency:"USD",rate:1}, {transactionType:"PAYMENT",amount:10,invoiceId:"invoice1",refNumber:"",description:"",paymentMethodName:"CASH",employeeId:99,routeId:route(99).id,...policy.selfResponsibility()});
 assert.equal(payload.employee,null); assert.equal(payload.route,null); assert.equal(payload.vehicleRoute,null);
 assert.equal(payload.invoiceId,"invoice1");
});

test("returned initial-payment employee replaces stale creation selection", () => {
 const input={...createEmptyInvoiceForm(),pickupSource:"route",routeId:route(99).id,routeCrewName:"Old route",pickupEmployeeId:"99"};
 const result=invoicePolicy.applyRegisteredInvoiceResponsibility(input,{employee:{id:5,name:"Responsible"}});
 assert.equal(result.pickupEmployeeId,"5"); assert.equal(result.pickupEmployeeName,"Responsible"); assert.equal(result.routeId,"");
 assert.equal(input.routeId,route(99).id,"caller draft is not mutated");
});

test("returned initial-payment route remains creation attribution independent of old employee", () => {
 const input={...createEmptyInvoiceForm(),pickupSource:"office",pickupEmployeeId:"99"};
 const result=invoicePolicy.applyRegisteredInvoiceResponsibility(input,{employee:{id:5,name:"Supervisor"},route:{id:route(5).id,name:"Chosen route"}});
 assert.equal(result.pickupSource,"route"); assert.equal(result.routeId,route(5).id); assert.equal(result.pickupEmployeeId,"");
});

test("payment lookup preserves leading zeros and exposes only reference/totals", async () => {
 let request;
 const api=loadFeature("src/lib/accounting/daily-income/payment-invoice.ts", {get:async (url,config)=>{request={url,config};return {data:{id:"invoice1",number:"00042",cost:100,discount:0,payment:30,balance:70,employee:{id:99},sender:{name:"Private"}}};}});
 const controller=new AbortController();
 const result=await api.fetchPaymentInvoiceReference(" 00042 ",controller.signal);
 assert.equal(request.url,"/journals/payment-invoice/lookup"); assert.equal(request.config.params.number,"00042"); assert.equal(request.config.signal,controller.signal);
 assert.deepEqual(result,{unavailable:false,invoice:{invoiceId:"invoice1",invoiceNumber:"00042",cost:100,discount:0,amountPaid:30,balance:70}});
});

for (const [message,unavailable] of [["Invoice not found",false],[undefined,true]]) {
 test(`payment lookup distinguishes unavailable endpoint from missing invoice (${message})`,async()=>{
  const error={isAxiosError:true,response:{status:404,data:{message}}};
  const api=loadFeature("src/lib/accounting/daily-income/payment-invoice.ts",{get:async()=>{throw error;}});
  assert.deepEqual(await api.fetchPaymentInvoiceReference("00042"),{invoice:null,unavailable});
 });
}

test("forbidden payment lookup never falls back to wider reads",async()=>{
 const error={isAxiosError:true,response:{status:403,data:{message:"Forbidden"}}};
 const api=loadFeature("src/lib/accounting/daily-income/payment-invoice.ts",{get:async()=>{throw error;}});
 await assert.rejects(api.fetchPaymentInvoiceReference("00042"),e=>e===error);
});

test("active linked employee resolution is exact, bounded, and rejects ambiguity",async()=>{
 for (const items of [[{id:5,name:"Self",active:true,user:{id:9}}],[{id:5,name:"Self",active:true,user:{id:9}},{id:6,name:"Duplicate",active:true,user:{id:9}}],[{id:5,name:"Inactive",active:false,user:{id:9}}],[{id:5,name:"Name match",active:true,user:{id:99}}]]) {
  let request;
  const api=loadFeature("src/lib/employees/api/employees-api.ts",{post:async(url,body)=>{request={url,body};return {data:items,total:items.length};}});
  const employee=await api.fetchEmployeeByUserId(9);
  assert.equal(employee?.id ?? null,items.length===1 && items[0].active && items[0].user.id===9 ? 5 : null);
  assert.match(request.url,/limit=2/);
  assert.match(JSON.stringify(request.body),/user.id/);
 }
});

for (const language of ["en","es"]) test(`${language}: responsibility guidance and errors exist`,()=>{
 const messages=JSON.parse(fs.readFileSync(path.join(root,`src/locales/${language}/accounting.json`),"utf8"));
 assert.ok(messages.dailyIncome.form.hints.selfResponsibility);
 assert.ok(messages.dailyIncome.form.hints.paymentLookupUnavailable);
 assert.ok(messages.dailyIncome.errors.responsibilityRequired);
 const invoices=JSON.parse(fs.readFileSync(path.join(root,`src/locales/${language}/invoices.json`),"utf8"));
 assert.ok(invoices.form.fields.pickupSourceCreator);
 assert.ok(invoices.form.hints.selfResponsibility);
});


for (const code of ["INITIAL_PAYMENT_ASSIGNEE_REQUIRED", "TRANSACTION_EMPLOYEE_REQUIRED", "INVOICE_EMPLOYEE_LINK_REQUIRED"]) test(`${code}: structured API error becomes recovery guidance`, () => {
 const mapper=loadFeature("src/lib/accounting/daily-income/journal-api-error.ts");
 const error={isAxiosError:true,response:{status:422,data:{message:code,error:"Raw backend detail",data:{code}}}};
 const message=mapper.normalizeDailyIncomeJournalError(error);
 assert.match(message,/active employee/i);assert.doesNotMatch(message,/Raw backend detail|REQUIRED/);
});

test("generic journal form continues rejecting the separate loan payment workflow",()=>{
 const {dailyIncomeJournalSchema}=loadFeature("src/lib/accounting/daily-income/schemas.ts");
 assert.equal(dailyIncomeJournalSchema.safeParse({transactionType:"LOAN-PAYMENT",amount:10,refNumber:"",description:""}).success,false);
});


test("invoice completion sends committed initial responsibility despite a different draft selection", async () => {
 const journal={employee:{id:5,name:"Committed employee"}};
 const types=loadFeature("src/lib/invoices/types.ts");
 const customers=loadFeature("src/lib/customers/types.ts");
 const stale={...createEmptyInvoiceForm(),pickupSource:"office",pickupEmployeeId:"99",pickupEmployeeName:"Stale",invoiceNumber:"00042",sender:{...customers.createEmptyCustomerForm(),id:"customer1",name:"Sender"},lineItems:[{...types.createEmptyInvoiceLineItem(),itemName:"Box",quantity:"1",labelCount:"1",unitPrice:"80",lineTotal:"80"}]};
 const values=invoicePolicy.applyRegisteredInvoiceResponsibility(stale,journal);
 const assignment=invoicePolicy.registeredInvoicePickupAssignment(values,journal);
 let payload;const stop=new Error("captured");
 const api=loadFeature("src/lib/invoices/api/invoices-api.ts",{post:async(_url,body)=>{payload=body;throw stop;}});
 await assert.rejects(api.createInvoice(values,{branch:{id:1,name:"NY",code:"NY"},container:{id:1,name:"Test"},pickupAssignment:assignment}),e=>e===stop);
 assert.equal(payload.receivedBy.id,"5");assert.equal(payload.employee.id,5);assert.equal(payload.receivedBy.name,"Committed employee");
});


test("company lookup preserves full invoice search for administrators and limits the exception to payments",()=>{
 const op=[{name:"canOperateDailyRoute",resourceType:"daily_route_work"}];
 assert.equal(policy.needsCompanyPaymentLookup("PAYMENT",false,[],true),false);
 assert.equal(policy.needsCompanyPaymentLookup("PAYMENT",false,op,true),true);
 assert.equal(policy.needsCompanyPaymentLookup("PAYMENT",false,[],false),true);
 assert.equal(policy.needsCompanyPaymentLookup("DISCOUNT",false,op,true),false);
 assert.equal(policy.needsCompanyPaymentLookup("SURCHARGE",false,op,true),false);
 assert.equal(policy.needsCompanyPaymentLookup("INITIAL-PAYMENT",true,op,true),true);
});
