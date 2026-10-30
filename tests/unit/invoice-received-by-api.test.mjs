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


for (const method of ["createInvoice", "updateInvoice"]) {
 for (const source of ["office", "warehouse", "route"]) {
  test(`${method} serializes ${source} receivedBy using the API ID types`, async () => {
   let payload;
   const stop = new Error("Captured request");
   const send = async (_, body) => { payload = JSON.parse(JSON.stringify(body)); throw stop; };
   const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { post: send, put: send });
   const types = loadFeature("src/lib/invoices/types.ts", {});
   const customers = loadFeature("src/lib/customers/types.ts", {});
   const values = {
    ...types.createEmptyInvoiceForm(), version: "v1:"+"a".repeat(64), autoGenerateNumber:false, invoiceNumber:"TEST-1", date:"2026-10-12",
    sender: {...customers.createEmptyCustomerForm(), id:"customer-1", name:"Sender"},
    lineItems:[{...types.createEmptyInvoiceLineItem(), itemName:"Box", quantity:"1", labels:"1", unitPrice:"80", total:"80"}],
   };
   const context = {
    branch:{id:1,name:"NY",code:"NY"}, container:{id:1,name:"66-26"},
    pickupAssignment: source === "route"
     ? {source, dailyRoute:{id:"daily-route-1",name:"Daily route"}}
     : {source, pickupEmployee:{id:73,name:" Maria ",userName:"maria"},officeBranch:{id:1,name:"NY",code:"NY"}},
   };
   const request = method === "updateInvoice"
    ? api[method]("507f1f77bcf86cd799439011", values, context)
    : api[method](values, context);
   await assert.rejects(request, (error) => error === stop);
   if (source === "route") {
    assert.equal(payload.receivedBy.id,"daily-route-1");
    assert.equal(Object.hasOwn(payload.receivedBy,"route"),false);
    assert.equal(payload.routeCrew,method === "updateInvoice" ? null : undefined);
   } else {
    assert.equal(payload.receivedBy.id,"73");
    assert.equal(payload.receivedBy.name,"Maria");
    assert.equal(payload.employee.id,73);
    assert.equal(payload.pickupEmployee.id,73);
   }
  });
 }
}

for (const [pickupId, expected] of [["21801", 21801], [" 21801 ", 21801], ["4294967295", 4294967295], ["", undefined]]) {
 test(`invoice update sends numeric pickup reference for ${JSON.stringify(pickupId)}`, async () => {
  let payload;
  const stop = new Error("Captured request");
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { put: async (_, body) => { payload = JSON.parse(JSON.stringify(body)); throw stop; } });
  const types = loadFeature("src/lib/invoices/types.ts", {});
  const customers = loadFeature("src/lib/customers/types.ts", {});
  const values = { ...types.createEmptyInvoiceForm(), version: "v1:"+"a".repeat(64), pickupId, invoiceNumber: "TEST-1", date: "2026-10-15", sender: { ...customers.createEmptyCustomerForm(), id: "customer-1", name: "Sender" }, lineItems: [{ ...types.createEmptyInvoiceLineItem(), itemName: "Box", quantity: "1", labels: "1", unitPrice: "80", total: "80" }] };
  await assert.rejects(api.updateInvoice("507f1f77bcf86cd799439011", values, { branch: { id: 1, name: "NY", code: "NY" }, container: { id: 1, name: "66-26" } }), error => error === stop);
  assert.equal(payload.pickup?.id, expected);
  if (expected !== undefined) assert.equal(typeof payload.pickup.id, "number");
 });
}

for (const pickupId of ["abc", "0", "-1", "1.5", "4294967296"]) {
 test(`invoice update rejects invalid pickup ID ${pickupId} before HTTP`, async () => {
  let called = false;
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { put: async () => { called = true; } });
  const types = loadFeature("src/lib/invoices/types.ts", {});
  const customers = loadFeature("src/lib/customers/types.ts", {});
  const values = { ...types.createEmptyInvoiceForm(), version: "v1:"+"a".repeat(64), pickupId, invoiceNumber: "TEST-1", date: "2026-10-15", sender: { ...customers.createEmptyCustomerForm(), id: "customer-1", name: "Sender" }, lineItems: [{ ...types.createEmptyInvoiceLineItem(), itemName: "Box", quantity: "1", labels: "1", unitPrice: "80", total: "80" }] };
  await assert.rejects(api.updateInvoice("507f1f77bcf86cd799439011", values, { branch: { id: 1, name: "NY", code: "NY" }, container: { id: 1, name: "66-26" } }), /Pickup ID must/);
  assert.equal(called, false);
 });
}

