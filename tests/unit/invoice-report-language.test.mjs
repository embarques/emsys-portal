import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
let loadConfiguration;
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
  const feature=load(path.join(root, relative));
 loadConfiguration=load(path.join(root,"src/lib/configuration/store.ts"));
 return feature;
}


const feature = "src/lib/reports/api/reports-api.ts";

test("invoice printing uses current UI language on every request, preserving explicit overrides", async () => {
 const languages=[];
 const api=loadFeature(feature,{post:async (_url,body)=>{languages.push(body.language);return {success:true,data:{url:"https://example.test/invoice.pdf"}};}});
 // The same module cache exposes the actual preference store used by the API.
 const configuration = loadConfiguration;
 const request={type:"invoice",collection:"invoices",values:["507f1f77bcf86cd799439011"],lookupField:"id"};
 configuration.updateConfigurationLanguage("en"); await api.generateInvoiceReport(request);
 configuration.updateConfigurationLanguage("es"); await api.generateInvoiceReport(request);
 await api.generateInvoiceReport({...request,language:"en"});
 assert.deepEqual(languages,["en","es","en"]);
 assert.equal(request.language,undefined);
});
