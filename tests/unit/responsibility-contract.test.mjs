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
 assert.deepEqual(policy.responsibilityPermission("INVOICE"), { name:"canAssignInvoiceResponsibility",resourceType:"invoice_responsibility" });
 for (const type of ["INITIAL-PAYMENT","PAYMENT","DISCOUNT","SURCHARGE","REFUND"]) assert.deepEqual(policy.responsibilityPermission(type), { name:"canAssignPaymentResponsibility",resourceType:"payment_responsibility" });
 for (const type of ["EXPENSE","SALES","INVENTORY"]) assert.equal(policy.responsibilityPermission(type),null);
 const { permissionKey, permissionIsGranted }=loadFeature("src/lib/auth/permissions.ts");
 for (const permission of [policy.responsibilityPermission("PAYMENT"),policy.responsibilityPermission("INITIAL-PAYMENT")]) {
  assert.equal(permissionIsGranted(permission,new Set(["daily_route_work:canmanagedailyrouterecords","employee:canupdateemployee"])),false);
  assert.equal(permissionIsGranted(permission,new Set([permissionKey(permission)])),true);
 }
});

test("responsibility assignment rejects a matching name on the wrong resource", () => {
 const { PERMISSIONS, permissionKey, permissionIsGranted } = loadFeature("src/lib/auth/permissions.ts");
 for (const required of [PERMISSIONS.invoiceResponsibilityAssign, PERMISSIONS.paymentResponsibilityAssign]) {
  for (const resourceType of ["invoice", "journal", "daily_route_work", "invoice_responsibility", "payment_responsibility"]) {
   const keys = new Set([permissionKey({ name: required.name, resourceType })]);
   assert.equal(permissionIsGranted(required, keys), resourceType === required.resourceType, `${required.name} on ${resourceType}`);
  }
  assert.equal(permissionIsGranted(required, new Set(["*:*"])), true, "existing superuser grant remains supported");
  const other = required === PERMISSIONS.invoiceResponsibilityAssign ? PERMISSIONS.paymentResponsibilityAssign : PERMISSIONS.invoiceResponsibilityAssign;
  assert.equal(permissionIsGranted(required, new Set([permissionKey({ name: other.name, resourceType: required.resourceType })])), false, "wrong name on the expected resource is rejected");
 }
 assert.equal(permissionIsGranted(PERMISSIONS.invoicesView, new Set(["invoiceitem:canviewinvoiceitem"])), true, "legacy invoice view alias remains supported");
});

test("membership does not permit assigning another supervisor", () => {
 assert.equal(policy.canSelectResponsibleRoute(route(5),false,9),false);
 assert.equal(policy.canSelectResponsibleRoute(route(5),false,5),true);
 assert.equal(policy.canSelectResponsibleRoute(route(5),false,undefined),false);
 assert.equal(policy.canSelectResponsibleRoute(route(5),true,9),true);
 assert.equal(policy.canSelectResponsibleRoute({...route(5), employees:[{id:5,role:"supervisor"},{id:9,role:"supervisor"}]},false,5),false);
 assert.equal(policy.canSelectResponsibleRoute({...route(5), employees:[{id:5,role:"supervisor"},{id:9,role:"supervisor"}]},true,5),false);
 assert.equal(policy.canSelectResponsibleRoute({...route(5), employees:[]},true,5),false);
});

test("self attribution removes stale employee, route and supervisor before posting", async () => {
 let payload;
 const api=loadFeature("src/lib/accounting/daily-income/api.ts", {post:async (_url,body)=>{payload=body;return {data:{id:"journal1"}};}});
 await api.createDailyIncomeJournal({id:1,branch:{id:2},currency:"USD",rate:1}, {transactionType:"PAYMENT",amount:10,invoiceId:"invoice1",refNumber:"",description:"",paymentMethodName:"CASH",employeeId:99,routeId:route(99).id,...policy.selfResponsibility()});
 assert.equal(payload.employee,null); assert.equal(payload.route,null); assert.equal(payload.vehicleRoute,null);
 assert.equal(payload.invoiceId,"invoice1");
});

test("invoice wire responsibility is independent of payment selection", () => {
 const input={...createEmptyInvoiceForm(),pickupSource:"route",routeId:route(88).id,routeCrewName:"Merchandise route",pickupEmployeeId:"99"};
 assert.deepEqual(invoicePolicy.buildInvoiceResponsibilityInput(input),{dailyRouteId:route(88).id});
 assert.deepEqual(invoicePolicy.buildInvoiceResponsibilityInput({...input,pickupSource:"office",pickupEmployeeId:"88",pickupEmployeeName:"Merchandise employee"}),{employee:{id:88,name:"Merchandise employee"}});
 assert.deepEqual(invoicePolicy.buildInvoiceResponsibilityInput({...input,pickupSource:"creator"}),{});
 assert.equal(input.pickupEmployeeId,"99","building invoice payload never mutates the draft");
});

test("invoice route defaults extract its supervisor for the initial collector", () => {
 const defaults = policy.paymentDefaultsFromInvoiceResponsibility({ dailyRouteId: route(5).id }, [route(5)]);
 assert.equal(defaults.routeId, route(5).id); assert.equal(defaults.supervisorId, 5); assert.equal(defaults.employeeId, undefined);
 assert.equal(policy.paymentDefaultsFromInvoiceResponsibility({ employee: { id: 88, name: "Merchandise" } }, []).employeeId, 88);
});

