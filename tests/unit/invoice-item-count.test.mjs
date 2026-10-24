import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/i18n") return { useTranslation: () => ({ t: (key) => key }) };
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load([`${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")].find((candidate) => fs.existsSync(candidate)));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}


const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const invoiceId = "507f1f77bcf86cd799439011";

for (const [name, itemCount, expected] of [["API value", 9, 9], ["API zero", 0, 0], ["older API", undefined, 5]]) {
 test(`invoice read preserves ${name} without another request`, async () => {
  let requests = 0;
  const api = loadFeature("src/lib/invoices/api/invoices-api.ts", {get: async () => {
   requests += 1;
   return {data: {id: invoiceId, itemCount, invoiceDetails:[{id:"line-1",name:"Box",quantity:3,labels:8},{id:"line-2",name:"Barrel",quantity:2,labels:1}]}};
  }});
  const invoice = await api.fetchInvoiceById(invoiceId);
  assert.equal(invoice.itemCount, expected);
  assert.equal(requests, 1);
 });
}

test("a catalog item saves its text as the detail description the API copies onto barcodes", async () => {
 let posted;
 const api = loadFeature("src/lib/invoices/api/invoices-api.ts", {post: async (_url, body) => {
  posted = body;
  return {data: {id: invoiceId, invoiceDetails: body.invoiceDetails}};
 }});
 const types = loadFeature("src/lib/invoices/types.ts");
 const values = {
  ...types.createEmptyInvoiceForm(),
  invoiceNumber: "INV-1",
  date: "2026-10-24",
  sender: {id: "", name: "Sender", phones: [], addresses: [], email: "", IDNumber: ""},
  lineItems: [{...types.createEmptyInvoiceLineItem(), itemId: "76", itemName: "5/6 CON MONA COMIDA Y ROPA U/S", quantity: "1", unitPrice: "0", labelCount: "1"}],
 };
 const invoice = await api.createInvoice(values, {branch: {id: 1}, container: {id: 67, name: "67-26"}});
 assert.equal(posted.invoiceDetails[0].name, "5/6 CON MONA COMIDA Y ROPA U/S");
 assert.equal(posted.invoiceDetails[0].description, "5/6 CON MONA COMIDA Y ROPA U/S");
 assert.equal(invoice.lineItems[0].itemName, "5/6 CON MONA COMIDA Y ROPA U/S");
});

test("a barcode saved with a numeric catalog id as description shows the line name", () => {
 const {normalizeBarcode} = loadFeature("src/lib/labels/api/barcodes-api.ts");
 assert.equal(normalizeBarcode({id: 176, number: "ET067260002", description: "76", name: "5/6 CON MONA COMIDA Y ROPA U/S"}).description, "5/6 CON MONA COMIDA Y ROPA U/S");
 assert.equal(normalizeBarcode({id: 177, number: "ET067260003", description: "Box"}).description, "Box");
 assert.equal(normalizeBarcode({id: 178, number: "ET067260004", name: "Barrel"}).description, "Barrel");
});

test("draft item count follows quantities and excludes untouched blank rows", () => {
 const types = loadFeature("src/lib/invoices/types.ts");
 const values = types.createEmptyInvoiceForm();
 assert.equal(types.getInvoiceFormItemCount(values), 0);
 values.lineItems = [{...types.createEmptyInvoiceLineItem(),itemName:"Box",quantity:"3",labelCount:"8"},{...types.createEmptyInvoiceLineItem(),itemName:"Barrel",quantity:"2"},types.createEmptyInvoiceLineItem()];
 assert.equal(types.getInvoiceFormItemCount(values),5);
 values.lineItems[0].quantity="4";
 assert.equal(types.getInvoiceFormItemCount(values),6);
 values.lineItems[0].quantity="invalid";
 assert.equal(types.getInvoiceFormItemCount(values),2);
});

test("edit summary shows item count before financial totals including discount and payment", () => {
 const types = loadFeature("src/lib/invoices/types.ts");
 const {InvoiceWizardSummarySidebar} = loadFeature("src/components/invoices/invoice-wizard-summary-panel.tsx");
 const values = {...types.createEmptyInvoiceForm(),lineItems:[{...types.createEmptyInvoiceLineItem(),itemName:"Box",quantity:"5",unitPrice:"10"}],discount:"0",amountPaid:"0"};
 const html = renderToStaticMarkup(createElement(InvoiceWizardSummarySidebar,{values}));
 const labels = ["itemCount","subtotal","discount","paid","total"].map(key => `invoices.wizard.summary.${key}`);
 for(let i=0;i<labels.length;i++) {
  assert.ok(html.includes(labels[i]), `missing ${labels[i]}`);
  if(i) assert.ok(html.indexOf(labels[i-1])<html.indexOf(labels[i]));
 }
 assert.match(html,/invoices.wizard.summary.itemCount<\/span><span[^>]*>5<\/span>/);
 assert.ok(!html.includes('<input'),"read-only financial information must stay read-only");
});

test("new Items column is introduced before Cost without resetting existing preferences", () => {
 const {normalizeColumnOrder} = loadFeature("src/lib/table/column-preferences.ts");
 const columns = [{id:"number"},{id:"itemCount",defaultBefore:"total"},{id:"total"},{id:"balance"}];
 assert.deepEqual(normalizeColumnOrder(["balance","total","number"],columns),["balance","itemCount","total","number"]);
 assert.deepEqual(normalizeColumnOrder(["balance","total","number","itemCount"],columns),["balance","total","number","itemCount"]);
});
