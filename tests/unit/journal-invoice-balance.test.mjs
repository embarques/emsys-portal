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


for (const [name, fields, expected] of [
 ["paid invoice with omitted zero", {transactionAmount:90, invoice:{number:"487282",cost:90}}, 0],
 ["partially paid invoice", {transactionAmount:50, invoice:{number:"40000",cost:100}}, 50],
 ["unpaid invoice", {invoice:{number:"40000",cost:100}}, 100],
 ["discounted invoice", {transactionAmount:80, invoice:{number:"40000",cost:100,discount:10}}, 10],
 ["explicit zero wins", {transactionAmount:50, invoice:{number:"40000",cost:100,balance:0}}, 0],
 ["top-level balance", {transactionBalance:25, invoice:{number:"40000",cost:100}}, 25],
 ["invoice cumulative payment", {transactionType:"PAYMENT",transactionAmount:20,invoice:{number:"40000",cost:100,payment:80}}, 20],
 ["expense has no invoice balance", {transactionType:"EXPENSE",transactionAmount:125}, undefined],
]) {
 test(`journal balance: ${name}`, async () => {
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", {get:async()=>({data:{id:"journal-1",transactionType:"INITIAL-PAYMENT",...fields}})});
  const journal = await api.fetchDailyIncomeJournal("journal-1");
  assert.equal(journal.invoice?.balance, expected);
 });
}

for (const transactionType of ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE", "EXPENSE", "SALES", "TRANSFER", "LOAN", "INVENTORY"]) {
 test(`${transactionType} permits the server to assign the creator's linked employee`, () => {
  const { dailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts", {});
  const values = { transactionType, refNumber: "", description: "", amount: 10, invoiceId: "invoice-1", invoiceNumber: "123", invoiceCost: 100, invoiceBalance: 100, accountId: 1, sourceAccountId: 2, paymentMethodId: 1, paymentMethodName: "CASH", inventoryDirection: "dispatched", inventoryItemId: "box", inventoryQuantity: 1, inventoryTotal: 10, inventoryHolderEmployees: [{ id: 4, name: "Holder" }] };
  assert.equal(dailyIncomeJournalSchema.safeParse(values).success, true);
  const invalid = dailyIncomeJournalSchema.safeParse({ ...values, amount: -1 });
  assert.equal(invalid.success, false, "amount validation must remain enforced");
 });
}

test("surcharge always posts Cash with a system-generated reference", async () => {
 let sent;
 const api = loadFeature("src/lib/accounting/daily-income/api.ts", {post: async (_url, body) => { sent = body; return {success: true, data: {id:"journal-1"}}; }});
 await api.createDailyIncomeJournal({id: 1, date: "2026-10-29", status: "OPEN", branch: {id:2}, currency:"USD", rate:1}, {transactionType:"SURCHARGE", amount:15, invoiceId:"invoice-1", paymentMethodId:3, paymentMethodName:"ZELLE", paymentAccountId:4, paymentAccountType:"BANK", externalReferenceNumber:"ZL-1", refNumberMode:"system", refNumber:"", description:""});
 assert.deepEqual(sent.paymentMethod, {name:"CASH"});
 assert.equal("refNumber" in sent, false);
 assert.equal(sent.paymentAccount, undefined);
 assert.equal(sent.external_reference_number, undefined);
 assert.equal(sent.invoiceId, "invoice-1");
});

test("expense always posts Cash with a system-generated reference and keeps its source account", async () => {
 let sent;
 const api = loadFeature("src/lib/accounting/daily-income/api.ts", {post: async (_url, body) => { sent = body; return {success: true, data: {id:"journal-1"}}; }});
 await api.createDailyIncomeJournal({id: 1, date: "2026-10-29", status: "OPEN", branch: {id:2}, currency:"USD", rate:1}, {transactionType:"EXPENSE", amount:40, accountId:7, accountName:"Fuel", accountType:"EXPENSE", sourceAccountId:4, sourceAccountName:"Bank", sourceAccountType:"BANK", paymentMethodId:3, paymentMethodName:"ZELLE", paymentAccountId:4, paymentAccountType:"BANK", checkNumber:"0012", externalReferenceNumber:"ZL-1", refNumberMode:"system", refNumber:"", description:"Fuel"});
 assert.deepEqual(sent.paymentMethod, {name:"CASH"});
 assert.equal("refNumber" in sent, false);
 assert.equal(sent.paymentAccount, undefined);
 assert.equal(sent.external_reference_number, undefined);
 assert.equal(sent.paymentReference, undefined);
 assert.deepEqual(sent.sourceAccount, {id:4, name:"Bank", type:"BANK"});
 assert.deepEqual(sent.account, {id:7, name:"Fuel", type:"EXPENSE"});
});

test("expense does not require payment method details", () => {
 const { dailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts", {});
 const result = dailyIncomeJournalSchema.safeParse({ transactionType: "EXPENSE", amount: 40, accountId: 7, sourceAccountId: 4, paymentMethodName: "ZELLE", refNumber: "", description: "", employeeId: 1 });
 assert.deepEqual(result.success ? [] : result.error.issues.map((issue) => issue.path.join(".")).filter((field) => ["paymentAccountId", "checkNumber", "paymentMethodId"].includes(field)), []);
});

test("surcharge does not require a payment method selection", () => {
 const { dailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts", {});
 const result = dailyIncomeJournalSchema.safeParse({ transactionType: "SURCHARGE", amount: 15, invoiceId: "invoice-1", refNumber: "", description: "" });
 assert.equal(result.success, true);
});

test("unassigned transaction sends no fabricated employee and retains the branch", async () => {
 let sent;
 const api = loadFeature("src/lib/accounting/daily-income/api.ts", {post: async (_url, body) => { sent = body; return {success: true, data: {id:"journal-1"}}; }});
 await api.createDailyIncomeJournal({id: 1, date: "2026-10-26", status: "OPEN", branch: {id:2}, currency:"USD", rate:1}, {transactionType:"SALES", amount:10, accountId:1, paymentMethodName:"CASH", refNumber:"", description:""});
 assert.equal(sent.employee, null);
 assert.equal(sent.vehicleRoute, null);
 assert.deepEqual(sent.branch, {id:2});
 assert.equal("incomeStatement" in sent, false);
});

for (const code of ["US", "CA", "RD"]) {
 test(`today's closeout creation for ${code} omits historical dates and applies branch currency rules`, async () => {
  let body;
  const api = loadFeature("src/lib/accounting/daily-income/api.ts", { post: async (url, payload) => {
   assert.equal(url,"/income-statements"); body=payload;
   return {success:true,data:{id:7,date:"2026-10-27",branch:payload.branch,status:"OPEN",currency:payload.currency,rate:payload.rate}};
  }});
  const statement = await api.createTodayIncomeStatement({id:2,code,name:"Branch"},{currency:"DOP",rate:60});
  assert.equal(statement.date,"2026-10-27");
  assert.equal("date" in body,false);
  assert.equal("status" in body,false);
  assert.equal(body.currency,code==="RD" ? "DOP" : "USD");
  assert.equal(body.rate,code==="RD" ? 60 : 1);
 });
}

test("closeout creation rejects a response from a different branch", async () => {
 const api=loadFeature("src/lib/accounting/daily-income/api.ts",{post:async()=>({success:true,data:{id:7,status:"OPEN",branch:{id:99}}})});
 await assert.rejects(api.createTodayIncomeStatement({id:2,code:"US",name:"Branch"},{currency:"USD",rate:1}),/open closeout for this branch/);
});
