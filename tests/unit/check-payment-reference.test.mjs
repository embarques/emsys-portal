import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCheckDocumentPaymentWire,
  buildJournalCheckPaymentWire,
  resolveJournalCheckNumberFromApi,
  resolvePaymentReferenceForDisplay,
} from "../../src/lib/accounting/daily-income/check-payment-reference.ts";

test("write dual-sends paymentReference and legacy checkNumber", () => {
  assert.deepEqual(buildJournalCheckPaymentWire(" 4521 "), {
    paymentReference: "4521",
    checkNumber: "4521",
  });
  assert.deepEqual(buildJournalCheckPaymentWire(""), {});
  assert.deepEqual(buildJournalCheckPaymentWire(undefined), {});
});

test("check document write carries paper number through supported fields", () => {
  assert.deepEqual(buildCheckDocumentPaymentWire("00123"), {
    paymentReference: "00123",
    checkNumber: "00123",
  });
});

test("read prefers paymentReference over legacy checkNumber and preserves leading zeros", () => {
  assert.equal(
    resolveJournalCheckNumberFromApi({
      paymentReference: "00123",
      checkNumber: "LEGACY",
      check_number: "SNAKE",
    }),
    "00123",
  );
  assert.equal(
    resolveJournalCheckNumberFromApi({
      checkNumber: "LEGACY",
      check_number: "SNAKE",
    }),
    "LEGACY",
  );
  assert.equal(resolveJournalCheckNumberFromApi({ check_number: "SNAKE" }), "SNAKE");
  assert.equal(resolveJournalCheckNumberFromApi({}), undefined);
});

test("display mapping prefers paymentReference then checkNumber and never uses refNumber", () => {
  assert.equal(
    resolvePaymentReferenceForDisplay({
      paymentReference: "PAY-1",
      checkNumber: "CHK-1",
    }),
    "PAY-1",
  );
  assert.equal(
    resolvePaymentReferenceForDisplay({
      checkNumber: "CHK-1",
    }),
    "CHK-1",
  );
  assert.equal(resolvePaymentReferenceForDisplay({}), "");
  assert.equal(
    resolvePaymentReferenceForDisplay({
      paymentReference: "00123",
      checkNumber: "99",
    }),
    "00123",
  );
});