for (const generatedInvoiceNumber of [undefined, "INV-26-001423"]) {
 test(`automatic invoice ${generatedInvoiceNumber ? "completes its assigned pending number" : "requests server allocation"}`, async () => {
  let payload;
  const stop = new Error("Captured request");
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", { post: async (_, body) => {payload=body;throw stop;} });
  const {createEmptyInvoiceForm,createEmptyInvoiceLineItem} = loadFeature("src/lib/invoices/types.ts", {});
  const {createEmptyCustomerForm} = loadFeature("src/lib/customers/types.ts", {});
  const values={...createEmptyInvoiceForm(),autoGenerateNumber:true,generatedInvoiceNumber,invoiceNumber:generatedInvoiceNumber??"",date:"2026-10-16",sender:{...createEmptyCustomerForm(),id:"customer-1",name:"Sender"},lineItems:[{...createEmptyInvoiceLineItem(),itemName:"Box",quantity:"1",labels:"1",unitPrice:"80",total:"80"}]};
  await assert.rejects(api.createInvoice(values,{branch:{id:1,name:"NY",code:"NY"},container:{id:1,name:"66-26"},pickupAssignment:{source:"office",pickupEmployee:{id:73,name:"Maria"},officeBranch:{id:1,name:"NY",code:"NY"}}}),error=>error===stop);
  assert.equal(payload.autoGenerateNumber, generatedInvoiceNumber ? undefined : true);
  assert.equal(payload.number,generatedInvoiceNumber);
  assert.equal(Object.hasOwn(payload,"number"),Boolean(generatedInvoiceNumber));
 });
}

test("wizard requires a manual number and accepts automatic allocation", () => {
 const {findInvoiceWizardStep1Issue}=loadFeature("src/lib/invoices/invoice-wizard-validation.ts",{});
 const {createEmptyInvoiceForm}=loadFeature("src/lib/invoices/types.ts",{});
 const values={...createEmptyInvoiceForm(),date:"2026-10-16",containerId:"1",pickupSource:"office",pickupEmployeeId:"1",paymentLocation:"US",autoGenerateNumber:false,invoiceNumber:""};
 assert.match(findInvoiceWizardStep1Issue(values,key=>key).message,/invoiceNumberRequired/);
 assert.equal(findInvoiceWizardStep1Issue({...values,autoGenerateNumber:true},key=>key),null);
});

test("new invoices default to automatic and manual numbering requires its own grant", () => {
 const {createEmptyInvoiceForm}=loadFeature("src/lib/invoices/types.ts",{});
 const {PERMISSIONS,permissionIsGranted}=loadFeature("src/lib/auth/permissions.ts",{});
 assert.equal(createEmptyInvoiceForm().autoGenerateNumber,true);
 const permission=PERMISSIONS.invoicesManualNumber;
 assert.equal(permissionIsGranted(permission,new Set(["invoice:cancreateinvoice"])),false);
 assert.equal(permissionIsGranted(permission,new Set(["invoice_manual_number:candisableautomaticinvoicenumber"])),true);
});

for (const automatic of [true, false]) {
 test(`Daily Income invoice creation ${automatic ? "omits number and sends automatic flag" : "sends manual number"}`, async () => {
  let payload;
  const stop=new Error("Captured request");
  const api=loadFeature("src/lib/accounting/daily-income/api.ts",{post:async(_,body)=>{payload=body;throw stop;}});
  await assert.rejects(api.createDailyIncomeJournal({id:1,date:"2026-10-16"},{transactionType:"INITIAL-PAYMENT",autoGenerateInvoiceNumber:automatic,invoiceNumber:automatic?"":"MANUAL-42",invoiceCost:100,amount:0,employeeId:1,refNumber:"",refNumberMode:"system",description:"Registration"}),error=>error===stop);
  assert.equal(payload.invoice.autoGenerateNumber,automatic?true:undefined);
  assert.equal(Object.hasOwn(payload.invoice,"number"),!automatic);
  assert.equal(payload.invoice.number,automatic?undefined:"MANUAL-42");
 });
}

test("Daily Income validates numberless automatic invoices but requires manual numbers", () => {
 const {createDailyIncomeJournalSchema}=loadFeature("src/lib/accounting/daily-income/schemas.ts",{});
 const messages=new Proxy({}, {get:(_,key)=>String(key)});
 const schema=createDailyIncomeJournalSchema(messages);
 const values={transactionType:"INITIAL-PAYMENT",invoiceCost:100,amount:0,employeeId:1,refNumber:"",refNumberMode:"system",description:"Registration"};
 const auto=schema.safeParse({...values,autoGenerateInvoiceNumber:true});
 assert.equal(auto.success,true,JSON.stringify(auto.error?.issues));
 const manual=schema.safeParse({...values,autoGenerateInvoiceNumber:false});
 assert.equal(manual.success,false);
 assert.ok(manual.error.issues.some(issue=>issue.path.includes("invoiceNumber")));
});
