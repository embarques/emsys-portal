import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loadFeature(relative) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
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

const workflow = loadFeature("src/lib/accounting/daily-income/transaction-workflow.ts");
const batch = loadFeature("src/lib/accounting/daily-income/batch-continue.ts");

const paymentMethods = [{ id: 1, name: "Cash" }, { id: 2, name: "Check" }];

const savedPayment = {
  transactionType: "PAYMENT",
  employeeId: 42,
  employeeName: "Alex Rider",
  assigneeSource: "employee",
  invoiceId: "inv-1",
  invoiceNumber: "INV-100",
  invoiceBalance: 25,
  amount: 10,
  paymentMethodId: 2,
  paymentMethodName: "Check",
  checkNumber: "00123",
  autoClear: false,
  clearPaymentOnSave: true,
  refNumber: "",
  refNumberMode: "system",
  externalReferenceNumber: "",
  description: "prior note",
  includeSender: false,
  includeReceiver: false,
};

test("default batch continue step is the first step after type selection", () => {
  assert.equal(workflow.getDefaultBatchContinueStep("PAYMENT"), "assignment");
  assert.equal(workflow.getDefaultBatchContinueStep("INVENTORY"), "assignment");
  assert.equal(workflow.getDefaultBatchContinueStep("EXPENSE"), "assignment");
});

test("batch from amounts keeps assignment fields only", () => {
  const keys = workflow.getBatchPreservedValueKeys("PAYMENT", "amounts");
  assert.ok(keys.includes("employeeId"));
  assert.ok(keys.includes("routeId"));
  assert.equal(keys.includes("amount"), false);
  assert.equal(keys.includes("invoiceId"), false);
  assert.equal(keys.includes("paymentMethodId"), false);
});

test("batch from payment keeps assignment and amounts", () => {
  const keys = workflow.getBatchPreservedValueKeys("PAYMENT", "payment");
  assert.ok(keys.includes("employeeId"));
  assert.ok(keys.includes("amount"));
  assert.ok(keys.includes("invoiceId"));
  assert.equal(keys.includes("paymentMethodId"), false);
});

test("batch from review keeps all prior steps including parties for new invoices", () => {
  const keys = workflow.getBatchPreservedValueKeys("INITIAL-PAYMENT", "review");
  assert.ok(keys.includes("employeeId"));
  assert.ok(keys.includes("amount"));
  assert.ok(keys.includes("paymentMethodId"));
  assert.ok(keys.includes("includeSender"));
  assert.ok(keys.includes("senderId"));
});

test("batch from assignment preserves nothing", () => {
  assert.deepEqual(workflow.getBatchPreservedValueKeys("EXPENSE", "assignment"), []);
});

test("starting from amounts prefills assignment and clears invoice/payment", () => {
  const next = batch.continueTransactionValuesFromStep("PAYMENT", savedPayment, "amounts", paymentMethods);
  assert.equal(next.transactionType, "PAYMENT");
  assert.equal(next.employeeId, 42);
  assert.equal(next.employeeName, "Alex Rider");
  assert.equal(next.assigneeSource, "employee");
  assert.equal(next.invoiceId, undefined);
  assert.equal(next.invoiceNumber, undefined);
  assert.equal(next.amount, 0);
  assert.notEqual(next.paymentMethodName, "Check");
  assert.equal(next.checkNumber, undefined);
  assert.equal(next.description, "");
});

test("starting from payment prefills assignment and invoice amount", () => {
  const next = batch.continueTransactionValuesFromStep("PAYMENT", savedPayment, "payment", paymentMethods);
  assert.equal(next.employeeId, 42);
  assert.equal(next.invoiceId, "inv-1");
  assert.equal(next.invoiceNumber, "INV-100");
  assert.equal(next.amount, 10);
  assert.notEqual(next.paymentMethodName, "Check");
  assert.equal(next.checkNumber, undefined);
});

test("starting from review prefills every prior step including payment", () => {
  const next = batch.continueTransactionValuesFromStep("PAYMENT", savedPayment, "review", paymentMethods);
  assert.equal(next.employeeId, 42);
  assert.equal(next.invoiceId, "inv-1");
  assert.equal(next.amount, 10);
  assert.equal(next.paymentMethodId, 2);
  assert.equal(next.paymentMethodName, "Check");
  assert.equal(next.checkNumber, "00123");
  assert.equal(next.clearPaymentOnSave, true);
  assert.equal(next.description, "prior note");
});

test("starting from assignment keeps type only", () => {
  const next = batch.continueTransactionValuesFromStep("PAYMENT", savedPayment, "assignment", paymentMethods);
  assert.equal(next.transactionType, "PAYMENT");
  assert.equal(next.employeeId, undefined);
  assert.equal(next.invoiceId, undefined);
  assert.equal(next.amount, 0);
});

test("default continue prefills assignment and keeps shared payment method", () => {
  const next = batch.continueTransactionValues("PAYMENT", savedPayment, paymentMethods);
  assert.equal(next.employeeId, 42);
  assert.equal(next.invoiceId, undefined);
  assert.equal(next.amount, 0);
  assert.equal(next.paymentMethodId, 2);
  assert.equal(next.paymentMethodName, "Check");
});
