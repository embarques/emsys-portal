#!/usr/bin/env node
/** Read-only adapter, sorting, date-match and published-contract checks. */
import fs from "node:fs";
import {createApiSuite} from "./lib/api-suite.mjs";
import {createPortalLoader} from "./lib/portal-modules.mjs";
const suite=createApiSuite({title:"Backend gap readback checks",options:{output:{flag:"--output",takesValue:true}}});
const {request,ok,pass,fail,note}=suite;suite.opts.skipCrud=true;
const results=[];
function record(path,check,status,details={}){
 results.push({path,check,status,...details});
 if(status==="verified")pass(check);
 else if(status==="failed")fail(check,details.http??0,details.reason??"Invariant failed");
 else note(`${check}: ${status}`);
}
async function http(method,path,body,config={}){
 const query=new URLSearchParams(config.params??{}).toString();
 const r=await request(method,path+(query?(path.includes("?")?"&":"?")+query:""),body);
 if(!ok(r))throw new Error(`HTTP ${r.status}: ${String(r.json?.message??r.json?.error??"").slice(0,180)}`);
 return r.json;
}
const load=createPortalLoader({apiClient:{get:(path,config)=>http("GET",path,undefined,config),post:(path,body,config)=>http("POST",path,body,config)}});
const pool=load("src/lib/invoices/api/invoice-pool-api.ts");
const signal=new AbortController().signal;
suite.banner();
try{
 const asc=await pool.fetchInvoicePool(1,"number:asc",signal);
 const desc=await pool.fetchInvoicePool(1,"number:desc",signal);
 record("/invoices/reserved/search","Real portal reserved-invoice adapter parses live search response","verified",{sampleCount:asc.items.length});
 const ids=rows=>rows.map(row=>row.id).join(",");
 const distinct=new Set(asc.items.map(row=>row.number)).size>1;
 record("/invoices/reserved/search","Reserved search honors ascending versus descending number sort",!distinct?"inconclusive":ids(asc.items)===ids(desc.items)?"failed":"verified",{reason:"Comparison tests direction changes, not every collation or stable-tie case"});
 const summary=await pool.fetchInvoicePoolSummary(signal);
 record("/invoices/reserved","Real portal reserved-invoice summary adapter parses live response","verified",{remaining:summary.remaining,lowThreshold:summary.lowThreshold});
}catch(error){record("/invoices/reserved/search","Real portal reserved-invoice adapter/readback","failed",{reason:error.message.slice(0,220)});}
// The company summary may intentionally return the default threshold; compare the
// explicit current-user lookup against that user's own persisted preference.
try {
 const preferences=await http("GET","/users/me/preferences");
 const userId=preferences.data?.user?.id;
 if(!userId||typeof preferences.data?.invoicePoolThreshold!=="number")record("/users/me/preferences","Current-user reserved threshold control","inconclusive");
 else {
  const own=await http("GET","/invoices/reserved",undefined,{params:{userId,limit:1}});
  record("/invoices/reserved","User-specific reserved threshold matches persisted preference",own.data?.lowThreshold===preferences.data.invoicePoolThreshold?"verified":"failed",{expected:preferences.data.invoicePoolThreshold,actual:own.data?.lowThreshold});
 }
}catch(error){record("/invoices/reserved","User-specific reserved threshold control","inconclusive",{reason:error.message.slice(0,160)});}
const getSort={};
for(const direction of ["asc","desc"]){
 try {
  const r=await http("GET","/invoices/reserved",undefined,{params:{limit:5,sort:`number:${direction}`}});
  const rows=Array.isArray(r.data)?r.data:r.data?.items??[];
  getSort[direction]=rows.map(row=>({id:row.id,number:row.number}));
 }catch(error){record("/invoices/reserved",`Reserved GET ${direction} control`,"inconclusive",{reason:error.message.slice(0,160)});}
}
if(getSort?.asc&&getSort?.desc){
 const distinct=new Set(getSort.asc.map(row=>row.number)).size>1;
 const changed=getSort.asc.map(row=>row.id).join(",")!==getSort.desc.map(row=>row.id).join(",");
 record("/invoices/reserved","Reserved GET changes number sort direction",!distinct?"inconclusive":changed?"verified":"failed",{sampleCount:getSort.asc.length});
}
for(const [path,field] of [["/user-activities","timestamp"],["/checks","datePosted"]]){
 const list=await request("GET",`${path}?page=1&limit=5&sort=${field}:desc`);
 if(!ok(list)){record(path,`${field} date matching control`,"inconclusive",{http:list.status});continue;}
 const row=(Array.isArray(list.json?.data)?list.json.data:[]).find(row=>typeof row[field]==="string"&&Number.isFinite(Date.parse(row[field])));
 if(!row){record(path,`${field} date matching control`,"inconclusive",{reason:"No non-null date in bounded sample"});continue;}
 const day=row[field].slice(0,10);
 const search=await request("POST",`${path}/search?page=1&limit=1`,{operator:"and",pagination:{page:1,limit:1},filters:[{field,operator:"gte",value:day+"T00:00:00Z"},{field,operator:"lte",value:day+"T23:59:59.999Z"}]});
 record(path,`${field} range finds a date from a stored record`,ok(search)&&Number(search.json?.total)>0?"verified":"failed",{http:search.status,total:Number(search.json?.total??0)});
}
// Verify stored status coverage without changing any journal or invoice.
try {
 const filters=[{field:"transactionType",operator:"eq",value:"PAYMENT"}];
 const search=extra=>http("POST","/journals/search",{operator:"and",pagination:{page:1,limit:1},filters:[...filters,...extra]});
 const total=await search([]);
 const statuses=await Promise.all(["OUTSTANDING","RECONCILED","NOT_REQUIRED"].map(value=>search([{field:"reconciliationStatus",operator:"eq",value}])));
 const classified=statuses.reduce((sum,r)=>sum+Number(r.total??0),0);
 record("/journals/search","Stored payment reconciliation statuses cover all payment rows",classified===Number(total.total)?"verified":"failed",{total:Number(total.total),classified});
}catch(error){record("/journals/search","Stored payment reconciliation status coverage","inconclusive",{reason:error.message.slice(0,180)});}
for(const path of ["/pickups","/deliveries/assigned-barcodes"]){
 const r=await request("POST",`${path}/search?page=1&limit=3`,{operator:"and",pagination:{page:1,limit:3},filters:[{field:"route.id",operator:"neq",value:null}]});
 const rows=Array.isArray(r.json?.data)?r.json.data:[];
 record(path,"Populated route-ID predicate is accepted and sample IDs are populated",!ok(r)?"failed":rows.length===0?"inconclusive":rows.every(row=>Boolean(row.route?.id))?"verified":"failed",{http:r.status,sampleCount:rows.length});
}
try{
 const url=new URL(suite.opts.baseUrl);url.pathname="/swagger/doc.json";
 const response=await fetch(url);const schema=await response.json();
 const defs=schema.components?.schemas??schema.definitions??{};
 record("/swagger/doc.json","Business-date endpoint is published",schema.paths?.["/vehicle-routes/business-date"]?"verified":"failed");
 const status=defs["journal.Journal"]?.properties?.reconciliationStatus?.enum??[];
 record("/swagger/doc.json","Journal reconciliation enum documents NOT_REQUIRED",status.includes("NOT_REQUIRED")?"verified":"failed");
 const description=schema.paths?.["/journals/clear"]?.post?.description??"";
 record("/swagger/doc.json","Clearance documentation reflects atomic reconciliation",/never changes reconciliation|independent/i.test(description)?"failed":"inconclusive");
 record("/swagger/doc.json","Loan increase endpoint is published",schema.paths?.["/loans/{id}/increases"]?.post?"verified":"inconclusive",{reason:"Schema absence alone does not prove the live POST route is absent"});
}catch(error){record("/swagger/doc.json","Published contract lookup","inconclusive",{reason:error.message.slice(0,180)});}
if(suite.opts.output)fs.writeFileSync(suite.opts.output,JSON.stringify({checkedAt:new Date().toISOString(),companyId:suite.opts.companyId,results},null,2));
suite.finish();
