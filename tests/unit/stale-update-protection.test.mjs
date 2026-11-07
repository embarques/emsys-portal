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

function barcodeInvoice(savedVersion = version) {
 return {
  id: "650000000000000000000001", version: savedVersion, invoiceNumber: "INV-1",
  invoiceDetails: [{barcodes: [
   {barcodeId: "label-1", number: "INV-1-1", status: {id: 1, name: "New"}},
   {barcodeId: "label-2", number: "INV-1-2", status: {id: 1, name: "New"}},
  ]}],
 };
}
const barcodePatch = {
 barcodeId: "label-1", number: "INV-1-1", status: {id: 2, name: "In transit"},
 container: {id: 3, name: "Container"}, route: {id: "route-1", name: "Route"},
};

test("barcode scanner writes status, container and route with the fetched invoice revision", async () => {
 const invoice = barcodeInvoice();
 const untouched = structuredClone(invoice.invoiceDetails[0].barcodes[1]);
 const reads = [], writes = [];
 const api = loader({
  get: async (...args) => {reads.push(args); return {data: structuredClone(invoice)};},
  put: async (...args) => {writes.push(args); return {success: true};},
 })("src/lib/invoices/api/invoices-api.ts");
 await api.patchInvoiceEmbeddedBarcodes(invoice.id, [barcodePatch]);
 assert.equal(reads.length, 1);
 assert.equal(writes.length, 1);
 assert.equal(writes[0][0], reads[0][0]);
 assert.deepEqual(writes[0][2], {headers: {"If-Match": `"${version}"`}});
 assert.deepEqual(writes[0][1].invoiceDetails[0].barcodes, [barcodePatch, untouched]);
 assert.equal(writes[0][1].invoiceNumber, "INV-1");
});

test("embedded barcode writes reject a missing revision before PUT and never retry stale conflicts", async () => {
 for (const operation of [
  api => api.patchInvoiceEmbeddedBarcodes("650000000000000000000001", [barcodePatch]),
  api => api.removeInvoiceEmbeddedBarcodes("650000000000000000000001", ["label-1"]),
 ]) {
  let reads = 0, writes = 0;
  const conflict = Object.assign(new Error("STALE_VERSION"), {status: 412});
  const api = loader({
   get: async () => {reads++; return barcodeInvoice(reads === 1 ? "" : version);},
   put: async (...args) => {
    writes++;
    assert.deepEqual(args[2], {headers: {"If-Match": `"${version}"`}});
    throw conflict;
   },
  })("src/lib/invoices/api/invoices-api.ts");
  await assert.rejects(operation(api), /no valid saved version/);
  assert.equal(writes, 0);
  await assert.rejects(operation(api), error => error === conflict);
  assert.equal(reads, 2);
  assert.equal(writes, 1);
 }
});

test("route eligibility uses local calendar dates and accepts today and future destinations", () => {
 const policy = loader()("src/lib/pickup-delivery-routes/assignment-policy.ts");
 assert.equal(policy.assignmentToday(new Date(2026, 10, 6, 23, 59)), "2026-11-06");
 assert.equal(policy.isAssignableRouteDate("2026-11-05", "2026-11-06"), false);
 assert.equal(policy.isAssignableRouteDate("2026-11-06T00:00:00Z", "2026-11-06"), true);
 assert.equal(policy.isAssignableRouteDate("2026-11-07", "2026-11-06"), true);
 assert.equal(policy.isAssignableRouteDate("", "2026-11-06"), false);
 const labels = loader()("src/lib/labels/route-assignment-policy.ts");
 assert.throws(() => labels.assertBarcodeRouteChangeAllowed({id: 7}, {id: "original"}, null), /cannot be reassigned or unassigned/);
 assert.doesNotThrow(() => labels.assertBarcodeRouteChangeAllowed({id: 7}, {id: "original"}, {id: "original"}));
 assert.doesNotThrow(() => labels.assertBarcodeRouteChangeAllowed({id: 3}, {id: "old-route"}, null));
});

test("invoice barcode route lock checks saved delivery status before applying any status patch", async () => {
 const invoice = barcodeInvoice();
 invoice.invoiceDetails[0].barcodes[0].status = {id: 7, name: "ENTREGADO"};
 invoice.invoiceDetails[0].barcodes[0].route = {id: "delivering-route", name: "Original route"};
 let writes = 0;
 const api = loader({
  get: async () => structuredClone(invoice),
  put: async () => {writes++; return {success: true};},
 })("src/lib/invoices/api/invoices-api.ts");
 await assert.rejects(api.patchInvoiceEmbeddedBarcodes(invoice.id, [barcodePatch]), /cannot be reassigned or unassigned/);
 assert.equal(writes, 0);
 await api.patchInvoiceEmbeddedBarcodes(invoice.id, [{...barcodePatch, route: invoice.invoiceDetails[0].barcodes[0].route}]);
 assert.equal(writes, 1);
});

test("completed appointments keep their routes; unfinished appointments can leave old routes without another read permission", async () => {
 let deletes = 0;
 const api = loader({
  get: async () => {throw new Error("Unassignment must not require separate pickup-view permission");},
  delete: async () => {deletes++; return {success: true};},
 })("src/lib/orders/api/orders-api.ts");
 await assert.rejects(api.clearPickupRouteAssignment({id: 1, completed: true}), /cannot be reassigned or unassigned/);
 assert.equal(deletes, 0);
 await api.clearPickupRouteAssignment({id: 1, completed: false, routeId: "historical-route"});
 assert.equal(deletes, 1);
});

test("appointment destination date is rechecked before assignment and old source routes do not block reassignment", async () => {
 let writes = 0;
 const load = loader({
  get: async () => {throw new Error("Assignment must not require separate route-view permission");},
  put: async () => {writes++; return {success: true};},
 });
 const api = load("src/lib/orders/api/orders-api.ts");
 await assert.rejects(api.assignPickupsToRoute("route", [1], "2000-01-01"), /today or later/);
 assert.equal(writes, 0);
 const routeDate = load("src/lib/pickup-delivery-routes/assignment-policy.ts").assignmentToday();
 await api.assignPickupsToRoute("route", [1], routeDate);
 assert.equal(writes, 1);
});

test("assignable route lists filter old dates on the server without extra list requests", async () => {
 const requests = [];
 const api = loader({post: async (...args) => {requests.push(args); return {data: [], total: 0};}})("src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts");
 await api.fetchActiveRoutes({minDate: "2026-11-06", limit: 200});
 assert.equal(requests.length, 1);
 assert.match(requests[0][0], /vehicle-routes\/search/);
 assert.ok(JSON.stringify(requests[0][1]).includes('"field":"date","operator":"gte","value":"2026-11-06T00:00:00Z"'));
});
