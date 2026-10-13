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
    ...types.createEmptyInvoiceForm(), invoiceNumber:"TEST-1", date:"2026-10-12",
    sender: {...customers.createEmptyCustomerForm(), id:"customer-1", name:"Sender"},
    lineItems:[{...types.createEmptyInvoiceLineItem(), itemName:"Box", quantity:"1", labels:"1", unitPrice:"80", total:"80"}],
   };
   const context = {
    branch:{id:1,name:"NY",code:"NY"}, container:{id:1,name:"66-26"},
    pickupAssignment: source === "route"
     ? {source, dailyRoute:{id:"daily-route-1",name:"Daily route"},routeCrew:{id:"crew-1",name:"Crew"}}
     : {source, pickupEmployee:{id:73,name:" Maria ",userName:"maria"},officeBranch:{id:1,name:"NY",code:"NY"}},
   };
   const request = method === "updateInvoice"
    ? api[method]("507f1f77bcf86cd799439011", values, context)
    : api[method](values, context);
   await assert.rejects(request, (error) => error === stop);
   if (source === "route") {
    assert.equal(payload.receivedBy.id,"daily-route-1");
    assert.equal(payload.receivedBy.route.id,"crew-1");
   } else {
    assert.equal(payload.receivedBy.id,"73");
    assert.equal(payload.receivedBy.name,"Maria");
    assert.equal(payload.employee.id,73);
    assert.equal(payload.pickupEmployee.id,73);
   }
  });
 }
}
