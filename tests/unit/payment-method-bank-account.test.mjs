import assert from "node:assert/strict";
import test from "node:test";

import { isCheckPaymentMethod, requiresBankAccount } from "../../src/lib/accounting/daily-income/types.ts";

test("check aliases require both the check details and a bank account", () => {
  for (const name of ["CHECK", "CHEQUE", " check ", "Cheque"]) {
    assert.equal(isCheckPaymentMethod(name), true);
    assert.equal(requiresBankAccount(name), true);
  }
});

test("deposit and Zelle keep bank selection while cash and empty methods do not", () => {
  for (const name of ["DEPOSIT", " zelle "]) {
    assert.equal(requiresBankAccount(name), true);
    assert.equal(isCheckPaymentMethod(name), false);
  }
  for (const name of ["CASH", "EFECTIVO", "", null, undefined]) {
    assert.equal(requiresBankAccount(name), false);
  }
});

test("credit card requires a bank account across supported method spellings", () => {
  for (const name of ["CREDIT-CARD", "credit card", "CREDIT_CARD", "CreditCard"]) {
    assert.equal(requiresBankAccount(name), true);
    assert.equal(isCheckPaymentMethod(name), false);
  }
});
