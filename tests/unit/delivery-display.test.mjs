import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,"../..");
const invoiceId="68f800000000000000000001";
const row={id:1,barcodeId:"65f000000000000000000001",number:"BARCODE-1",invoiceId,invoiceNumber:"000123",description:"Box",status:{id:6,name:"CONDUCE"},container:{name:"Container"},receiver:{name:"Receiver",province:"Santiago",address1:"Calle 1",apartment:"",city:"Santiago",zipcode:"",phones:[]}};
function loadComponent(relative){
 const cache=new Map();
 const block=({children})=>React.createElement("div",null,children);
 const stubs={
  "@/lib/i18n":{useTranslation:()=>({t:(key)=>({"deliveries.columns.invoice":"Invoice #","deliveries.columns.status":"Status"}[key]??key)})},
  "@/lib/deliveries/hooks/use-deliver-invoice":{useDeliveryAccess:()=>({canList:true,canDeliver:false,canPrint:false,companyId:"company",actorId:"actor"})},
  "@/lib/table/hooks/use-catalog-table":{useCatalogTable:()=>({items:[row],isLoading:false,isError:false,hasActiveFilters:false})},
  "@/components/app-shell/catalog-table-toolbar":{CatalogTablePagination:()=>null,CatalogTableToolbar:()=>null},
  "@/components/app-shell/page-header":{PageHeader:()=>null},
  "@/components/ui/card":{Card:block,CardHeader:block},
  "@/components/ui/button":{Button:({children,...props})=>React.createElement("button",props,children)},
  "@/lib/api/axios":{normalizeApiError:()=>({message:"error"})},
  "@/lib/deliveries/api/assigned-deliveries-api":{fetchAssignedDeliveryBarcodesPage:()=>{}},
  "@/lib/query/query-keys":{queryKeys:{deliveries:{assignedPage:()=>[]}}},
  "@/components/deliveries/delivery-action-notice":{DeliveryActionNotice:()=>null},
  "@/components/deliveries/deliver-dialog":{DeliverDialog:()=>null},
  "@/components/invoices/invoice-print-signatures-dialog":{InvoicePrintSignaturesDialog:()=>null},
 };
 function load(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const loadedModule={exports:{}};cache.set(filename,loadedModule);
  const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  function resolve(name){if(stubs[name])return stubs[name];if(name.startsWith("@/")){const base=path.join(root,"src",name.slice(2));return load(fs.existsSync(base+".ts")?base+".ts":base+".tsx");}return require(name);}
  new Function("require","module","exports",output)(resolve,loadedModule,loadedModule.exports);return loadedModule.exports;
 }
 return load(path.join(root,relative));
}

test("desktop and mobile delivery rows show the business invoice number and omit redundant status",()=>{
 const {DeliveriesWorkspace}=loadComponent("src/components/deliveries/deliveries-workspace.tsx");
 const html=renderToStaticMarkup(React.createElement(DeliveriesWorkspace));
 assert.match(html,/Invoice #/);
 assert.match(html,/>000123</);
 assert.doesNotMatch(html,/CONDUCE|>Status</);
 assert.doesNotMatch(html,new RegExp(invoiceId));
});

test("a missing invoice number never displays the technical ObjectID instead",()=>{
 const {DeliveryMobileRow}=loadComponent("src/components/deliveries/delivery-mobile-row.tsx");
 const html=renderToStaticMarkup(React.createElement(DeliveryMobileRow,{row:{...row,invoiceNumber:undefined},canDeliver:false,onDeliver:()=>{}}));
 assert.doesNotMatch(html,new RegExp(invoiceId));
 assert.doesNotMatch(html,/CONDUCE/);
});

test("delivery filters use the invoice number and do not offer the fixed status",()=>{
 const {ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS}=loadComponent("src/lib/deliveries/filter-fields.ts");
 assert.ok(ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS.some(({field})=>field==="invoice.number"));
 assert.ok(!ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS.some(({field})=>field==="status.name"||field==="invoice.id"));
});
