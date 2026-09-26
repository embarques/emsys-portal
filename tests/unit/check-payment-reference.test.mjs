import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("read prefers paymentReference over legacy checkNumber", () => {
  assert.equal(
    resolveJournalCheckNumberFromApi({
      paymentReference: "PAY-9",
      checkNumber: "LEGACY",
      check_number: "SNAKE",
    }),
    "PAY-9",
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

test("display mapping prefers paymentReference then checkNumber then refNumber", () => {
  assert.equal(
    resolvePaymentReferenceForDisplay({
      paymentReference: "PAY-1",
      checkNumber: "CHK-1",
      refNumber: "REF-1",
    }),
    "PAY-1",
  );
  assert.equal(
    resolvePaymentReferenceForDisplay({
      checkNumber: "CHK-1",
      refNumber: "REF-1",
    }),
    "CHK-1",
  );
  assert.equal(resolvePaymentReferenceForDisplay({ refNumber: "REF-1" }), "REF-1");
  assert.equal(resolvePaymentReferenceForDisplay({}), "");
});
