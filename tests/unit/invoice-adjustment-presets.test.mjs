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
    if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return load(target);
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const presets = loadFeature("src/lib/accounting/daily-income/invoice-adjustment-presets.ts");
const { dailyIncomeJournalSchema, createDailyIncomeJournalSchema } = loadFeature("src/lib/accounting/daily-income/schemas.ts");

const discount = (amount, invoiceBalance, invoiceId = "inv-1") => ({
  transactionType: "DISCOUNT",
  amount,
  invoiceId,
  invoiceNumber: "A-1",
  invoiceBalance,
  refNumber: "",
  refNumberMode: "system",
  description: "",
});

test("percent amounts are a cent-rounded share of the base", () => {
  assert.equal(presets.getPercentAmount(200, 5), 10);
  assert.equal(presets.getPercentAmount(200, 15), 30);
  assert.equal(presets.getPercentAmount(33.33, 10), 3.33);
  assert.equal(presets.getPercentAmount(0.1, 15), 0.02);
  assert.equal(presets.getPercentAmount(123.45, 100), 123.45);
  assert.equal(presets.getPercentAmount(80, 12.5), 10);
  assert.equal(presets.getPercentAmount(100, 150), 150);
  assert.equal(presets.getPercentAmount(0, 50), 0);
  assert.equal(presets.getPercentAmount(-5, 50), 0);
  assert.equal(presets.getPercentAmount(100, 0), 0);
  assert.equal(presets.getPercentAmount(100, Number.NaN), 0);
});

test("balance after a 100% discount is exactly zero", () => {
  const balance = 0.1 + 0.2;
  const full = presets.getPercentAmount(balance, 100);
  assert.equal(presets.getBalanceAfterDiscount(balance, full), 0);
});

test("a percent of the total can exceed the discountable balance", () => {
  const fiftyOfTotal = presets.getPercentAmount(500, 50);
  assert.equal(presets.exceedsMoneyAmount(fiftyOfTotal, 200), true);
  assert.equal(presets.exceedsMoneyAmount(200, 200), false);
  assert.equal(presets.exceedsMoneyAmount(fiftyOfTotal, undefined), false);
});

test("custom percents must be positive numbers", () => {
  assert.equal(presets.parseAdjustmentPercent("12.5"), 12.5);
  assert.equal(presets.parseAdjustmentPercent(" 10 "), 10);
  assert.equal(presets.parseAdjustmentPercent(""), undefined);
  assert.equal(presets.parseAdjustmentPercent("0"), undefined);
  assert.equal(presets.parseAdjustmentPercent("-5"), undefined);
  assert.equal(presets.parseAdjustmentPercent("abc"), undefined);
});

test("a surcharge adds to the balance, and editing one takes the saved amount back out first", () => {
  assert.equal(presets.getBalanceAfterSurcharge(0.1, 0.2), 0.3);
  const original = { invoiceId: "inv-1", amount: 25 };
  assert.equal(presets.getSurchargeBaseBalance(125, "inv-1", original), 100);
  assert.equal(presets.getSurchargeBaseBalance(125, "inv-2", original), 125);
  assert.equal(presets.getSurchargeBaseBalance(10, "inv-1", original), 0);
  assert.equal(presets.getSurchargeBaseBalance(undefined, "inv-1", original), undefined);
});

test("editing a discount adds the saved amount back only for the same invoice", () => {
  const original = { invoiceId: "inv-1", amount: 25 };
  assert.equal(presets.getDiscountableBalance(75, "inv-1", original), 100);
  assert.equal(presets.getDiscountableBalance(75, "inv-2", original), 75);
  assert.equal(presets.getDiscountableBalance(undefined, "inv-1", original), undefined);
});

test("a discount cannot push the invoice balance below zero", () => {
  assert.equal(dailyIncomeJournalSchema.safeParse(discount(100, 100)).success, true);
  assert.equal(dailyIncomeJournalSchema.safeParse(discount(50, 100)).success, true);
  const over = dailyIncomeJournalSchema.safeParse(discount(100.01, 100));
  assert.equal(over.success, false);
  assert.deepEqual(over.error.issues.map((issue) => issue.path.join(".")), ["amount"]);
});

test("re-saving an existing discount is allowed up to its pre-discount balance", () => {
  const schema = createDailyIncomeJournalSchema(
    new Proxy({}, { get: (_target, key) => String(key) }),
    { originalDiscount: { invoiceId: "inv-1", amount: 40 } },
  );
  assert.equal(schema.safeParse(discount(40, 0)).success, true);
  assert.equal(schema.safeParse(discount(40.01, 0)).success, false);
  assert.equal(schema.safeParse(discount(40, 0, "inv-2")).success, false);
});

test("payments keep their own balance rule", () => {
  const payment = { ...discount(150, 100), transactionType: "PAYMENT", paymentMethodId: 1, paymentMethodName: "CASH" };
  assert.equal(dailyIncomeJournalSchema.safeParse(payment).success, false);
});
