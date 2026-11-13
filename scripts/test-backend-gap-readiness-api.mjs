#!/usr/bin/env node
/** Read-only probes for requested fields outside the portal's active filter lists.
 * No mutation endpoints, fixture writes, unbounded directories or report generation.
 * HTTP 200 proves acceptance only; it does not prove matching, rollback or permission isolation.
 */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";
const suite=createApiSuite({title:"Remaining backend gap read-only probes",options:{output:{flag:"--output",takesValue:true},only:{flag:"--only",takesValue:true}}});
const {request,ok,pass,fail,note}=suite;
suite.opts.skipCrud=true;
const results=[];
const candidates=[
 ["/chart-accounts","createdBy.name description parentAccount.name systemAccount default branchAccount", "id type displayName name branch.code parentAccount.name description systemAccount default branchAccount createdAt updatedAt"],
 ["/inventory/receipts","notes lines.itemId supplierName postedAt postedBy.name", "supplierName toHolderName postedAt postedBy.name"],
 ["/inventory/dispatches","notes lines.itemId supplierName postedAt postedBy.name", "supplierName fromHolderName postedAt postedBy.name"],
 ["/inventory/suppliers","addresses contacts.email contacts.name contacts.phone", "name"],
 ["/inventory/items","unitOfMeasure currency defaultSellingPriceMinor", "name"],
 ["/pickups","routeNumber legacySyncError legacySyncedAt completedBy.name", "id date completed createdAt updatedAt sender.phone1 sender.name sender.address.address1 sender.address.city sender.address.state sender.address.zipcode sector.name createdBy.name updatedBy.name comments.description branch.code employee.name route.name completedAt completedBy.name purpose routeNumber legacySyncStatus legacySyncError legacySyncedAt"],
 ["/user-activities","id timestamp", "id activityId quantity"],
 ["/checks","datePosted updatedAt clearedBy.name invoice.balance id", "datePosted"],
 ["/invoices","surcharge registration receivedBy.name pickupEmployee.name route.name officeBranch.name pickupSource id updatedBy.name invoiceDetails itemCount legacySyncedAt branch.name branch.code", "number receivedBy.name"],
 ["/barcodes","route.name delivery.name tripNumber barcodeId", "number tripNumber"],
 ["/barcode-statuses","prevStatus", "id name"],
 ["/customers","accountBalance active notes receivers", "name"],
 ["/containers","createdAt updatedAt createdBy.name updatedBy.name barcodeSequence deliverySequence", "number"],
 ["/employees","updatedAt startDate endDate totalLoanGiven totalPaymentReceived loanAmountOwed user.name loanBalanceUpdated branch.name", "name"],
 ["/users","updatedAt startTime endTime createdBy.name updatedBy.name", "name"],
 ["/roles","systemRole permissions", "name"],
 ["/branches","id createdAt updatedAt createdBy.name updatedBy.name address.address1 address.country settings.labelPrefix disclaimer", "address.address1 address.country settings.labelPrefix"],
 ["/vehicles","createdAt updatedAt updatedBy.name inspectionDate registrationDate", "name"],
 ["/vehicle-routes","vehicle.name createdAt driver.name supervisor.name helpers.name", "vehicle.name driver.name supervisor.name helpers.name"],
 ["/invoice-descriptions","createdBy.name updatedBy.name", "name"],
 ["/employee-titles","name", "name id"],
 ["/employee-departments","name", "name id"],
 ["/invoice-policies","title", "title id sortOrder"],
 ["/predefined-routes","name", "name id"],
 ["/zelle-payments","updatedAt clearedBy.name invoice.balance id", "updatedAt"],
 ["/deposits","updatedAt clearedBy.name invoice.balance id", "updatedAt"],
 ["/credit-card-payments","updatedAt clearedBy.name invoice.balance id", "updatedAt"],
 ["/loans","description referenceNumber branch.name paidAmount balance", "balance paidAmount"],
 ["/journals","description invoice.discount accounts.type transactionBalance currency customer loan", "date createdAt invoice.number refNumber accounts.name transactionAmount invoice.balance employee.name transactionType paymentMethod.name createdBy.name reconciliationStatus clearanceStatus"],
 ["/deliveries/assigned-barcodes","route.rate receiver.address.address1 receiver.phones.number", "number invoice.number invoice.balance route.rate name container.name route.name sender.name sender.phones.number receiver.name receiver.address.address1 receiver.address.city receiver.phones.number"],
];
const numberFields=new Set("id activityId quantity surcharge registration itemCount tripNumber accountBalance totalLoanGiven totalPaymentReceived loanAmountOwed paidAmount balance invoice.balance invoice.discount transactionBalance transactionAmount routeNumber route.rate defaultSellingPriceMinor barcodeSequence deliverySequence".split(" "));
function probeValue(path,field){
 if(field==="barcodeId"||(field==="id"&&["/checks","/invoices","/zelle-payments","/deposits","/credit-card-payments"].includes(path)))return "000000000000000000000000";
 if(field==="registration")return "PENDING";
 if(/^(active|completed|systemRole|systemAccount|default|branchAccount|loanBalanceUpdated)$/.test(field))return true;
 if(numberFields.has(field))return 1;
 if(/(At|Date)$/.test(field)||["timestamp","datePosted","date"].includes(field))return "2026-11-01";
 return "CODEX-READ-ONLY-NO-MATCH";
}
async function record(kind,path,field,response){
 const message=String(response.json?.error||response.json?.message||"").slice(0,350);
 const status=ok(response)?"accepted":response.status===400&&/not allowed|unsupported|unknown field|sort.*invalid/i.test(message)?"unsupported":response.status===403?"permission-denied":response.status===404?"endpoint-unavailable":"needs-review";
 const row={kind,path,field,http:response.status,status,...(!ok(response)?{message}:{})};results.push(row);
 if(status==="accepted")pass(`${kind} ${path} ${field}`);
 else fail(`${kind} ${path} ${field}`,response.status,status);
}
suite.banner();
const selected=suite.opts.only?candidates.filter(([path])=>suite.opts.only.split(",").includes(path)):candidates;
let index=0;
async function worker(){
 while(index<selected.length){
  const [path,filters,sorts]=selected[index++];
  for(const field of filters.split(" "))await record("filter",path,field,await request("POST",`${path}/search?page=1&limit=1`,{operator:"and",pagination:{page:1,limit:1,offset:0},filters:[{field,operator:"eq",value:probeValue(path,field)}]}));
  // Nonempty valid controls keep strict endpoints from rejecting an empty group
  // before they validate the requested sort field. No ordering claim is made.
  const control=path==="/journals"?{field:"reconciliationStatus",value:"OUTSTANDING"}
   :path==="/loans"?{field:"status",value:"ACTIVE"}
   :["/inventory/receipts","/inventory/dispatches"].includes(path)?{field:"status",value:"POSTED"}
   :["/checks","/zelle-payments","/deposits","/credit-card-payments"].includes(path)?{field:"id",value:"000000000000000000000000"}
   :["/invoices","/barcodes","/deliveries/assigned-barcodes"].includes(path)?{field:"number",value:"CODEX-READ-ONLY-NO-MATCH"}
   :["/pickups","/user-activities","/containers","/branches"].includes(path)?{field:"id",value:1}
   :path==="/vehicles"?{field:"branch.code",value:"NY"}
   :path==="/invoice-policies"?{field:"title",value:"CODEX-READ-ONLY-NO-MATCH"}
   :{field:"name",value:"CODEX-READ-ONLY-NO-MATCH"};
  const controlFilters=[{...control,operator:"eq"}];
  for(const field of sorts.split(" "))await record("sort",path,field,await request("POST",`${path}/search?page=1&limit=1`,{operator:"and",pagination:{page:1,limit:1,offset:0},filters:controlFilters,sort:[{field,direction:"asc"}]}));
 }
}
await Promise.all([worker(),worker()]);
for(const path of ["/vehicle-routes/business-date","/change-requests/search","/loans/000000000000000000000000/increases"]){
 const method=path.endsWith("/search")?"POST":"GET";
 const r=await request(method,path,method==="POST"?{filters:[],pagination:{page:1,limit:1}}:undefined);
 results.push({kind:"route",path,http:r.status,status:ok(r)?"available":r.status===405?"method-not-allowed":"needs-review"});
 note(`${method} ${path}: HTTP ${r.status}; route probes do not establish write behavior`);
}
if(suite.opts.output)fs.writeFileSync(suite.opts.output,JSON.stringify({companyId:suite.opts.companyId,checkedAt:new Date().toISOString(),acceptanceOnly:true,results},null,2));
note("Unsupported fields need API changes or removal from the portal request. Accepted fields still need matching/order verification; failures do not establish mutation behavior.");
suite.finish();