test("invoice supervisor supports canonical and legacy driver employee readback", async () => {
 for (const field of ["supervisor", "driver"]) {
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { get: async () => ({ data: { id: "invoice1", number: "00042", [field]: { id: 88, name: "Merchandise supervisor" }, employee: { id: 73, name: "Digitizer" } } }) });
  const invoice = await api.fetchInvoiceById("invoice1");
  assert.deepEqual(invoice.supervisor, { id: 88, name: "Merchandise supervisor" });
  assert.equal(invoice.pickupEmployeeId, "88");
 }
});

test("initial-payment sends invoice and collector responsibility separately", async () => {
 let payload;
 const api=loadFeature("src/lib/accounting/daily-income/api.ts",{post:async(_url,body)=>{payload=body;return {data:{id:"journal1",employee:{id:99,name:"Collector"}}};}});
 const result=await api.createDailyIncomeJournal({id:1,branch:{id:2},currency:"USD",rate:1},{transactionType:"INITIAL-PAYMENT",amount:10,invoiceNumber:"00042",invoiceCost:100,invoiceResponsibility:{employee:{id:88,name:"Merchandise employee"}},employeeId:99,employeeName:"Collector",refNumber:"",description:"",paymentMethodName:"CASH"});
 assert.deepEqual(payload.invoice.responsibility,{employee:{id:88,name:"Merchandise employee"}});
 assert.equal(payload.employee.id,99); assert.equal(result.employee.id,99);
 assert.equal(payload.invoice.cost,100); assert.equal(payload.amount,10);
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
 assert.ok(messages.dailyIncome.errors.responsibilityRequiredOpenEmployees);
 assert.ok(messages.dailyIncome.errors.responsibilityRequiredContactAdmin);
 assert.ok(messages.dailyIncome.errors.openEmployees);
 assert.ok(messages.dailyIncome.errors.openEmployeesHint);
 const invoices=JSON.parse(fs.readFileSync(path.join(root,`src/locales/${language}/invoices.json`),"utf8"));
 assert.ok(invoices.assigned.errors.employeeNotLinkedOpenEmployees);
 assert.ok(invoices.form.fields.pickupSourceCreator);
 assert.ok(invoices.form.fields.responsibleParty);
});


for (const code of ["INITIAL_PAYMENT_ASSIGNEE_REQUIRED", "TRANSACTION_EMPLOYEE_REQUIRED", "INVOICE_EMPLOYEE_LINK_REQUIRED"]) test(`${code}: structured API error becomes recovery guidance`, () => {
 const mapper=loadFeature("src/lib/accounting/daily-income/journal-api-error.ts");
 const error={isAxiosError:true,response:{status:422,data:{message:code,error:"Raw backend detail",data:{code}}}};
 const admin=mapper.normalizeDailyIncomeJournalError(error);
 assert.match(admin,/active employee/i);assert.match(admin,/employee-link permission/i);assert.doesNotMatch(admin,/Raw backend detail|REQUIRED/);
 const portal=mapper.normalizeDailyIncomeJournalError(error,{canManageEmployees:true});
 assert.match(portal,/Open Employees/i);assert.doesNotMatch(portal,/administrator/i);
 assert.equal(mapper.presentDailyIncomeJournalError(error,{canManageEmployees:true}).recovery,"employees");
 assert.equal(mapper.presentDailyIncomeJournalError(error).recovery,null);
 assert.equal(mapper.isResponsibilityRequiredErrorMessage(portal),true);
 assert.equal(mapper.isResponsibilityRequiredErrorMessage(admin),true);
});

test("generic journal form continues rejecting the separate loan payment workflow",()=>{
 const {dailyIncomeJournalSchema}=loadFeature("src/lib/accounting/daily-income/schemas.ts");
 assert.equal(dailyIncomeJournalSchema.safeParse({transactionType:"LOAN-PAYMENT",amount:10,refNumber:"",description:""}).success,false);
});


test("invoice completion retains merchandise party when the collector differs", async () => {
 const types=loadFeature("src/lib/invoices/types.ts");
 const customers=loadFeature("src/lib/customers/types.ts");
 const values={...createEmptyInvoiceForm(),pickupSource:"office",pickupEmployeeId:"88",pickupEmployeeName:"Merchandise employee",invoiceNumber:"00042",sender:{...customers.createEmptyCustomerForm(),id:"customer1",name:"Sender"},lineItems:[{...types.createEmptyInvoiceLineItem(),itemName:"Box",quantity:"1",labelCount:"1",unitPrice:"100",lineTotal:"100"}]};
 let payload;const stop=new Error("captured");
 const api=loadFeature("src/lib/invoices/api/invoices-api.ts",{post:async(_url,body)=>{payload=body;throw stop;}});
 await assert.rejects(api.createInvoice(values,{branch:{id:1,name:"NY",code:"NY"},container:{id:1,name:"Test"},registeredInvoiceTotals:{cost:100,payment:10,balance:90},pickupAssignment:{source:"office",pickupEmployee:{id:88,name:"Merchandise employee"}}}),e=>e===stop);
 assert.equal(payload.receivedBy.id,"88");assert.equal(payload.employee.id,88);
 assert.equal(payload.cost,100);assert.equal(payload.payment,10);assert.equal(payload.balance,90);
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
